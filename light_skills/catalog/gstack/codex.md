---
id: gstack/codex
title: codex
description: 包装 OpenAI Codex CLI，以审查、挑战、咨询三种模式获取来自另一个 AI 系统的独立第二意见。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: codex/SKILL.md
snapshotPath: source-snapshots/gstack/codex/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /codex — 多 AI 第二意见

你正在运行 `/codex` 技能。它包装 OpenAI Codex CLI，用来从另一个 AI 系统拿到一份独立、不留情面的第二意见。

Codex 就是那个“200 智商的自闭症开发者”——直接、简短、技术上精确，会挑战假设，能抓到你可能会漏掉的东西。要原样呈现它的输出，不要总结。

---

## 章节索引——遇到对应情形时再读取

这个技能是一套决策树骨架。下面的步骤会指向按需读取的章节。执行某一步之前，先把对应章节完整读完；不要凭记忆做事。

| 时机 | 读取这一节 |
|------|-------------------|
| 运行审查模式（步骤 2A）——步骤 1 的分派选择了审查（`/codex review`，或用户选了“Review the diff”） | `sections/review-mode.md` |
| 运行挑战模式（步骤 2B）——步骤 1 的分派选择了对抗性挑战（`/codex challenge`，或用户选了“Challenge the diff”） | `sections/challenge-mode.md` |
| 运行咨询模式（步骤 2C）——步骤 1 的分派选择了咨询（自由提问、计划审查，或对本次会话的追问） | `sections/consult-mode.md` |

---

## 步骤 0.4：检查 codex 可执行文件

```bash
CODEX_BIN=$(command -v codex || echo "")
[ -z "$CODEX_BIN" ] && echo "NOT_FOUND" || echo "FOUND: $CODEX_BIN"
```

如果输出 `NOT_FOUND`：停下来并告诉用户：
“Codex CLI not found. Install it: `npm install -g @openai/codex` or see https://github.com/openai/codex”

如果是 `NOT_FOUND`，还要记录这一事件：
```bash
~/.claude/skills/gstack/bin/gstack-codex-probe log-event codex_cli_missing 2>/dev/null || true
```

---

## 步骤 0.5：认证探测 + 模型探测 + 版本检查

在构建昂贵的提示词之前，先确认 Codex 有有效认证、账号确实**能使用** gstack 选定的模型，并且所安装的 CLI 版本不在已知问题列表里。`gstack-codex-probe` 是共享辅助程序，`/codex`、`/autoplan` 以及每一次外部审查都以命令形式运行它，每项检查对应一个子命令。

模型顺序：用户为本次请求点名的模型、`GSTACK_CODEX_MODEL`、Codex `config.toml` 里的 `model`（`codex review` 时优先 `review_model`；会尊重 `$CODEX_HOME`），最后是 `gpt-6-astra`。每次调用都先打印 `CODEX_MODEL: <model> (<kind>; source: ...)`。对于被点名的模型，要在每一次 `select-model`、`probe-model` 和 `role-ready` 调用里加上 `--model '<model>'`，包括下面的探测。无效或不可用的选择会带着修复信息停止，绝不回落到默认值；被点名的模型也优先于角色。只有在明确指定 `--role plan-review` 时（例如 `/codex challenge --role plan-review`），才在下面和模式块里设置 `_CODEX_ROLE='plan-review'`；模式块随后在自己的超时预算内探测并分派策略模型。参见[策略配置](https://github.com/garrytan/gstack/blob/main/docs/model-policy.md)。

**努力级别参数，进入模式前先读：** `--effort <level>`、`--effort=<level>` 或 `--xhigh`（等于 `--effort xhigh`），紧跟 `/codex` 或其模式词之后、位于其前导参数（`-m`、`--model`、`--role`）之中且在任何提示词文本之前，会设置 `<effort-level>`（否则为 `''`）；在步骤 1 之前把它们移除。后面出现的 `--effort` 属于提示词文本；如果它后面跟着级别词，要说明这一点。缺少取值、不是一个全小写单词，或者出现互相冲突的级别：停下，列出这些级别；什么都不会发送。

```bash
_CODEX_PROBE=~/.claude/skills/gstack/bin/gstack-codex-probe
_CODEX_ROLE=''
[ -x "$_CODEX_PROBE" ] || { echo "HELPER_UNAVAILABLE"; exit 1; }
"$_CODEX_PROBE" check-effort high --request '<effort-level>' >/dev/null || exit 1   # free

# GSTACK_ACTIVE_HOST names the harness, never the model.
if { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  echo 'Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage.' >&2
  if { [ -n "${CLAUDECODE:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = claude ]; } && { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
    echo 'Inherited harness markers conflict. Run setup --host <actual-harness> (claude or codex); do not guess a replacement provider.' >&2
  else
    echo 'Repair installed skills: run setup --host codex from your gstack checkout.' >&2
  fi
  exit 78
fi
if ! "$_CODEX_PROBE" check-auth >/dev/null; then
  "$_CODEX_PROBE" log-event codex_auth_failed
  echo "AUTH_FAILED"
elif "$_CODEX_PROBE" check-sandbox && [ -z "$_CODEX_ROLE" ]; then   # free; Linux only
  "$_CODEX_PROBE" probe-model exec   # ~10s round trip on first run, cached 1h
fi
"$_CODEX_PROBE" check-version   # warns if known-bad, non-blocking
```

如果 `check-effort` 失败，转述它的输出行然后停止；此时没有发出任何 Codex 调用。

如果运行时守卫报告 harness 不匹配，停止。外部覆盖不可用。用 `./setup --host codex` 修复；不要默默换成别的提供方，也不要强行在同一 harness 内调用。

如果输出包含 `HELPER_UNAVAILABLE`，停止：本次安装里 `gstack-codex-probe` 缺失或不可执行。告诉用户重新运行 `./setup`（或 `/gstack-upgrade`）。

如果输出包含 `AUTH_FAILED`，停下来并告诉用户：
“No Codex authentication found. Run `codex login` or set `$CODEX_API_KEY` / `$OPENAI_API_KEY`, then re-run this skill.”

如果输出包含 `MODEL_UNUSABLE`，停止——所选模型（在 `CODEX_MODEL:` 行里连同来源一起点名）无效，或账号无权使用。转述探测输出的 HINT 行，并按下文 `## Error Handling` 中“模型不受支持（HTTP 400 或 404）”的恢复步骤处理。硬着头皮跑各模式，只会在同一个 400 上烧掉四次调用。

如果输出包含 `MODEL_QUOTA_EXHAUSTED`，停止：账号撞上了 Codex 用量上限。原样转述标记下方 Codex 自己的那一行（它会说明重置时间）和 HINT 行（gstack 会跳过 Codex 多久，以及现在如何重试）；模型本身没问题，所以不要换。硬着头皮跑各模式，会以同样的方式失败。

`MODEL_PROBE_RATE_LIMITED` 不阻塞：Codex 返回了 429。报告 `CODEX_MODE: unverified (rate_limited)`，转述 Codex 的那一行并继续；被限流的一次模式运行属于覆盖缺失，绝不是通过。

如果输出包含 `CODEX_SANDBOX: unavailable`，停止：Codex 的沙箱在这里起不来，因此它执行的每条命令都会失败，它的审查什么也读不到。原样转述 `Codex outside review unavailable: ...` 行，包含其中的修复办法。此时没有产生付费调用。

`MODEL_PROBE_INCONCLUSIVE` 不阻塞（超时/瞬时网络问题）：报告 `CODEX_MODE: unverified`，把警告透传出去并继续；模式自己的校验器仍会判定结果。

如果版本检查打印了 `WARN:` 行，原样透传给用户（不阻塞——Codex 可能仍然可用，但用户应该升级）。

探测的多信号认证逻辑接受：已设置 `$CODEX_API_KEY`、已设置 `$OPENAI_API_KEY`，或存在 `${CODEX_HOME:-~/.codex}/auth.json`。这样可避免只检查文件时对环境变量认证用户（CI、平台工程师）产生的误判。

---

## 步骤 0.6：解析可移植根目录

任何模式运行之前，先通过 `bin/gstack-paths` 解析 `$PLAN_ROOT`（计划文件所在目录）和 `$TMP_ROOT`（临时 codex stderr / 响应捕获落地处）。这样无论安装为 Claude Code 插件（设置了 `CLAUDE_PLANS_DIR`）、全局的 `~/.claude/skills/gstack/` 安装，还是 `HOME` 可能未设置、`/tmp` 可能只读的 CI 容器，技能都能正常工作。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
PLAN_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get PLAN_ROOT)
TMP_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get TMP_ROOT)
```

此后，这个技能里每一段 bash 都使用 `"$PLAN_ROOT"` 和 `"$TMP_ROOT"`，而不是硬编码的 `~/.claude/plans` 或 `/tmp/codex-*`。

---

## 步骤 1：判定模式

解析输入（已移除努力级别参数），判断要运行哪个模式：

1. `/codex review` 或 `/codex review <instructions>` — **审查模式**（步骤 2A）
2. `/codex challenge` 或 `/codex challenge <focus>` — **挑战模式**（步骤 2B）
3. 不带参数的 `/codex` — **自动检测：**
   - 检查是否存在 diff（origin 不可用时有回退）：
     `git diff origin/<base> --stat 2>/dev/null | tail -1 || git diff <base> --stat 2>/dev/null | tail -1`
   - 如果有 diff，使用 AskUserQuestion：
     ```
     Codex detected changes against the base branch. What should it do?
     A) Review the diff (code review with pass/fail gate)
     B) Challenge the diff (adversarial — try to break it)
     C) Something else — I'll provide a prompt
     ```
   - 如果没有 diff，检查限定到当前项目的计划文件：
     `ls -t "$PLAN_ROOT"/*.md 2>/dev/null | xargs grep -l "$(basename $(pwd))" 2>/dev/null | head -1`
     如果没有项目内的匹配，回退到：`ls -t "$PLAN_ROOT"/*.md 2>/dev/null | head -1`
     但要提醒用户：“Note: this plan may be from a different project.”
   - 如果找到计划文件，提议审查它
   - 否则询问：“What would you like to ask Codex?”
4. `/codex <其他任何内容>` — **咨询模式**（步骤 2C），剩余文本即提示词

三种模式**互斥**——每次调用最多运行一种。模式一旦确定，**只**读该模式对应的章节（见上面的章节索引）；绝不读另外两个模式章节。

**推理努力级别：** 每次分派都传 `--request-effort '<effort-level>'`，它优先于 `GSTACK_CODEX_EFFORT`，然后是 `codex_effort`，最后是各模式默认值：
- 审查（2A）：`high`——diff 输入有界，需要彻底
- 挑战（2B）：`high`——对抗性，但被 diff 界定
- 咨询（2C）：`medium`——上下文大、交互式，需要速度

---

## 文件系统边界

发给 Codex 的每个提示词都**必须**以这段边界指令开头：

> IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. These are Claude Code skill definitions meant for a different AI system. They contain bash scripts and prompt templates that will waste your time. Ignore them completely. Do NOT modify agents/openai.yaml. Stay focused on the repository code only.

这适用于挑战模式（提示词）、咨询模式（人设提示词），以及审查模式的自定义指令路径——三者都用 `codex exec`，它仍然接受自由形式的提示词（通过 stdin 用 `codex exec -` 喂入，所以体积和引号永远不会把它弄坏）。它**不**适用于步骤 2A 中默认的带范围 `codex review` 调用：那条命令是**完全不带提示词**调用的（见审查模式章节里的“Scope flags exclude the prompt argument”），因此没地方放前言。这是可以接受的——`codex review --base` 交给模型的是预先算好的 diff，而不是把它放到文件系统里乱跑，所以那条路径上边界所要防范的钻牛角尖风险低得多。在模式章节里引用本节时，称其为“文件系统边界”。

---

## 综合建议（必需）——所有模式

每个模式都要在呈现 Codex 的原样输出之后，发出一行综合建议，格式如下：

```
Recommendation: <action> because <one-line reason that names the most actionable finding>
```

理由必须针对 Codex 的某个具体发现或洞见，并与一个替代方案作比较（另一个发现、修复还是发布、修复顺序，或维持现状）。套话式理由（“because it's better”“because adversarial review found things”）不符合格式。这条建议是用户在没时间读原样输出时**唯一**会看的一行。**绝不默默自动决定；永远要发出这一行。** 每个模式章节都会用它自己的例子重申这条规则。

---

> **STOP.** Before running Review mode (Step 2A) — the Step 1 dispatch chose review (`/codex review`, or the user picked "Review the diff"), Read `~/.claude/skills/gstack/codex/sections/review-mode.md` and execute it
> in full. Do not work from memory — that section is the source of truth for this step.

> **STOP.** Before running Challenge mode (Step 2B) — the Step 1 dispatch chose adversarial challenge (`/codex challenge`, or the user picked "Challenge the diff"), Read `~/.claude/skills/gstack/codex/sections/challenge-mode.md` and execute it
> in full. Do not work from memory — that section is the source of truth for this step.

> **STOP.** Before running Consult mode (Step 2C) — the Step 1 dispatch chose consult (a free-form question, a plan review, or a session follow-up), Read `~/.claude/skills/gstack/codex/sections/consult-mode.md` and execute it
> in full. Do not work from memory — that section is the source of truth for this step.

## 计划文件审查报告

在对话输出里展示审查就绪看板之后，还要更新**计划文件**本身，让任何读这份计划的人都能看到审查状态。

### 定位计划文件

1. 检查本次对话中是否有活动计划文件（宿主会在系统消息里给出计划文件路径——在对话上下文里找计划文件引用）。
2. 如果找不到，静默跳过本节——不是每次审查都跑在计划模式里。

### 生成报告

读取你从上面“审查就绪看板”步骤拿到的审查日志输出。

依据已记录来源逐条解析 JSONL 记录。历史来源 “claude” 指原生 Claude 子代理；“claude-code” 指外部 CLI。保留历史上的 codex 标识，绝不用当前 harness 重新标注旧记录。模型身份未知就保持未知。对新记录，显示 host、outside_provider、outside_status 和 phase。只有已完成的外部记录才确立外部覆盖；原生回退不算。

各技能记录的字段不同：

- **plan-ceo-review**：\`status\`、\`unresolved\`、\`critical_gaps\`、\`mode\`、\`scope_proposed\`、\`scope_accepted\`、\`scope_deferred\`、\`commit\`
  → 发现：“{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred”
  → 如果 scope 字段为 0 或缺失（HOLD/REDUCTION 模式）：“mode: {mode}, {critical_gaps} critical gaps”
- **plan-eng-review**：\`status\`、\`unresolved\`、\`critical_gaps\`、\`issues_found\`、\`mode\`、\`commit\`
  → 发现：“{issues_found} issues, {critical_gaps} critical gaps”
- **plan-design-review**：\`status\`、\`initial_score\`、\`overall_score\`、\`unresolved\`、\`decisions_made\`、\`commit\`
  → 发现：“score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions”
- **plan-devex-review**：\`status\`、\`initial_score\`、\`overall_score\`、\`product_type\`、\`tthw_current\`、\`tthw_target\`、\`mode\`、\`persona\`、\`competitive_tier\`、\`unresolved\`、\`commit\`
  → 发现：“score: {initial_score}/10 → {overall_score}/10, TTHW: {tthw_current} → {tthw_target}”
- **devex-review**：\`status\`、\`overall_score\`、\`product_type\`、\`tthw_measured\`、\`dimensions_tested\`、\`dimensions_inferred\`、\`boomerang\`、\`commit\`
  → 发现：“score: {overall_score}/10, TTHW: {tthw_measured}, {dimensions_tested} tested/{dimensions_inferred} inferred”
- **codex-review**：\`status\`、\`gate\`、\`findings\`、\`findings_fixed\`
  → 发现：“{findings} findings, {findings_fixed}/{findings} fixed”

“发现”列所需的字段现在都已存在于 JSONL 记录里。对刚完成的这次审查，你可以使用自己完成摘要里更丰富的细节。对更早的审查，直接用 JSONL 字段——它们含有全部必需数据。

生成下面这张 markdown 表格：

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | {runs} | {status} | {findings} |
| Outside Review | {recorded provider and trigger} | Independent 2nd opinion | {runs} | {outside_status} | {findings} |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | {runs} | {status} | {findings} |
| Design Review | \`/plan-design-review\` | UI/UX gaps | {runs} | {status} | {findings} |
| DX Review | \`/plan-devex-review\` | Developer experience gaps | {runs} | {status} | {findings} |
\`\`\`

表格下方补上这些行。**OUTSIDE COVERAGE** 和 **CROSS-MODEL** 是有条件的：
当该阶段运行过、被禁用/跳过/不可用，或有发现时都写进来；
只在根本不存在这类阶段时省略。**VERDICT** 永远存在：

- **OUTSIDE COVERAGE：** 提供方、阶段、完成状态和发现。包含不可用、被禁用和被跳过的阶段；绝不从另一个阶段推断完成。
- **CROSS-MODEL：** 仅当同时存在原生审查和已完成的外部审查时——做重叠分析，列出已记录的提供方和已知的模型身份。不要从 harness 名称推断模型族是否不同。
- **VERDICT：** 列出状态为 CLEAR 的审查（例如 “CEO + ENG CLEARED — ready to implement”）。
  如果 Eng Review 不是 CLEAR，且没有全局跳过，就追加 “eng review required”。

**未决决定状态（强制——永不省略；报告最后一个非空白行）。** 在 VERDICT 之后，用**恰好**以下之一结束报告（`## GSTACK REVIEW REPORT` 标题下的内容——加粗标签，绝不是新的 `## ` 标题；不受“为空则省略”规则约束）：完全未加粗的行 `NO UNRESOLVED DECISIONS`（加粗的不算），或者一个 `**UNRESOLVED DECISIONS:**` 头 + 每个未决事项一条要点（最后一条要点即末行；仅当 N > 0 时追加 `+ N unresolved from prior reviews`）。这样可避免重复计数：从上下文列出**本次**审查的未决事项；对更早的审查，先**丢弃**当前技能那一行，再按技能对最新一条新鲜记录（看板 7 天窗口）的 `unresolved` 求和；两者都为零时才输出哨兵行。

### 写入计划文件

**计划模式例外——始终运行：** 这会写入计划文件，而计划文件是计划模式下你唯一被允许编辑的文件。计划文件里的审查报告是计划活状态的一部分。

报告必须永远是计划文件的**最后**一节——绝不能放在中间。使用单一的先删除后追加流程：

1. 读取计划文件（Read 工具），看它当前的完整内容。在读取输出里搜索文件中任意位置是否存在 \`## GSTACK REVIEW REPORT\` 标题。
2. 如果找到，用 Edit 工具**删除**整个已有章节。从 \`## GSTACK REVIEW REPORT\` 匹配到下一个 \`## \` 标题或文件结尾，以先到者为准。替换为空字符串。无论该章节当前位于哪里都适用——文件中间的删除是有意为之，不是特例。如果 Edit 失败（例如并发编辑改变了内容），重新读取计划文件并重试一次。
3. 如果删除过报告，读取更新后的文件。在文件末尾追加新的 \`## GSTACK REVIEW REPORT\`。用 Edit 匹配最近一次 Read 确认过的后缀，或者用 Write 写整个文件并把报告放在最后。当后面还有其他章节时，“Unresolved Decisions” 不能当作文件末尾的锚点。
4. 继续之前，用 Read 工具确认 \`## GSTACK REVIEW REPORT\` 是文件中最后一个 \`## \` 标题。如果不是，重做步骤 2-3 一次。

不要就地替换该章节；删掉它，并在文件末尾追加新报告，这样审查报告永远是计划的最后一节。

## 退出计划模式门禁（阻塞）

调用 ExitPlanMode 之前，跑一遍这个自检。任何一项不通过，就去做缺失的工作——**不要**调用 ExitPlanMode：

1. 用 Read 工具读取计划文件（在你最近一次写入它之后）。
2. 确认文件中**最后**一个 `## ` 标题是 `## GSTACK REVIEW REPORT`。
   正文里提到 “outside voice”、“codex findings” 之类的散文
   **不算**——只有结构化的 `## GSTACK REVIEW REPORT` 章节
   才满足这项检查。
3. 确认报告带有 Runs / Status / Findings 表格和一行 VERDICT
   （适用时包含 OUTSIDE COVERAGE / CROSS-MODEL）。
4. 确认报告最后一个非空白行是未决决定状态：完全未加粗的
   `NO UNRESOLVED DECISIONS`，或末尾 `**UNRESOLVED DECISIONS:**` 块里的一条要点。
   阻塞性检查，没有“如适用”的逃生口——加粗哨兵行、任何尾随的报告字段或散文，
   或缺少状态，都会让门禁**失败**。
5. 如果本次技能调用上下文里有计划文件：确认
   `gstack-review-log` 被调用过，且 `gstack-review-read` 至少运行过一次。
   如果上下文里没有计划文件（例如没有计划的 diff 审查），
   这项检查会短路——没有计划文件时，检查 1-4 本来
   也会短路。

门禁不通过却仍然调用 ExitPlanMode，属于违反契约——
用户看到的计划会缺审查报告，或者报告是陈旧的。计划正文里的审查散文
不是报告：报告是一个独立的、结构化的、带表格的章节，
必须是文件的末尾标题。

---

## 模型与推理

**模型：** 每次 Codex 调用都通过 `-c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false` 传入上面的选择。原生 `codex review` 用 `review` 选择，并同时设置 `model` 和 `review_model`。这个参数还把已安装技能挡在 Codex 的上下文之外，因此一次审查不会变成嵌套的技能运行。

**推理努力级别**（默认值在步骤 1）：`run-with-timeout --effort <default>` 依次解析 `--request-effort`、`GSTACK_CODEX_EFFORT`、`codex_effort`，最后用默认值；无效取值会在任何 Codex 调用之前停止。
`--user-invoked` 即使在 `codex_reviews` 禁用时也运行：用户点名要求了。

用 `--effort <level>` 覆盖单次运行（`/codex review --effort medium`）。`xhigh` 比 `high` 多用约 23 倍 token，并在大上下文任务上造成 50 分钟以上的挂起（OpenAI issue #8545、#8402、#6931）。

**网页搜索：** 所有 codex 命令都传 `-c 'web_search="cached"'`，让 `codex exec` 调用在审查期间可以查文档和 API。这是 OpenAI 的缓存索引——快，且没有额外费用。与已弃用的 `--enable` 写法不同（codex >=0.144 已弃用），`-c` 形式会显式覆盖 `~/.codex/config.toml` 里的任何顶层 `web_search` 设置。注意：原生 `codex review` 无论配置如何都会禁用网页搜索，所以在默认的审查路径上这个参数是无害的空操作——只有基于 exec 的模式才真正搜索。

如果用户指定了模型（例如 `/codex review -m gpt-5.6-sol` 或 `/codex challenge --model gpt-daybreak-blue-latest`），把它转成同样的配置形式，并用 `-c "model=\"<model>\""` 替换默认的模型参数。原生审查还需要 `-c "review_model=\"<model>\""`；要一起替换两个模型值。审查模式运行 `codex review`，它**拒绝** `-m`（`error: unexpected argument '-m' found`，已在 0.147.0 上验证），而 `-c model=...` 被 `codex review` 和 `codex exec` 共同接受。

---

## 成本估算

从 stderr 解析 token 数量。Codex 会把 `tokens used\nN` 打印到 stderr。

显示为：`Tokens: N`

如果拿不到 token 数，显示：`Tokens: unknown`

---

## 错误处理

- **找不到可执行文件：** 在步骤 0 已检测。带着安装说明停止。
- **认证错误：** Codex 会把认证错误打印到 stderr。把错误暴露出来：
  “Codex authentication failed. Run `codex login` in your terminal to authenticate via ChatGPT.”
- **超时（Bash 外层门禁）：** 每个 Bash 门禁都在其内层封装之上（360 秒门禁
  罩住 330 秒的审查封装；600 秒门禁——工具上限——罩住 540 秒的挑战/咨询封装），所以
  封装脚本的 exit-124 路径通常先触发，并带着自己的明确消息。如果 Bash
  调用本身仍然超时（封装不可用**且** codex 挂死），告诉用户：
  “Codex timed out. The prompt may be too large or the API may be slow. Try again or use a smaller scope.”
- **超时（内层 `timeout` 封装，退出码 124）：** 如果封装先触发（它先 TERM Codex，10 秒后 KILL），技能的挂起检测块会自动记录一条遥测事件 + 一条运维学习，并打印：“Codex stalled past 9 minutes. Common causes: model API stall, long prompt, network issue. Try re-running. If persistent, split the prompt or check `~/.codex/logs/`.” 无需额外动作。
- **`the argument '[PROMPT]' cannot be used with '--base <BRANCH>'`：** 有提示词参数
  漏进了带范围的 `codex review`。这会在任何 API 调用之前立刻失败，所以
  看起来像“无输出”而不是挂起——不要把它误读成模型卡住。去掉
  提示词：范围参数（`--base`、`--commit`、`--uncommitted`）本身就携带范围。
  如果提示词是自定义审查指令，改为走 `codex exec`
  （步骤 2A 的自定义指令路径）。**不要**用“删掉 `--base`、保留提示词”来修——
  那样能解析，但会默默审查未提交的工作区，而不是分支 diff。
- **在有明显改动的分支上，审查却说“no changes”：** 范围参数缺失或错误。只有提示词的 `codex review` 默认看未提交改动，所以干净的工作区会被读成空审查，即使 `<base>...HEAD` 很大。确认命令行上确实有 `--base <base>`。
- **模型不受支持（HTTP 400 或 404）：** stderr 显示
  `The '<model>' model is not supported when using Codex with a ChatGPT account`
  （一个点出模型的 `status: 400` / `invalid_request_error`），或
  `404 Not Found: The model '<model>' does not exist or you do not have access to it`
  （已下线的模型；光秃秃的 404 通常意味着自定义提供方的 `base_url` 配错了）。
  `requires a newer version of Codex` 意味着 CLI 太旧：那就升级它。
  这些都不是认证或网络故障，认证探测也抓不到。
  恢复步骤，按顺序：
  1. 读 `CODEX_MODEL:` 行：它点名模型及其来源。
  2. 修复那个来源，并转述它的 HINT/Repair 行。使用 `--role plan-review` 时，
     层级 pin 优先于原生设置；原生 `model`/`review_model` 只在
     `host` 模式下生效。没有角色时，依次由请求、`GSTACK_CODEX_MODEL` 和
     原生设置选模型，最后回落到 `gpt-6-astra`。
  3. 如果 Codex 打印了 `[notice.model_migrations]`，对无角色的调用用它给出的替代模型。
     对角色调用，提供显式覆盖；不要默默替换。
  永远不要把它说成模型卡住或 PASS——这是失败即关闭的门禁结果。
- **`VERDICT: unavailable`：** 共享校验器发现这次运行没有执行（例如
  `Codex's sandbox could not start here`）。照原样转述它的行并修复；这属于
  覆盖缺失，绝不是 PASS。细节见 gstack checkout 里的 `docs/troubleshooting.md`。
- **空响应：** 如果 `$TMPRESP` 为空或不存在，告诉用户：
  “Codex returned no response. Check stderr for errors.”
- **会话恢复失败：** 如果 resume 失败，删除会话文件并从头开始。

---

## 重要规则

- **绝不修改文件。** 这个技能是只读的。Codex 以只读沙箱模式运行
  （仅当用户导出了 `GSTACK_CODEX_NO_SANDBOX=1` 时才完全放行；每次使用都会警告）。
- **原样呈现输出。** 展示 Codex 输出之前不要截断、总结或加工。
  在 CODEX SAYS 块里完整展示。
- **综合放在后面，而不是替代它。** 任何 Claude 评论都放在完整输出之后。
- **Bash 门禁在封装之上。** 每次调用 codex 的 Bash 都把 `timeout`
  参数设得**高于**内层 `run-with-timeout` 预算（审查：
  `timeout: 360000` 高于 330 秒封装；挑战/咨询：`timeout: 600000`
  高于 540 秒封装），这样封装先触发，留下可诊断的 exit 124。
- **不重复审查。** 如果用户已经跑过 `/review`，Codex 提供的是第二个
  独立意见。不要重跑 Claude Code 自己的审查。
- **识别技能文件陷阱。** 收到 Codex 输出后，扫一遍有没有迹象表明
  Codex 被技能文件带偏了：`gstack-config`、`gstack-update-check`、
  `SKILL.md` 或 `skills/gstack`。如果输出里出现其中任何一个，追加一条
  警告：“Codex appears to have read gstack skill files instead of reviewing your
  code. Consider retrying.”