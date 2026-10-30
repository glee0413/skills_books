---
id: gstack/setup-gbrain
title: setup-gbrain
description: 为一个编程智能体装好 gbrain：安装 CLI、初始化本地 PGLite 或 Supabase 大脑、注册 MCP，并按远端记录信任策略。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: setup-gbrain/SKILL.md
snapshotPath: source-snapshots/gstack/setup-gbrain/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /setup-gbrain — 为 gbrain 做编程智能体上手配置

你要在用户的机器上装好 gbrain（https://github.com/garrytan/gbrain），一个持久化的知识库，让当前这个编程智能体（通常是 Claude Code）既能以 CLI 调用它，也能以 MCP 工具调用它。

**范围上的诚实：** 本技能的 MCP 注册步骤（5a）用 `claude mcp add`，明确面向 Claude Code。其他本地宿主（Cursor、Codex CLI 等）仍会得到 PATH 上的 gbrain CLI —— 它们可以在配置完成后，自己在 MCP 配置里注册 `gbrain serve`。

**适用对象：** 本地机器（macOS、Linux、Windows）。openclaw/hermes 之类的智能体通常跑在各自带 gbrain 的云端 docker 容器里；要在它们和本地 Claude Code 之间“共享”一个大脑，只能通过共享 Postgres（Supabase）。

## 用户可调用
当用户输入 `/setup-gbrain` 时，运行本技能。调用模式：

- `/setup-gbrain` —— 完整流程（默认）
- `/setup-gbrain --repo` —— 只翻转当前仓库的 per-remote 策略
- `/setup-gbrain --switch` —— 只迁移引擎（PGLite ↔ Supabase）
- `/setup-gbrain --resume-provision <ref>` —— 重新进入此前被中断的
  Supabase 自动创建流程的轮询步骤
- `/setup-gbrain --cleanup-orphans` —— 列出并删除进行中的 Supabase 项目

调用参数由你自己解析 —— 这些只是给技能的散文提示，并没有实现成调度二进制。

---

## 分节索引 — 遇到对应情形时再读该节

本技能是一副决策树骨架。下面的步骤指向按需阅读的小节。做某一步之前先把对应小节整篇读完；不要凭记忆干活。

| 何时 | 读这一节 |
|------|-------------------|
| 执行 Step 1.5 的坏引擎修复 —— Step 1 的探测返回的 `gbrain_local_status` 是 `broken-db` 或 `broken-config`，且没有传任何快捷参数 | `sections/engine-remediation.md` |
| 在 Step 4 初始化大脑 —— 只运行 Step 2 所选路径（Paths 1/2a/2b/3/4 或 Switch）对应的流程（其中也包含 `--cleanup-orphans` 会复用的 PAT 授权范围披露） | `sections/brain-init.md` |
| 在 Paths 1、2a、2b 或 3 上执行 Step 7.5 的对话记录与记忆摄取门禁（Path 4 完全跳过本节 —— 见骨架里的跳过说明） | `sections/transcript-gate.md` |
| 把 Step 8 的 `## GBrain Configuration` 块持久化到 CLAUDE.md | `sections/claude-md-persist.md` |

---

## Step 1: 探测当前状态

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-detect
```

捕获 JSON 输出。它包含：`gbrain_on_path`、`gbrain_version`、`gbrain_config_exists`、`gbrain_engine`、`gbrain_doctor_ok`、`gbrain_mcp_mode`、`gstack_brain_sync_mode`、`gstack_brain_git`、`gstack_artifacts_remote`，以及 `gbrain_local_status` 字段（取值之一：`ok`、`no-cli`、`missing-config`、`broken-config`、`broken-db`、`engine-locked`、`timeout`、`db-unreachable`、`thin-client`）。把 `timeout` 当作 `ok` 处理（引擎慢但健康）—— 它绝不触发 Step 1.5 的修复。`db-unreachable` 同样处理：一次网络错误（离线沙箱、VPN 断开）在访问已配置的数据库时发生，配置没有变化，绝不能挪走；打印 `gbrain_local_status_detail` 然后继续。`thin-client` 也当作 `ok`：这台机器是远端 HTTP MCP 大脑的瘦客户端，按设计没有本地引擎 —— 依赖大脑的块照常渲染，探测 JSON 里带 `gbrain_thin_client: {probed: false}`（配置已验证；远端可达性在使用时检查，那里 gbrain 调用会优雅降级）。

跳过已经完成的下游步骤。用一行报告探测到的状态，让用户知道发现了什么：

> "Detected: gbrain v0.18.2 on PATH, engine=postgres, doctor=ok,
>  sync=artifacts-only. Nothing to install; jumping to the policy check."

在这里根据 `--repo`、`--switch`、`--resume-provision`、`--cleanup-orphans` 调用参数分支，跳到对应的步骤。

---

## Step 1.5: 本地引擎损坏的修复

从 Step 1 的探测输出里读 `gbrain_local_status`。**如果它是 `broken-db` 或 `broken-config`，且没有传快捷参数**，说明用户的本地引擎不可用 —— 在 Step 2 之前先跑下面的修复流程。

对于 `gbrain_local_status` 为 `no-cli` 或 `missing-config` 的情况，不要触发 Step 1.5 —— 直接落到 Step 2（在那里 `no-cli` 触发 Step 3 安装，`missing-config` 触发 Step 4 初始化）。这种情况下不要读修复小节。

> **STOP.** 在执行 Step 1.5 的坏引擎修复之前 —— Step 1 的探测返回的 `gbrain_local_status` 是 `broken-db` 或 `broken-config`，且没有传任何快捷参数，请阅读 `~/.claude/skills/gstack/setup-gbrain/sections/engine-remediation.md` 并完整执行。
> 不要凭记忆干活 —— 那一节才是这一步的事实源。

---

## Step 1.7: 代码智能方案的选择（索引的 Step 0）

你现在是在 /setup-gbrain 内部：用户点名要 gbrain，所以“用哪个检索方案”这个问题已经有答案了。绝不要在这里问，也绝不要让这一步拖延或带偏真正的配置流程。尽力记录这个选择，然后立刻继续 Step 2：

```bash
[ -f ~/.claude/skills/gstack/bin/gstack-code-intelligence ] \
  && bun --no-env-file --config=/dev/null ~/.claude/skills/gstack/bin/gstack-code-intelligence select gbrain 2>/dev/null \
  || true
```

下面的提议仪式只在本技能是从别的入口进来、且没有指定任何方案时适用（例如某个探索索引选项的路由技能）。即便那种情况也要注意：

- `"offer": false`，原因为 `bin-absent` → 已安装的 gstack 早于 code-intelligence CLI。完全跳过这一步，继续执行技能 —— 用户要的是 gbrain，那就装 gbrain。绝不要因为一个可选的缺失门禁就阻塞配置。

- `"offer": false`，原因为 `small-repo` → 这里的 grep 已经够快；用一行说明，并只在用户点名要 gbrain 时继续执行本技能。
- `"offer": false`，原因为 `provider-selected` 或 `declined` → 这台机器层面的问题已经回答过；静默沿用并继续。
- `"offer": true` → 通过 AskUserQuestion 把返回的选项呈现一次：
  **GBrain**（推荐 —— 语义记忆加代码，会把仓库内容发到你自己（YOUR）的 gbrain 数据库，按仓库征得同意）、**Sourcebot**（自托管的全库搜索，跑在 localhost 时即本地）、**Graphify**（本地 tree-sitter 图，任何东西都不出机器，由用户自行安装），或 **No indexing**。记录选择：`gstack-code-intelligence select <provider|none>` —— `none` 会持久化这次拒绝，今后任何仓库上都不会再有技能来问（重新启用：`gstack-code-intelligence select <provider>`）。本地计算类方案和远端发送类方案是两份独立的同意 —— 绝不打包在一起。
- 按仓库的发送同意（GBrain/Sourcebot）用
  `gstack-code-intelligence consent <repo> yes|no` 记录，并且总会被 gstack-gbrain-repo-policy 里的 `deny` 层级否决 —— 信任库是“代码能否离开某个仓库”的唯一权威。

如果用户选了 GBrain（或直接点名要本技能），继续往下。如果选了 Sourcebot/Graphify，运行 `gstack-code-intelligence index <repo>` 然后停止 —— 本技能剩下的部分都是 gbrain 专属的。

## Step 2: 选择一条路径（AskUserQuestion）

只在 Step 1 显示没有可用的现有配置、且没有传快捷参数时才触发。**特殊情况：** 如果探测输出里 `gbrain_mcp_mode=remote-http`，说明 HTTP MCP 已经注册 —— 直接跳到 Step 5a 验证（重新测试注册）以及 Step 6 之后，把这次运行当作幂等的。不要再问 Step 2。

问题标题："Where should your brain live?"

选项（按探测到的状态呈现）：

- **1 — Supabase，我已经有连接串。** 云端智能体用户，openclaw/hermes 已经为他们建好了一个。从 Supabase 控制台粘贴 Session Pooler URL（Settings → Database → Connection Pooler → Session）。*提示词里要带上的信任面提醒：*“粘贴这个 URL 就等于让你的本地 Claude Code 对你的云端智能体能看到的每一页都拥有完整读写权限。如果这不是你想要的信任级别，改选 PGLite 本地，并接受两个大脑彼此隔离。”
- **2a — Supabase，自动创建新项目。** 需要一个 Supabase Personal Access Token（约 90 秒）。团队共享大脑的最佳选择。
- **2b — Supabase，手动创建。** 你自己走完 supabase.com 的注册流程；准备好后把 URL 粘回来。
- **3 — PGLite 本地。** 零账号，约 30 秒。只在这台机器上的隔离大脑。最适合先试试。
- **4 — 远端 gbrain MCP。** 别人（或你的另一台机器）已经在用 HTTP 传输跑 `gbrain serve`。你粘贴 MCP URL 加一个 bearer 令牌；本技能把它注册为你的 MCP。不需要本地大脑数据库，也不需要本地安装。当大脑跨机器共享或由队友运行时推荐这一项。
- **Switch**（只在 Step 1 探测到已有引擎时）："You already have a
  `<engine>` brain. Migrate it to the other engine?" → 运行
  `gbrain migrate --to <other>`，外面包一层 `timeout 180s`。

不要静默替用户选；触发 AskUserQuestion。

---

## Step 3: 安装 gbrain CLI（如果缺失）

**在 Path 4（Remote MCP）上完全跳过。** Path 4 不需要本地 gbrain 二进制 —— 所有调用都通过 MCP 到远端服务器。跳到 Step 4（Path 4 子节）。

对 Paths 1、2a、2b、3、switch —— 只在 `gbrain_on_path=false` 时：

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-install
```

安装器会先复用已有的 checkout（探测 `~/git/gbrain`、`~/gbrain`），然后校验 PATH 遮蔽（链接后的 `gbrain --version` 必须与安装目录的 `package.json` 一致）。PATH 遮蔽失败时安装器以状态码 3 退出，并给出清楚的修复菜单；把完整输出呈现给用户然后停下（STOP）。不要继续执行技能 —— 在用户修好 PATH 之前，环境是坏的。

---

## Step 4: 初始化大脑

路径相关。Step 2 所选路径的初始化流程 —— Paths 1、2a、2b、3、4（4a-4e），以及 Switch 迁移流程 —— 都在 brain-init 小节里。只运行所选路径对应的子节。

> **STOP.** 在 Step 4 初始化大脑之前 —— 只运行 Step 2 所选路径对应的流程（Paths 1/2a/2b/3/4 或 Switch；其中也包含 `--cleanup-orphans` 会复用的 PAT 授权范围披露），请阅读 `~/.claude/skills/gstack/setup-gbrain/sections/brain-init.md` 并完整执行。
> 不要凭记忆干活 —— 那一节才是这一步的事实源。

---

## Step 5: 验证 gbrain doctor

**在 Path 4（Remote MCP）上完全跳过。** 大脑宿主自己跑 doctor；我们没有本地数据库访问权限来做内省。Step 4c 的验证往返已经证明服务器可达、已鉴权、且 MCP 版本兼容。

对 Paths 1、2a、2b、3、switch：

```bash
doctor=$(gbrain doctor --json)
status=$(echo "$doctor" | jq -r .status)
```

如果状态是 `ok` 或 `warnings`，继续。其他任何值 → 呈现完整的 doctor 输出然后停下（STOP）。

---

## Step 5a: 把 gbrain 注册为 Claude Code MCP

只在 `which claude` 能解析时执行。问： "Give Claude Code a typed tool surface
for gbrain? (recommended yes)"

注册形式取决于 Step 2 所选的路径：

### Path 4（Remote MCP —— 带 bearer 的 HTTP 传输）

拆掉任何先前的注册（可能是旧配置留下的 local-stdio，也可能是令牌已轮换的过期 remote-http），然后在用户作用域上用 HTTP + bearer 注册：

```bash
claude mcp remove gbrain -s user 2>/dev/null || true
claude mcp remove gbrain 2>/dev/null || true
claude mcp add --scope user --transport http gbrain "$MCP_URL" \
  --header "Authorization: Bearer $GBRAIN_MCP_TOKEN"
unset GBRAIN_MCP_TOKEN  # zero from process env after registration
claude mcp list | grep gbrain  # verify: should show "✓ Connected"
```

**令牌存储说明：** `claude mcp add --header "Authorization: Bearer ..."`
会在进程启动期间把 bearer 放进 argv，约 10ms 内对 `ps` 可见。令牌的常驻位置是 `~/.claude.json`（模式 0600 —— Claude Code 自己为每个 MCP 服务器提供的凭据面）。这个取舍记录在 `setup-gbrain/memory.md`。如果未来的 Claude Code 版本为 headers 增加了 stdin 或环境变量输入形式，就改用它。

### Paths 1、2a、2b、3（本地 stdio）

在**用户作用域**注册，并使用指向 gbrain 二进制的**绝对路径**。用户作用域让 MCP 在这台机器的每个 Claude Code 会话里都可用，而不只是当前工作区。绝对路径避免了 Claude Code 以子进程方式拉起 `gbrain serve` 时的 PATH 解析问题。

在 Windows（Git Bash/MSYS）上，`gbrain.exe` 的 binstub 会在新控制台里启动 bun，于是每个 Claude Code 会话都会为这个 MCP 弹出可见终端。改为注册 `bun.exe` 加 gbrain 的入口，它会附到 Claude Code 的隐藏控制台上。若没有这些文件，就用完整文件名注册 `gbrain.exe`，因为 Claude Code 不会给存储的路径补 `.exe`。

```bash
GBRAIN_BIN=$(command -v gbrain)
[ -z "$GBRAIN_BIN" ] && GBRAIN_BIN="$HOME/.bun/bin/gbrain"
claude mcp remove gbrain -s user 2>/dev/null || true
claude mcp remove gbrain 2>/dev/null || true
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    BUN_ROOT="${BUN_INSTALL:-$HOME/.bun}"
    GBRAIN_ENTRY="$BUN_ROOT/install/global/node_modules/gbrain/src/cli.ts"
    if [ -f "$BUN_ROOT/bin/bun.exe" ] && [ -f "$GBRAIN_ENTRY" ]; then
      claude mcp add --scope user gbrain -- "$BUN_ROOT/bin/bun.exe" "$GBRAIN_ENTRY" serve
    else
      claude mcp add --scope user gbrain -- "$BUN_ROOT/bin/gbrain.exe" serve
    fi
    ;;
  *)
    claude mcp add --scope user gbrain -- "$GBRAIN_BIN" serve
    ;;
esac
claude mcp list | grep gbrain  # verify: should show "✓ Connected"
```

在本地 PGLite 大脑上，如果某个已打开的 Claude Code 会话的 gbrain 持有数据库的单写锁，`claude mcp list` 可能显示 `Failed to connect`。只要那个会话里 `mcp__gbrain__*` 工具能用，注册就是好的。

### 两条路径共同的部分

如果 `claude` 不在 PATH 上：输出 "MCP registration skipped — this skill is
Claude-Code-targeted; register `gbrain serve` (or your remote MCP URL) in
your agent's MCP config manually." 然后继续到 step 6。

**给用户的提醒：** 已经打开的 Claude Code 会话在重启前不会接上新 MCP 工具。告诉他们： "Restart any open
Claude Code sessions to see `mcp__gbrain__*` tools — they're loaded at
session start, not mid-session."

---

## Step 6: Per-remote 策略（带门禁的仓库导入）

如果我们处在一个带 `origin` 远端的 git 仓库里，检查策略：

```bash
current_tier=$(~/.claude/skills/gstack/bin/gstack-gbrain-repo-policy get)
```

分支：
- `read-write` → 导入本仓库：`gbrain import "$(pwd)" --no-embed`，然后在后台跑
  `gbrain embed --stale &`。
- `read-only` → 完全跳过导入（这个层级由未来的自动导入钩子 + gbrain 解析器注入来执行，不在这里）。
- `deny` → 什么都不做。
- `unset` → AskUserQuestion: "How should `<normalized-remote>` interact with
  gbrain?"
  - `read-write` —— 智能体可以从这个仓库搜索并写入新页面
  - `read-only` —— 智能体可以搜索，但永不写入
  - `deny` —— 完全不交互
  - `skip-for-now` —— 不持久化，下次再问

  得到答复后（skip-for-now 除外）：
  ```bash
  ~/.claude/skills/gstack/bin/gstack-gbrain-repo-policy set "$REMOTE" "$TIER"
  ```
  然后当且仅当为 `read-write` 时导入。

如果在 git 仓库之外，或者没有 origin 远端：带一句说明跳过这一步。

对于 `/setup-gbrain --repo` 调用，只执行 Step 6 然后退出。

---

## Step 7: 提议 artifacts 同步并接入 gbrain

行为对话记录的摄取是另一个独立步骤（7.5）。

另起一个 AskUserQuestion: "Also sync your gstack artifacts (CEO plans,
designs, reports, retros) to a private git repo that gbrain can index
across machines?"

选项：
- Yes, full sync（所有允许清单内的内容）
- Yes, artifacts-only（计划、设计、复盘 —— 跳过行为数据）
- No thanks

如果选是，运行 artifacts-init 助手。它会请用户选一个 git 宿主（GitHub 经 `gh`、GitLab 经 `glab`，或手动粘贴 URL），创建 `gstack-artifacts-$USER`（私有），并把规范的 HTTPS URL 写到 `~/.gstack-artifacts-remote.txt`。传入 Step 4c 验证输出里的 `--url-form-supported`（Path 4），或传 `false`（Paths 1/2/3 —— 本地模式不做探测）：

```bash
URL_FORM=${URL_FORM_SUPPORTED:-false}
~/.claude/skills/gstack/bin/gstack-artifacts-init --url-form-supported "$URL_FORM"
~/.claude/skills/gstack/bin/gstack-config set artifacts_sync_mode artifacts-only
# or "full" if user picked yes-full
```

`gstack-artifacts-init` 最后总会打印一个 "Send this to your brain admin" 块，里面是确切的 `gbrain sources add` 命令。本技能从不自动执行服务端的 gbrain 命令；即便用户本人就是大脑管理员，复制粘贴打印出来的命令也是一致的交互体验。

### Path 4（Remote MCP）—— artifacts-init 之后即完成

在远端模式下，本地 `gstack-gbrain-source-wireup` 助手**不会**运行（它会去调本地 `gbrain` CLI，而 Path 4 并不安装它）。改由大脑管理员在大脑宿主上运行打印出来的命令。跳到 Step 7.5。

### Paths 1、2a、2b、3（本地 stdio）—— 接上联邦源

然后把 artifacts 仓库接入 gbrain，让它的内容可从任何 gbrain 客户端搜索。这个助手会创建 `~/.gstack/` 的一个 `git worktree`，通过 `gbrain sources add --path
--federated` 把它注册为联邦源，并运行一次初始的 `gbrain sync`。仅限 local-stdio 路径。

先从 `~/.gbrain/config.json` 里取出数据库 URL 并显式传入，这样即使其他进程在同步中途改写 `~/.gbrain/config.json`（例如机器上别处并发运行的 `gbrain init`），wireup 依然稳健：

```bash
GBRAIN_URL=$(python3 -c "
import json, os, sys
try:
    c = json.load(open(os.path.expanduser('~/.gbrain/config.json')))
    print(c.get('database_url', ''))
except Exception:
    pass
")
~/.claude/skills/gstack/bin/gstack-gbrain-source-wireup --strict \
  ${GBRAIN_URL:+--database-url "$GBRAIN_URL"}
```

`--strict` 在缺少前置条件（gbrain 未安装、低于 0.18.0、或还没有 `~/.gstack/.git`）时以非零状态退出，好让用户看到失败，而不是悄悄留下一个没接线的脑子。非零退出时，呈现助手的输出并按技能规则停下（STOP）—— 在修好前置条件之前，跨机器搜索不会工作。

---

## Step 7.5: 对话记录摄取的同意

**在 Path 4（Remote MCP）上完全跳过。** 对话记录摄取会去调本地 `gbrain` CLI，而 Path 4 并不安装它。远端模式用户依赖大脑服务器自己的摄取节奏 —— 如果你的大脑管理员想索引这台机器的对话记录，就从你的 `gstack-artifacts-$USER` 仓库（Step 7 中建立）按他们喜欢的节奏拉取。这里不要替用户保存对话记录模式；对话记录保持跳过，直到用户自己选择（`/sync-gbrain` 会问）。继续到 Step 8。

对 Paths 1、2a、2b、3，运行摄取门禁：

> **STOP.** 在 Paths 1、2a、2b 或 3 上执行 Step 7.5 的对话记录与记忆摄取门禁之前（Path 4 完全跳过本节 —— 见骨架里的跳过说明），请阅读 `~/.claude/skills/gstack/setup-gbrain/sections/transcript-gate.md` 并完整执行。
> 不要凭记忆干活 —— 那一节才是这一步的事实源。

---

## Step 8: 把 `## GBrain Configuration` 持久化到 CLAUDE.md

CLAUDE.md 就是审计轨迹：配置成功后，把配置块持久化进去。确切的块格式（remote-http 与 local-stdio）在 claude-md-persist 小节里。搜索指引块只由 `/sync-gbrain` 写入（Step 10 会提议它）。

> **STOP.** 在把 Step 8 的 `## GBrain Configuration` 块持久化到 CLAUDE.md 之前，请阅读 `~/.claude/skills/gstack/setup-gbrain/sections/claude-md-persist.md` 并完整执行。
> 不要凭记忆干活 —— 那一节才是这一步的事实源。

---

## Step 9: 冒烟测试

### Path 4（Remote MCP）

`mcp__gbrain__*` 工具在会话中途不可见 —— 它们在 Claude Code 会话启动时加载。所以同一次技能运行里的实测冒烟测试只有信息价值：打印出用户重启 Claude Code 后可以运行的等价 curl 命令。Step 4c 的验证往返已经证明服务器可达、已鉴权、MCP 版本兼容，所以我们不再重复测试那一点。

打印到 stdout：

```
After restarting Claude Code, the `mcp__gbrain__*` tools become callable.
Smoke test: ask the agent to run `mcp__gbrain__search` with any query
("test page" works). You should see a JSON list of pages.

To verify from the shell right now (without waiting for restart):
  curl -s -X POST -H 'Content-Type: application/json' \
       -H 'Accept: application/json, text/event-stream' \
       -H 'Authorization: Bearer <YOUR_TOKEN>' \
       -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
       <YOUR_MCP_URL>
```

不要在 curl 命令里打印真实令牌 —— 保留占位符 `<YOUR_TOKEN>`，这样这段片段可以安全地复制到聊天里或分享出去。

### Paths 1、2a、2b、3（本地 stdio）

```bash
SLUG="setup-gbrain-smoke-test-$(date +%s)"
SMOKE_PAGE=$(mktemp "${TMPDIR:-/tmp}/gstack-gbrain-smoke.XXXXXX")
echo "Set up on $(date). Smoke test for /setup-gbrain." > "$SMOKE_PAGE"
gbrain put "$SLUG" < "$SMOKE_PAGE"; PUT_RC=$?
rm -f "$SMOKE_PAGE"
[ "$PUT_RC" -eq 0 ] && gbrain search "smoke test" | grep -i "$SLUG"
```

确认往返可用。页面从临时文件输入，而不是管道：在 Windows 上，gbrain 读取管道输入会失败。失败时，呈现 `gbrain doctor --json` 输出并以 NEEDS_CONTEXT 升级停下（STOP）。

---

## Step 9.5: 大脑信任策略

大脑信任策略控制 gstack 是否自动推送 `~/.gstack/` 下的产物、以及是否把校准判断写回这个大脑。它是按端点区分的：同时拥有本地 PGLite（个人）和团队远端 MCP（共享）的用户，两份策略分别跟踪。

探测当前端点哈希与当前策略：

```bash
_HASH=$(~/.claude/skills/gstack/bin/gstack-config endpoint-hash 2>/dev/null)
_POLICY=$(~/.claude/skills/gstack/bin/gstack-config get brain_trust_policy@$_HASH 2>/dev/null || echo unset)
echo "ENDPOINT_HASH: $_HASH"
echo "BRAIN_TRUST_POLICY: $_POLICY"
```

按传输方式与当前策略分支：

**如果 `_POLICY` 是 `personal` 或 `shared`：** 策略已设定。打印 "Trust policy for this endpoint: $_POLICY" 并跳到 Step 10。

**如果 `_POLICY` 是 `unset` 且 `_HASH == "local"`：** 自动设为 personal（本地引擎天然单租户）。不用 AskUserQuestion。

```bash
~/.claude/skills/gstack/bin/gstack-config set brain_trust_policy@$_HASH personal
echo "Trust policy auto-set to 'personal' for local PGLite (single-tenant by construction)."
```

**如果 `_POLICY` 是 `unset` 且 `_HASH != "local"`（远端 MCP）：** 通过 AskUserQuestion 问信任策略问题：

> 这个 MCP 端点上的大脑 —— 是你个人的大脑，还是
> 共享/团队的大脑？
>
> Personal：gstack 会自动推送 ~/.gstack/ 下的产物（CEO 计划、设计
> 文档、复盘、经验），并在你做决策时把校准判断写回。你的大脑
> 每个会话都会变得更聪明。如果这个大脑是你一个人配的，就选它。
>
> Shared/team：默认只读。gstack 会读上下文，但任何写入前都会
> 先问。对于不该被个人判断污染共享语料的大脑更安全。

选项：
- A) Personal（自托管远端大脑推荐）
- B) Shared/team

答复后持久化：

```bash
~/.claude/skills/gstack/bin/gstack-config set brain_trust_policy@$_HASH <personal|shared>
```

如果选了 `personal` 且 `artifacts_sync_mode` 仍是 `off`，也把它默认设为 `full`（个人大脑自动推送）：

```bash
_CURRENT_SYNC=$(~/.claude/skills/gstack/bin/gstack-config get artifacts_sync_mode 2>/dev/null || echo off)
if [ "$_CURRENT_SYNC" = "off" ]; then
  ~/.claude/skills/gstack/bin/gstack-config set artifacts_sync_mode full
  echo "artifacts_sync_mode auto-set to 'full' (personal brain default)."
fi
```

向后兼容：`artifacts_sync_mode_prompted` 已经是 `true` 的既有用户保留他们的答案；这个门禁只对新端点或升级后首次运行的用户触发。

## Step 10: GREEN/YELLOW/RED 结论块（幂等的 doctor 输出）

Step 1-9 完成后，做总结。在已配置的机器上重跑 `/setup-gbrain` 是一等的 doctor 路径：每一步都探测现有状态，只修缺失的部分，然后在这里汇报。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
~/.claude/skills/gstack/bin/gstack-gbrain-detect 2>/dev/null || true
~/.claude/skills/gstack/bin/gstack-config has transcript_ingest_mode && echo "transcript_ingest_mode: $(~/.claude/skills/gstack/bin/gstack-config get transcript_ingest_mode)" || echo "transcript_ingest_mode: not set"
~/.claude/skills/gstack/bin/gstack-config get artifacts_sync_mode 2>/dev/null || echo "off"
[ -f "$GSTACK_STATE_ROOT"/.gbrain-sync-state.json ] && cat "$GSTACK_STATE_ROOT"/.gbrain-sync-state.json || echo "{}"
```

从探测输出里读 `gbrain_mcp_mode`，选对结论模板。每一行是 `[OK]/[FIX]/[WARN]/[ERR]`。

### Path 4（Remote MCP）

```
gbrain status: GREEN  (mode: remote-http)

  MCP ............. OK   {SERVER_NAME} v{SERVER_VERSION} at {MCP_URL}
  Auth ............ OK   bearer accepted (verified via /tools/list)
  Engine .......... N/A  remote mode
  Doctor .......... N/A  remote mode (brain admin runs `gbrain doctor`)
  Repo policy ..... OK   {read-write|read-only|deny}
  Artifacts repo .. OK   {gstack_artifacts_remote URL}
  Artifacts sync .. OK   {artifacts_sync_mode}
  Transcripts ..... OK   {recent|all}: route to artifacts repo → remote brain | INFO {off|not set}: skipped
  Code search ..... {OK local-pglite (~/.gbrain/pglite) | N/A declined at Step 4d}
  CLAUDE.md ....... OK
  Smoke test ...... INFO printed for post-restart manual verification

Restart Claude Code to pick up the `mcp__gbrain__*` tools.
Re-run `/setup-gbrain` any time the bearer rotates or the URL moves.
```

**Code search** 行反映 Step 4d 的选择：
- 如果用户选了 A（Yes）：`OK local-pglite`，此后 `gbrain_local_status == "ok"`。
- 如果用户选了 B（No）：`N/A declined at Step 4d` —— 执行 `gstack-config set local_code_index_offered true` 以关闭未来的迁移提醒。

**Transcripts** 行：在 remote-http 模式下，gstack-memory-ingest 把暂存的对话记录写到 `~/.gstack/transcripts/run-<pid>-<ts>/`，gstack-brain-sync 把它们推到 artifacts 仓库；大脑管理员的拉取任务再把它们索引进远端大脑。本地 PGLite（如果存在）保持仅用于代码。

### Paths 1、2a、2b、3（本地 stdio）

```
gbrain status: GREEN  (mode: local-stdio)

  CLI ............. OK   <gbrain version>
  Engine .......... OK   <pglite|supabase> at <path>
  doctor .......... OK
  MCP ............. OK   registered (user scope)
  Repo policy ..... OK   <read-write|read-only|deny>
  Code import ..... OK   <last_imported_head>
  Artifacts sync .. OK   <artifacts_sync_mode> to <remote>
  Transcripts ..... OK   <recent|all>: <N> sessions, last ingest <when> | INFO <off|not set>: skipped
  CLAUDE.md ....... OK
  Smoke test ...... OK   put → search round-trip

Run `/setup-gbrain` again any time gbrain feels off; it's safe and idempotent.
```

对话记录模式为 `not set` 不算失败：对话记录会一直跳过，直到用户做出选择，而 `/sync-gbrain` 会问。

如果任何一行是 YELLOW 或 RED，结论行会说明，失败的行会给出一句话的“下一步动作”（例如
`Engine .......... ERR  PGLite corrupt — re-import from a clone of your brain remote with \`gbrain import\``）。
没有自动恢复：在启用 brain-sync 的情况下，大脑远端以 markdown + git 保存着经过整理的内容，可以从克隆用 `gbrain import` 恢复。

### 下一步：`/sync-gbrain`

本技能不写 CLAUDE.md 里的 `## GBrain Search Guidance` 块；等本仓库的代码索引能响应一次读取后，由 `/sync-gbrain` 写入。除非结论是 RED，否则 AskUserQuestion: "Run `/sync-gbrain` now to index this
repo and add the search guidance to CLAUDE.md?" A) 现在就运行（阅读并遵循 sync-gbrain 技能）B) 稍后。如果选 B，或 `SESSION_KIND: spawned` 或 `headless`，以点名 `/sync-gbrain` 作为下一步收尾。

---

## `/setup-gbrain --cleanup-orphans`

重新收集一次 PAT（展示 Path 2a 的 PAT 授权范围披露 —— 它在 brain-init 小节里；如果还没加载就去读那一节），然后用密钥读取助手收集它，并列出用户的 Supabase 项目。PAT 通过用户粘贴读入环境变量；绝不把它敲进命令里：

```bash
# We don't rely on a stored PAT.
. ~/.claude/skills/gstack/bin/gstack-gbrain-lib.sh
read_secret_to_env SUPABASE_ACCESS_TOKEN "Paste PAT: " || exit 1
projects=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects)
```

解析响应，找出任何名字以 `gbrain` 开头、且 `ref` 与用户当前 `~/.gbrain/config.json` 里 pooler URL 不匹配的项目。对每个孤儿项目单独 AskUserQuestion: "Delete orphan project
`<ref>` (`<name>`, created `<created_at>`)?" —— 绝不批量；逐项目确认是一扇单向门。

确认删除后：
```bash
curl -s -X DELETE -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/$REF
```

没有第二次显式确认，绝不删除正在使用的大脑。

结束时：`unset SUPABASE_ACCESS_TOKEN`。提醒吊销事宜。

---

## 遥测

前言的 Telemetry 块在退出时记录技能成功/失败。发出事件时，把这些枚举型分类值加到遥测负载里（安全 —— 没有自由文本密钥，绝不含 URL 或 PAT）：

- `scenario`: `supabase-existing` | `supabase-auto-provision` |
  `supabase-manual` | `pglite-local` | `switch-to-supabase` |
  `switch-to-pglite` | `repo-flip-only` | `cleanup-orphans` |
  `resume-provision`
- `install_performed`: `yes` | `no`（复用了已有 checkout） | `skipped`（此前已存在）
- `mcp_registered`: `yes` | `no` | `claude-missing`
- `trust_tier_set`: `read-write` | `read-only` | `deny` |
  `skip-for-now` | `n/a`（在 git 仓库之外）

绝不把 `SUPABASE_ACCESS_TOKEN`、`DB_PASS`、`GBRAIN_POOLER_URL`、`GBRAIN_DATABASE_URL` 或任何 `postgresql://` 子串传进遥测调用。

---

## 重要规则

- **所有密钥守同一条规则。** PAT、DB_PASS、pooler URL：只走环境变量，绝不走 argv，绝不记录日志，绝不由我们持久化到磁盘。唯一长期保存 pooler URL 的文件是 `~/.gbrain/config.json`，由 gbrain 自己的 `init` 以 0600 模式写入 —— 那是 gbrain 的纪律，不是我们的。
- **STOP 点是硬性的。** Gbrain doctor 不健康、安装器 PATH 遮蔽、migrate 超时、冒烟测试失败 —— 每一个都是 STOP。不要糊过去。
- **并发运行锁。** 技能启动时，先创建父目录再原子地获取锁。保留 mkdir 的错误输出；父目录缺失和文件系统故障并不是有竞争运行的证据：

  ```bash
  GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
  if ! mkdir -p "$GSTACK_STATE_ROOT"; then
    echo "ERROR: Cannot create setup-gbrain lock parent $GSTACK_STATE_ROOT." >&2
    exit 1
  fi
  if ! mkdir "$GSTACK_STATE_ROOT"/.setup-gbrain.lock.d; then
    if [ -d "$GSTACK_STATE_ROOT"/.setup-gbrain.lock.d ]; then
      echo "Another /setup-gbrain instance is running. Wait for it, or remove $GSTACK_STATE_ROOT/.setup-gbrain.lock.d only if you are sure it is stale." >&2
    else
      echo "ERROR: Cannot acquire setup-gbrain lock." >&2
    fi
    exit 1
  fi
  ```

  在正常退出时以及其他 SIGINT trap 中释放已获取的锁。
- **CLAUDE.md 是审计轨迹。** 配置成功后始终在 Step 8 更新它。