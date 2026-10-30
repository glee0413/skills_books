---
id: gstack/sync-gbrain
title: sync-gbrain
description: 把 gbrain 与仓库当前代码同步，并刷新 CLAUDE.md 里让 agent 优先用 gbrain 而非 Grep 的搜索指引。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: sync-gbrain/SKILL.md
snapshotPath: source-snapshots/gstack/sync-gbrain/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /sync-gbrain — 保持 gbrain 最新，并教会 agent 使用它

你正在执行那个正式的"让这个 brain 保持最新"动词。/setup-gbrain 只安装一次 gbrain；/sync-gbrain 在用户希望按仓库当前状态刷新 brain 时运行，同时刷新 CLAUDE.md 里 agent 侧的指引，让编码 agent 知道何时该优先用 `gbrain` 搜索而不是 Grep。

**架构：** 这个技能使用 gbrain v0.20.0+ 的**原生代码接口**（`gbrain sources add`、`gbrain sync --strategy code`、`gbrain reindex-code`、`gbrain code-def/code-refs/code-callers/code-callees`）。它**不**使用 `gbrain import`（那条路径是给 markdown 目录用的）。它**不**碰 `~/.gstack/` 的索引（那由现有的 `gstack-gbrain-source-wireup` 负责——绝不重复存储）。

## 用户可调用

用户输入 `/sync-gbrain` 时运行这个技能。参数模式由技能自己解析，不经过派发二进制：

- `/sync-gbrain` —— 增量同步（默认；走 mtime 快路径；稳态约 50ms）
- `/sync-gbrain --full` —— 通过 `gbrain reindex-code` 做完整代码重建索引（大仓库约 25-35 分钟）。**仅当调用图从未构建过**时才自动构建它（`gbrain dream --phase resolve_symbol_edges`）。
- `/sync-gbrain --dream` —— 通过 `gbrain dream --source <id> --phase resolve_symbol_edges` 构建这个源的调用图（`gbrain code-callers`/`code-callees`）；约几分钟；在同步各阶段之后无锁运行。总是强制执行，即使已经构建过。只跑那一个阶段，绝不跑 gbrain 的完整维护周期（含 LLM 阶段约 35 分钟）；如果安装的 gbrain 无法限定该阶段范围，dream 行会说明，什么也不跑。只有在能识别代码的 schema pack 上才会产出图；否则这次运行会报一条 WARN，解释图为什么仍然是空的。
- `/sync-gbrain --no-dream` —— 跳过 `--full` 否则会自动运行的 dream 周期。
- `/sync-gbrain --code-only` —— 只跑代码阶段；跳过 memory + brain-sync
- `/sync-gbrain --dry-run` —— 预览会同步什么；任何地方都不写入
- `/sync-gbrain --no-memory` / `--no-brain-sync` —— 有选择地跳过阶段
- `/sync-gbrain --sources <types|all>` —— 要摄入的记忆类型（环境变量 `GSTACK_MEMORY_INGEST_SOURCES`）；默认情况下，联邦 gstack 源已经索引过的类型会被跳过，会话记录也会跳过，除非 `transcript_ingest_mode` 是 `recent` 或 `all`（列出 `transcript` 的清单可对单次运行覆盖该规则）
- `/sync-gbrain --quiet` —— 抑制逐阶段输出
- `/sync-gbrain --refresh-cache` —— 强制重建感知 brain 的规划缓存。跳过代码 + 记忆阶段；路由到 `gstack-brain-cache refresh --project <slug>`。
- `/sync-gbrain --audit` —— 输出按项目统计的 gstack 自有页面摘要 + 敏感内容审计。只读。

透传参数会直接送到 `~/.claude/skills/gstack/bin/gstack-gbrain-sync.ts` 的编排器。

**`--refresh-cache` 短路：** 出现这个标志时，技能**只**跑缓存刷新（对当前 worktree 的 slug 运行 `gstack-brain-cache refresh --project <slug>`；如果 `gstack/user-profile/<user-slug>` 存在，再跨项目刷新一次 user-profile）。代码 + 记忆 + brain-sync 阶段全部跳过。当用户知道 brain 里有新信息、希望 gstack 在下一个规划技能之前先吸收时，这很有用。

**`--audit` 短路：** 出现这个标志时，技能运行 `gstack-brain-cache list --project <slug> --json`，按页面类型汇总，然后扫描是否存在落在 SALIENCE_DEFAULT_ALLOWLIST 之外的缓存 salience 条目（泄漏检查）。只读；不修改 brain 或缓存。

---

## 步骤 1：状态探测

动手之前，先确认这台机器上跑过 /setup-gbrain。

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-detect 2>/dev/null
```

**Brain 信任策略门禁：**
如果 detect 输出里 `gbrain_mcp_mode == "remote-http"`，并且该端点的策略是 `unset`，那么策略问题**必须**在编排器运行之前先在这里问。本地引擎按传输方式默认表静默地自动设为 `personal`。

```bash
_HASH=$(~/.claude/skills/gstack/bin/gstack-config endpoint-hash 2>/dev/null)
_POLICY=$(~/.claude/skills/gstack/bin/gstack-config get brain_trust_policy@$_HASH 2>/dev/null || echo unset)
echo "BRAIN_TRUST_POLICY[$_HASH]: $_POLICY"
```

如果 `_POLICY == "unset"` 且 `_HASH != "local"`，按 `/setup-gbrain` 的步骤 9.5 措辞发 AskUserQuestion（personal 还是 shared，持久化到 `brain_trust_policy@<hash>`，personal 时按条件把 `artifacts_sync_mode=full` 翻过去）。然后继续。

如果 `_POLICY == "unset"` 且 `_HASH == "local"`，自动设为 personal：

```bash
~/.claude/skills/gstack/bin/gstack-config set brain_trust_policy@$_HASH personal
```

**分离引擎模型。** 代码阶段在本地对这台机器的 gbrain 引擎运行（PGLite，或 `gbrain config` 指向的引擎），仓库的每个 worktree 注册为它自己的源。**记忆阶段也在本地运行**（local-stdio MCP 模式）——`gstack-memory-ingest` 会对同一个本地引擎 shell 出去调用 `gbrain import`。在 remote-http MCP 模式（Path 4）下，记忆阶段改为把暂存的 markdown 持久化到 `~/.gstack/transcripts/<run-id>/`，由 artifacts 管道推送到 brain 管理员的拉取任务。brain-sync（向 git 推送的 `gstack-brain-sync`）是唯一一个从不碰本地引擎、且与模式无关都会运行的阶段。

实际效果：在 remote-http 机器上本地 PGLite 只存代码；远端 brain 装其他一切。local-stdio 机器把代码 + 会话记录混在一个本地引擎里。

还要检查按仓库的信任策略。如果这个仓库的 `gstack-gbrain-repo-policy get` 返回 `deny`，STOP：

> "This repo's gbrain trust policy is `deny`. Run `/setup-gbrain --repo` to change it before syncing."

---

## 步骤 1.5：本地引擎预检

从步骤 1 的 detect 输出里读 `gbrain_local_status`。在调用编排器**之前**按下面分支：

- **`ok`**：正常进入步骤 2。
- **`timeout`**：进入步骤 2——引擎多半是健康的，只是慢（连接池冷启动）。用一句话告诉用户："Engine probe timed out (>15s) — proceeding; raise `GSTACK_GBRAIN_PROBE_TIMEOUT_MS` if your pooler is slow." 不要把它当成配置损坏。
- **`thin-client`**：进入步骤 2——这台机器是 remote-HTTP MCP brain 的瘦客户端：按设计没有本地引擎，所以代码、记忆和 dream 阶段会以 thin-client 理由 SKIP（代码索引在 brain 服务器上跑；记忆通过远端 brain 的 artifacts 拉取来同步）。只有 brain-sync 推送在本地运行。用一句话告诉用户："Thin client of a remote brain — local stages skip by design; brain queries work via remote MCP (reachability is verified at use time, not probed here)." 不要把它归入损坏配置的修复路径。
- **`engine-locked`**：STOP。"The local PGLite database is busy, usually because `gbrain serve` from a live Claude session owns it. Stop that process or run `/sync-gbrain` outside the live session, then retry. This identifies the conflict but does not remove PGLite's single-process limit."
- **`no-cli`**：STOP。"Local gbrain CLI not installed. Run `/setup-gbrain` first."
- **`missing-config`** 且 `gbrain_mcp_mode == "remote-http"`：告诉用户 "Your brain queries (the `mcp__gbrain__*` tools) work via remote MCP, but symbol code search needs a local PGLite. Run `/setup-gbrain` and pick 'Yes' at the local code-search prompt (Path 4, step 4d), or run `gbrain init --pglite --json --embedding-model voyage:voyage-code-3 --embedding-dimensions 1024` directly (drop the voyage flags if `VOYAGE_API_KEY` isn't set). Continuing without code stage."
  然后进入步骤 2——编排器的 `runCodeImport()` 和 `runMemoryIngest()` 会返回 SKIP；只有 `runBrainSyncPush()` 会跑。**不要**中止。
- **`missing-config`** 且 `gbrain_mcp_mode != "remote-http"`：STOP。"Local gbrain CLI is installed but no engine config. Run `/setup-gbrain` first."
- **`db-unreachable`**：STOP。原样打印 detect JSON 里的 `gbrain_local_status_detail`（例如 "database host unreachable (ENOTFOUND db.example.com); your gbrain config is unchanged. Fix: check network or VPN, then re-run /sync-gbrain."）。绝不要建议把配置挪走。
- **`broken-config`** 或 **`broken-db`**：STOP，并给出明确信息：
  ```
  Local gbrain config at ~/.gbrain/config.json points at an unreachable
  engine (status: {gbrain_local_status}). Two options:
    1. Re-run /setup-gbrain — Step 1.5 offers Retry / Switch to PGLite /
       Switch brain mode / Quit.
    2. Repair manually: mv ~/.gbrain/config.json ~/.gbrain/config.json.bak
       && gbrain init --pglite --json --embedding-model voyage:voyage-code-3 \
          --embedding-dimensions 1024   (drop voyage flags if VOYAGE_API_KEY unset)
  Re-run /sync-gbrain after.
  ```
  不要继续——编排器会跳过代码+记忆、只跑 brain-sync，那是一种降级状态，应当由用户显式修好。

这次预检让编排器短路，省下它再花约 80ms 探测引擎。编排器会独立跑同一个分类器作为纵深防御，但用户拿到可操作的修复信息是在步骤 1.5 的 STOP 处。

---

## 步骤 1.6：会话记录同意

Claude Code 和 Codex 的会话记录只有在 `transcript_ingest_mode` 为 `recent`（最近 90 天）、`all`（全部历史）或 `new@<UTC time>`（只取该时刻之后开始的会话）时才会被摄入，可选地再收窄到 `transcript_repos` 里的仓库（此时值以 `+repos` 结尾）。对 `--code-only`、`--no-memory`、`--dry-run`、`--refresh-cache` 和 `--audit` 跳过这一步。否则检查用户是否已经选过；`has` 能区分键不存在和 `get` 打印的 `off` 默认值：

```bash
_TIM=$(~/.claude/skills/gstack/bin/gstack-config get transcript_ingest_mode 2>/dev/null || true)
if ~/.claude/skills/gstack/bin/gstack-config has transcript_ingest_mode; then
  _T='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]t[0-9][0-9]:[0-9][0-9]:[0-9][0-9]z'
  case "$(printf '%s' "$_TIM" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')" in
    recent|all|off|recent+repos|all+repos|new@$_T|new@$_T+repos)
      echo "TRANSCRIPT_MODE: $_TIM (repos: $(~/.claude/skills/gstack/bin/gstack-config get transcript_repos 2>/dev/null || true))" ;;
    *) echo "TRANSCRIPT_MODE: ask (stored value '$_TIM' is not recognized by this version)" ;;
  esac
else
  echo "TRANSCRIPT_MODE: ask (not set)"
fi
```

已存的值（`recent`、`all`、`off`、`new@<time>`，以及任何带 `+repos` 的）：不提问直接进入步骤 2。遇到 `ask` 时，如果 `SESSION_KIND: spawned` 或 `headless`，不要问也不要存任何东西：同步会跳过会话记录并打印如何选择。在交互式会话里问一次。先计数（`--sources transcript` 会统计尚未同意的会话）：

```bash
bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-memory-ingest.ts --probe --sources transcript
bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-memory-ingest.ts --probe --sources transcript --all-history
```

如果两次都报 `Total files in window: 0`，问是/否："Ingest coding-agent sessions as they appear?" 是则存 `recent`，否则存 `off`。否则用 AskUserQuestion：点名两个来源（这台机器上仓库策略允许的所有项目里的 Claude Code 和 Codex 会话）、两次探测得到的计数，以及目的地：本地 brain（步骤 1 的 `gbrain_engine`：PGLite 或 Supabase），或者在 remote-http 模式下是远端 brain 拉取的 artifacts 仓库。说明完整同步大量历史可能耗时较久，其间技能仍然可用。选项：

- A) 是，最近 90 天（`recent`）
- B) 是，全部历史（`all`）
- C) 是，只取从现在开始的新会话（`new`）
- E) 不，永不摄入会话记录（`off`）

任何"是"（包括是/否形式）之后，再问第二个独立问题："Which repos' sessions?" A) 仓库策略允许的所有项目仓库，或 B) 只这个仓库（仅当 `git remote get-url origin` 成功时才提供 B）。两个答案都拿到之前不要存任何东西；中途取消则什么都不存。然后先存范围，再存值（绝不存字母；`new` 存 `new@` 加当前 UTC 时间），继续步骤 2：

```bash
~/.claude/skills/gstack/bin/gstack-config set transcript_repos "$(git remote get-url origin)"  # only this repo
~/.claude/skills/gstack/bin/gstack-config unset transcript_repos                                 # every repo
~/.claude/skills/gstack/bin/gstack-config set transcript_ingest_mode <recent|all|off|new@$(date -u +%Y-%m-%dT%H:%M:%SZ)>
```

同步会用文字打印它将摄入什么；把那一行转述给用户。

其他记忆类型无论答案如何都照常同步。细节见 `setup-gbrain/memory.md#transcripts`。

---

## 步骤 2：运行编排器

把用户的标志原样作为 `<user-args>` 传给编排器（普通运行时为空）。只有当每个词都属于 `--incremental`、`--full`、`--dry-run`、`--quiet`、`--no-code`、`--no-memory`、`--no-brain-sync`、`--code-only`、`--dream`、`--no-dream`、`--allow-reclone`、`--prune-gone-worktrees`，或者 `--sources` 后面跟一个逗号分隔的小写记忆类型清单（或 `all`）时才使用它们。其他任何值都不使用：不要运行命令，告诉用户哪个值被拒绝。

```bash
bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-gbrain-sync.ts <user-args>
```

编排器跑三个阶段：代码 → 记忆 → brain-sync。任何阶段失败都不致命；后续阶段照常运行。状态通过临时文件 + 原子改名持久化到 `~/.gstack/.gbrain-sync-state.json`。并发运行由 `~/.gstack/.sync-gbrain.lock` 上的锁文件阻止（5 分钟后可抢占过期锁）。

---

## 步骤 3：代码索引健康检查

同步跑完后，核实 cwd 源的注册情况和它的页面数：

```bash
SOURCE_JSON=$(bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-gbrain-read-capability.ts --source-only 2>/dev/null)
SOURCE_ID=$(printf '%s' "$SOURCE_JSON" | jq -er 'if .status=="source" then .source_id else empty end' 2>/dev/null)
PAGES=$(printf '%s' "$SOURCE_JSON" | jq -er 'if .status=="source" and (.page_count | type)=="number" then .page_count else empty end' 2>/dev/null)
echo "cwd source: $SOURCE_ID, page_count: $PAGES"
```

`--source-only` 在返回安全的整数页面数之前，会校验 pretty 状态 schema、写入方、代码阶段成功、真实 worktree 路径、`.gbrain-source` 钉定，以及 gbrain 的注册路径。它不读任何页面。源为空或页面数为空是**未知**，不是零：报 WARN，且不要基于这个证据提议完整重建索引。如果 `PAGES` 被证明是 `0`，**并且**用户没传 `--no-code`，**并且**模式不是 `--full`，按前言里的格式发 AskUserQuestion：

> D1 — This repo has 0 indexed pages in gbrain. Run a full code reindex now?
>
> ELI10: gbrain 还没索引这个仓库的代码。在跑完整一遍之前，语义搜索工具（`gbrain search`、`code-def`、`code-refs`）什么也返回不了。大仓库大约要 25-35 分钟。
>
> Recommendation: A — 在索引完成前，brain 对代码搜索是不可用的，而本技能的步骤 2 已经确认 gbrain 配置正确。
>
> Note: options differ in kind, not coverage — no completeness score.
>
> A) Run /sync-gbrain --full now (recommended)
> B) Skip — I'll run it later

选 A：带上 `--full --code-only` 重新调用编排器。
选 B：记录了空语料状态，继续步骤 4。

---

## 步骤 3.5：调用图健康检查（提供 `--dream`）

`gbrain code-callers` / `code-callees`（谁调用这个 / 这个调用谁）会一直返回 `count: 0`，直到某次 `gbrain dream` 周期为这个源跑了 `resolve_symbol_edges` 阶段——步骤 2 的代码导入不做这件事。

**一项硬前提：** 构建调用图要求这个源当前的**schema pack 能提取代码符号**（`extract_atoms` 阶段）。在不声明该能力的 pack 上（例如 `gbrain-base` / `gbrain-base-v2`），`dream` 周期会完成，但 `resolve_symbol_edges` 匹配不到任何东西——不管你跑多少次，图都是空的。所以"构建调用图"只在能识别代码的 pack 上才有意义。`--dream` 阶段会检测这一点并如实报告（一条 WARN 行），而不是声称一次并未发生的构建。`code-def` / `code-refs` 同样需要符号提取；在非代码感知 pack 上，它们**不是**免费的"直接查询"。

一个源也可能完全不含代码页面，却报告一个健康的页面数（在 gstack 之外添加、用 gbrain 默认 markdown 策略同步的源）。在 gbrain 0.60 或更高版本里，对不可能存在的符号做 `code-def`，会通过 `.status` 回答：`ready`（该源持有代码）、`out_of_scope`（该源不含代码，所以 `--dream` 帮不上忙），或者在更老的 gbrain 或出错时什么都不给。

通过 doctor 的 `cycle_freshness` 检查、按字面匹配 cwd 的 `SOURCE_ID`，来检测这个源的调用图是否已构建。`doctor --fast` 会跳过承载该检查的数据库检查，所以这里读 `--scope=brain`（数据库检查，不走过技能）：

```bash
SOURCE_JSON=$(bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-gbrain-read-capability.ts --source-only 2>/dev/null)
SOURCE_ID=$(printf '%s' "$SOURCE_JSON" | jq -er 'if .status=="source" then .source_id else empty end' 2>/dev/null)
CYCLE=unknown
CYCLE_WHY=""
if [ -n "$SOURCE_ID" ]; then
  # doctor exits 1 when any check fails; its JSON report is still complete.
  CYCLE=$(gbrain doctor --json --scope=brain 2>/dev/null \
    | jq -er --arg id "$SOURCE_ID" '
        if type!="object" or has("error") then "unknown"
        else ([.checks[]? | select(.name=="cycle_freshness")][0]) as $c
          | if $c == null then "unexposed"
            elif $c.status=="ok" then "completed"
            else ((($c.message // "") / "; ") | map(select(index("\u0027" + $id + "\u0027"))) | .[0] // "") as $i
              | if ($i | index("never completed")) then "never"
                elif ($i | index("last cycled")) then "completed"
                else "unknown" end end end' 2>/dev/null || echo unknown)
  if [ "$CYCLE" = unexposed ]; then CYCLE=unknown; CYCLE_WHY="installed gbrain does not expose cycle_freshness"; fi
fi
# index() = literal substring (NOT test() regex), matching the lib reader in
# readCycleStatus(). A fail/warn that doesn't name this source → "unknown"
# (don't mask other-source failures).
echo "call graph for $SOURCE_ID: $CYCLE${CYCLE_WHY:+: $CYCLE_WHY}"
CODE_SCOPE=unknown
if [ -n "$SOURCE_ID" ]; then
  CODE_SCOPE=$(gbrain code-def ZzzGstackProbeSymbolThatCannotExist --source "$SOURCE_ID" --limit 1 2>/dev/null \
    | sed -n '/^[[:space:]]*{/,$p' | jq -r '.status // "unknown"' 2>/dev/null || echo unknown)
  case "$CODE_SCOPE" in ready|out_of_scope) ;; *) CODE_SCOPE=unknown ;; esac
fi
echo "code scope for $SOURCE_ID: $CODE_SCOPE"
```

如果 `CODE_SCOPE == out_of_scope`，不要提议构建：报告"this source holds no code pages (it syncs with gbrain's markdown strategy), so a call-graph build cannot help; re-sync it with `gbrain sync --strategy code --source <id>` to index its code"，然后继续步骤 4。

如果 `CYCLE == never` 且 `CODE_SCOPE` 是 `ready` 或 `unknown`，且用户没传 `--dream`/`--full`，且步骤 3 的 `PAGES > 0`，按前言里的格式发 AskUserQuestion：

> D2 — This repo's call graph isn't built. Build it now?
>
> ELI10: `gbrain code-callers`/`code-callees`（谁调用这个函数 / 它调用谁）在这个源跑过 `resolve_symbol_edges` 阶段之前什么也不返回。`gbrain dream --source <this source> --phase resolve_symbol_edges` 只跑那一个阶段（限定到这个 worktree 的代码，几分钟，不是完整约 35 分钟的维护周期）。只有当这个源的 schema pack 能提取代码符号时它才会产出图；如果不能，运行会完成但图仍是空的，dream 行会说明这一点。
>
> Recommendation: A — 在它跑之前调用图查询返回 0，而代码索引已经就位。如果 A 回来是一条 WARN（"pack does not extract code symbols"），修法是换一个能识别代码的 schema pack，而不是重跑 dream。
>
> Note: options differ in kind, not coverage — no completeness score.
>
> A) Run /sync-gbrain --dream now (recommended)
> B) Skip — I'll run it later

选 A：带上 `--dream --code-only` 重新调用编排器（跳过记忆 + brain-sync；dream 阶段仍会跑，因为它以 `--dream` 为条件）。然后报告 dream 阶段的**实际**行——`OK call graph built (N edges)` 还是一条 `WARN`，后者要说明图为什么仍然是空的（非代码感知 pack、缺嵌入密钥、或匹配到 0 条边）。**不要**在 WARN 上宣称成功。
选 B：记录"调用图未构建"状态供结论使用，继续步骤 4。

如果 `CYCLE == completed` 或 `unknown`，不要提示——但注意 `completed` 只表示某个周期跑过，不表示边存在（非代码感知 pack 会报 `completed` 而图是空的）。步骤 5 的结论行会展示真实状态。

---

## 步骤 4：刷新 CLAUDE.md 里的 `## GBrain Search Guidance` 块

能力检查：

```bash
bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-gbrain-read-capability.ts <user-args>
```

`<user-args>` 就是这次 /sync-gbrain 调用传给步骤 2 的那组已校验标志，原样不变（普通运行时为空）。这个助手不需要其他输入：跑一次并用它的 JSON 结果；不要先去翻它的源码或 gbrain CLI。

只有当成功代码同步的源和真实 worktree 与 `.gbrain-source` 相符、源注册指向那个 worktree、并且一次有界且限定源的 list/get 返回同一页面时，助手才会报 JSON `status: ready`。它从不创建或删除页面。一次 `get` 可能更新 gbrain 内部的检索元数据；保证的是不修改页面或源，而不是零内部写入。`status: unknown`（包括瞬时 CLI 错误、过期状态或未经核实的响应）**不是**brain 不可用的证据。对 `--no-code`、`--dry-run`、`--refresh-cache` 或 `--audit` 得到 `status: skipped` 表示没有尝试代码读取探测。不要跑写入探测、不要切换到别的源、也不要声称读成功。

然后根据助手的状态更新 CLAUDE.md：

**如果 `status=ready`** —— 写入或更新这个块。幂等：找到 HTML 注释分隔的块；存在就替换它的正文；不存在就追加到 CLAUDE.md 末尾。绝不重复。这个块是机器**无关**的（不含引擎、页面数、上次同步时间——那些在已有的 `## GBrain Configuration` 块里）。

块的原文内容（逐字复制）：

```markdown
## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

This worktree's pinned code source answered a source-scoped page read. This
does not verify semantic search or write availability. Prefer gbrain over Grep
when the question is semantic or when you don't know the exact identifier yet;
if a query fails, report that failure rather than assuming the index is healthy.

**This worktree is pinned to a worktree-scoped code source** via the
`.gbrain-source` file in the repo root (kubectl-style context).
`gbrain code-def`, `code-refs`, `code-callers`, `code-callees`, `search`, and
`query` from anywhere under this worktree route to that source by default —
no `--source` flag needed (gbrain >= 0.41.38.0; on older gbrain the call-graph
commands need `--source "$(cat .gbrain-source)"`). Conductor sibling worktrees
of the same repo each have their own pin and their own indexed pages, so
semantic results match the code on disk here.

Call-graph queries (`code-callers`/`code-callees`) also need the graph to be
built first. A `count: 0` has several causes, and only one is fixed by
`/sync-gbrain --dream` (or `--full`): the graph was never built. Check the others
first: the source may hold no code at all (`gbrain code-def <any-symbol>
--source <id>` answers `status: out_of_scope`), the symbol may be dotted (these
verbs take a bare name), or `--all-sources` was used. `--dream` also needs a
schema pack that extracts code symbols; on another pack it completes, the graph
stays empty and it reports a WARN. `code-def`/`code-refs` need the same
extraction.

Two indexed corpora available via the `gbrain` CLI:
- This worktree's code (auto-pinned via `.gbrain-source`).
- `~/.gstack/` curated memory (registered as `gstack-brain-<user>` source via
  the existing federation pipeline).

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-brain-<user>`

Grep is still right for known exact strings, regex, multiline patterns, and
file globs. Run `/sync-gbrain` after meaningful code changes; for ongoing
auto-sync across all worktrees, run `gbrain autopilot --install` once per
machine — gbrain's daemon handles incremental refresh on a schedule.

Safety: don't run `/sync-gbrain` while `gbrain autopilot` is active — the
orchestrator refuses destructive source ops when it detects a running autopilot
to avoid racing it. Prefer registering user repos with `gbrain sources
add --path <dir>` (no `--url`): URL-managed sources can auto-reclone, and the
sync code walk for them requires an explicit `--allow-reclone` opt-in.

<!-- gstack-gbrain-search-guidance:end -->
```

读一次 CLAUDE.md，算出它的新内容。替换目标是 `<!-- gstack-gbrain-search-guidance:start -->` 到 `<!-- gstack-gbrain-search-guidance:end -->` 的整个区域。如果这些标记不存在，就找 `## GBrain Search Guidance (configured by /sync-gbrain)` 标题，从那里替换到下一个 `## ` 或 EOF。如果连标题都没有，就把整个块追加到 CLAUDE.md 末尾。

**原子写入（唯一的写入路径；不要原地 Edit CLAUDE.md）：** 把完整的新内容写到旁边的 `CLAUDE.md.sync-gbrain.tmp`，然后用 `mv` 覆盖 CLAUDE.md，这样写到一半崩溃也不会留下半改的文件。在同一次 Bash 调用里验证块计数（和 `mv` 一起），然后进入步骤 5。

**如果 `status=unknown`** —— 保留现有的指引块（如果有），并把助手给出的原因作为 WARN 报告，建议在瞬时失败消失后重试 `/sync-gbrain` 或该读取检查。不要在未知道结果上安装新指引，也不要仅仅因为这次读取无法核实就删掉现有指引。`## GBrain Configuration` 块保持原位。

**如果 `status=skipped`** —— 指引保持不变。报告"这个模式没有探测代码就绪状态"，而不是报告它通过或失败。

如果 CLAUDE.md 缺失或不可写，**不要**崩溃——记一条警告然后继续。

---

## 步骤 5：结论块（幂等的 doctor 输出）

打印一个符合 `/setup-gbrain` 步骤 10 约定的状态块。每行是 `[OK]/[FIX]/[WARN]/[ERR]`。信息行复用 `gbrain doctor --json --fast`，但**不要**用 doctor 来卡住指引块（doctor 会因与代码搜索无关的原因失败）。

```
gbrain status: GREEN

  CLI ............. OK   <gbrain version>
  Engine .......... OK   <pglite|supabase>
  Capability ...... OK   source-scoped page read verified (no page/source mutation)
  CWD source ...... OK   <gstack-code-{repo_slug}> (page_count=<N>)
  Call graph ...... OK   <N> edges resolved (code-callers/callees live)
  ~/.gstack source. OK   <gstack-brain-{user}> (page_count=<N>) — managed by /setup-gbrain
  Memory sync ..... OK   <artifacts_sync_mode>
  Transcripts ..... OK   <recent|all> | INFO <off|not set>: skipped
  CLAUDE.md ....... OK   ## GBrain Search Guidance present
  Last sync ....... OK   <last_sync from state file>

Run `/sync-gbrain` again any time gbrain feels off; safe and idempotent.
```

**Call graph** 行报告可用的最有权威的信号：

1. **如果这次调用跑过 dream 阶段**（`--dream`，或 `--full` 自动构建），原样照抄它那一行——那是本次运行的事实：
   - `OK   <N> edges resolved (code-callers/callees live)`
   - `WARN dream ran but this source's schema pack does not extract code symbols
     — switch to a code-aware pack (\`gbrain schema use <pack>\`)`
   - `WARN dream ran but the embed phase failed (missing embedding key)`
   - `WARN dream ran but resolved 0 edges (no code symbols matched yet)`
2. **否则**退回步骤 3.5 的 `CYCLE` 值，用诚实的措辞（完成的周期只证明跑过周期，**不**证明边存在）：
   - `completed` → `OK   cycle complete — code-callers/callees live IF this source's pack extracts code symbols`
   - `never` → `WARN call graph not built — run /sync-gbrain --dream`
   - `unknown` → `WARN could not probe call graph (doctor unavailable) — run /sync-gbrain --dream if code-callers returns 0`

任何一条 `WARN` 的 Call graph 行都会把结论翻成 YELLOW。

如果任何行是 YELLOW 或 RED，结论行要说明，失败的行要给出一行下一步动作。未知的读取给出 `Capability ...... WARN source-scoped read unverified; guidance preserved — retry /sync-gbrain`，并把结论翻成 YELLOW，不是 RED。跳过的探测显示 `Capability ...... WARN  code read not probed in this mode; guidance unchanged`，并且不要打印 GREEN 的 capability 结论。`never`/`unknown` 的 Call graph 行会把结论翻成 YELLOW。

---

## 并发说明

这个技能在同一台机器的多个终端并发运行是安全的。编排器在任何状态文件或 CLAUDE.md 变更之前会在 `~/.gstack/.sync-gbrain.lock` 上取锁，如果另一次同步正在进行就以退出码 2 结束。过期锁（进程已死）会在 5 分钟后自动清除。

## 跨机器说明

`## GBrain Search Guidance` 块提交在仓库的 CLAUDE.md 里，随 `git push`/`git pull` 一起走——**不**经过 `~/.gstack/.brain-allowlist`（那只用于 `~/.gstack/` 的 brain-sync）。在另一台 CLAUDE.md 已同步但没有本地 gbrain 的机器上，/sync-gbrain 会报告未知读取，并保留这个块，而不是基于一次瞬时或本机局部的失败删掉已提交的指令。agent 绝不能把 unknown 当作 ready。

## 状态报告

以完成状态收尾（按前言协议）：
- **DONE** —— 所有阶段为绿、CLAUDE.md 指引块存在、结论为 GREEN。
- **DONE_WITH_CONCERNS** —— 同步跑过，但至少一个阶段失败，或能力读取未经核实。列出是哪些，并保留重试指引。
- **BLOCKED** —— 无法取得锁、gbrain 不在 PATH，或按仓库策略是 deny。说明阻塞点。
- **NEEDS_CONTEXT** —— /setup-gbrain 还没跑过，或 `gbrain doctor` 显示需要用户决策的状态（例如引擎迁移）。