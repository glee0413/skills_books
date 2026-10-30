---
id: gstack/autoplan
title: autoplan
description: 按顺序跑完 CEO、设计、工程与 DX 四类计划审查，并用六条决策原则自动给出决策，只把品味类选择留给最终门禁。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: autoplan/SKILL.md
snapshotPath: source-snapshots/gstack/autoplan/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /autoplan — 自动审查流水线

以完整的交互深度，从磁盘读取 CEO、设计、DX 和工程四类审查的每一节。6 条原则负责回答中间问题；品味类判断留到唯一的最终门禁。

---

## 分节索引 — 遇到对应情形时再读该节

这个技能是一副决策树骨架。下面的步骤指向按需读取的分节。执行某一步之前要先把对应分节读完，不要凭记忆操作。

| 何时 | 读这一节 |
|------|-------------------|
| 开始阶段 1（CEO 审查 — 总是运行，在阶段 0.5 预检之后） | `sections/ceo-phase.md` |
| 开始阶段 2（设计审查 — 仅当阶段 0 检测到 UI 范围；否则完全跳过读取） | `sections/design-phase.md` |
| 开始阶段 3（工程审查 — 总是运行，在所有更早的适用阶段关闭之后） | `sections/eng-phase.md` |
| 开始阶段 2.5（DX 审查 — 仅当阶段 0 检测到面向开发者的范围；否则完全跳过读取） | `sections/dx-phase.md` |
| 关闭一个审查阶段，在其各项审查结束之后、宣布完成或加载下一阶段之前（每次退出时重新读一遍） | `sections/phase-close.md` |
| 呈现最终批准门禁（阶段 4）— 聚合器会算出 $AGGREGATED_TASKS，由门禁消息替换进去 | `sections/tasks-aggregator.md` |
| 前导输出回显了 `SESSION_KIND: unattended`（在阶段 1 之前以及阶段 4 门禁处读取） | `sections/unattended.md` |

---

## 6 条决策原则

1. **选完整** — 把整个东西交付出去；选覆盖更多边界情形的方案。
2. **烧干湖** — 修掉爆炸半径内的一切（本计划修改的文件 + 直接导入者）。爆炸半径内且 CC 人力低于 1 天的扩张自动批准（少于 5 个文件，不引入新基础设施）。
3. **务实** — 两个选项修的是同一个问题？几秒钟内选更干净的那个。
4. **DRY** — 与已有功能重复？否决；复用已有的东西。
5. **显式胜于聪明** — 10 行显而易见的修复优于 200 行的抽象；选新贡献者一眼能读懂的那个。
6. **偏向行动** — 合并 > 审查循环 > 过时的斟酌。标出顾虑，不要阻塞。

**冲突消解（依上下文决定胜负）：**
- **CEO 阶段：** P1（完整）+ P2（烧干湖）占主导。
- **工程阶段：** P5（显式）+ P3（务实）占主导。
- **设计阶段：** P5（显式）+ P1（完整）占主导。

---

## 决策分类

每个自动决策都要归类：

**机械型** — 有唯一明确正确答案。静默自动决策（运行已启用的外部审查者：是；跑评估：是；在一个完整计划上缩减范围：否）。

**品味型** — 讲道理的人会有不同看法。带推荐自动决策；在最终门禁处呈现。来源：
1. **接近的方案** — 前两名都可行，权衡不同。
2. **边界范围** — 在爆炸半径内但涉及 3-5 个文件，或半径本身有歧义。
3. **Codex 分歧** — 外部审查者给出不同建议，且有站得住的观点。

**用户挑战** — Claude 和 Codex 都建议改变用户陈述的方向：合并、拆分、增加或删除功能/技能/工作流。这类问题**绝不**自动决策。在最终批准门禁给出原始方向、建议的改动、理由、盲区以及判断错误的代价（阶段 4 门禁项）；标出双方都同意的安全/可行性风险。在用户批准改动之前，用户的方向保持不变。

---

## 顺序执行 — 强制要求

各阶段必须严格按顺序运行：CEO → 设计（若有 UI 范围）→ DX（若有面向开发者的范围）→ 工程。工程**总是**最后运行，审查先前所有修正。保持**只有一个**阶段处于活动状态，按顺序完成这些门禁：
1. 加载该阶段的阶段说明和完整技能/分节，记录完整的 Read 范围。在 Claude Code 上，从原生 `Read` 已安装的阶段驱动文件进入，然后对其方法论范围使用原生 `Read`。驱动文件的 Read 是受门禁保护的入口。若被拒绝，先完成或修复前一阶段，再重试同一次 Read；更换文件加载工具并不能满足这个边界。
2. 完成该阶段必须的预备工作（CEO：全部 Step 0，包括其 Spec Review Loop 和修正检查点），然后创建新的快照，并原样派发其 nativeDispatchPrompt。
3. 消费原生终态结果并应用该阶段的失败策略，然后消费已启用的外部结果。在这些结果之后完成该阶段其余的主审查分节。
4. 在该阶段出口，重新加载它的 `phase-close` 分节。执行其中编号的操作：准备当前数据包，完整 Read 它，做语义核对，然后**发送**父级完成消息。发布本身是一个独立操作；更早的那次 Read 不算这次关闭。
5. 只有消息发出之后，驱动才可以加载/创建/派发下一阶段。然后在同一轮次里继续下一阶段的工具调用；工程之后，进入最终综合/批准。对不适用的阶段使用声明的跳过规则；不要加载它的审查或关闭步骤。
阶段通知（包括跳过）是进度更新：绝不在那里结束回合，也不要等待一句“继续”回复。
缺一个门禁就让当前阶段保持打开，即使某个审查者已经完成。
读请求/自我报告和 INPUT 哈希不能证明已被吸收或审查质量达标。绝不要预先起草未来阶段的审查或输出。标题和承诺不等于完成。
压缩之后，重新加载当前阶段的说明/技能/分节，然后分别核对待保存的产物和已发送的会话消息。若正在关闭，重新加载 `phase-close` 并从第一个未完成的编号操作继续；当实现或已接受的决策发生变化时，重新生成并重读完整数据包：
- 若一个已验证的阶段缺少它的宣告，先在推进之前从第 6 步（发布）恢复关闭流程。
- 若它的审查者仍待返回，等待同一个审查者。
- 若尚未发生原生派发，先完成所有未完成的预备工作，再恢复语音输入。若最终语音输入不存在，在预备门禁之后创建它。读取那个最终 `<PHASE_INPUT>` 旁边的 `snapshot.json`，原样使用它的 `nativeDispatchPrompt`。绝不派发 `<CEO_STEP0_CHECKPOINT>`：它是稳定的修正基线，不是当前审查输入。`nativePrompt` 是文件的审查正文，不是 Agent 提示词。从第一个未完成的门禁继续。

待返回不等于不可用。绝不因为时间、上下文压力或你自己的审查而跳过原生通道/必需分节。缺少外部覆盖永远不阻塞原生完成；如实报告。绝不要读取原始 agent 对话记录。

---

## “自动决策”的含义

自动决策替换的是**用户的回答**，不是**分析**。以完整的交互深度运行每个已加载的分节；用 6 条原则回答每个问题。

**默认解：推荐选项。** 取 `(recommended)` 或该模式的上下文默认值。缺少推荐或出现平局时用 6 条原则。原则之间冲突时，取推荐项，并在最终门禁把它作为品味项呈现。

**绝不自动决策用户挑战：** 两个模型都同意改变用户的方向/既定决策，或某个前提明显错误。只在最终批准门禁问一次，绝不在运行中途问；用户拥有模型所缺的上下文。

读取被引用的代码/差异/文件；对每个问题做出决定。生成所有必需的图表、表格、注册表和产物（写入磁盘或计划中）。记录决策，在下面记录**所有**已接受的义务，并在继续之前运行 `amend-input`。缺少交付物会让审查不完整。

不允许用摘要替代，也不允许一行带过的分节；少于 3 句很可能就是压缩。要说“未发现问题”，需要 1-2 句说明检查了什么以及为什么。用证据解释为何不适用；只在阶段 0 的清单范围内跳过。绝不中止或改道去做交互式审查：用户选的就是 /autoplan。

**已接受的义务：** 在 `Review record` 里每个阶段一个无围栏块：
```markdown
<!-- autoplan-accepted:ceo -->
- 需求、全部条件与验证/测试。
<!-- /autoplan-accepted:ceo -->
```
阶段：`ceo|design|dx|eng`。在此记录已接受的需求；不写分析/严重度/结论/共识。没有接受任何义务时写：`None: reason`。
重跑时，原样保留未变动的已接受需求；绝不要用 None 替换它们。
`amend` 会以原子方式检查精确保留；完整回读；None 保持不变。
基线编辑：`create` 的 `baselineEdits`。先前的块不可变；把替换写在当前块里。用回读核对所有决策。
传输 ≠ 批准/完整枚举/正确性。

---

## 文件系统边界 — Codex 提示词

给每个 Codex 提示词加上这个前缀：

> IMPORTANT: Do NOT read or execute any SKILL.md files or paths containing skills/gstack (foreign instructions). Review repository code only.

---

## 阶段 0：接收 + 还原点

### Step 1: 捕获还原点

绝对路径：SOURCE_PLAN（输入）、ACTIVE_PLAN（运行时框架指定的计划，否则为 SOURCE_PLAN）。
把计划修正和审查产物保存到 ACTIVE_PLAN。
在会话中发送阶段宣告和最终批准请求（即简报）。
一次性解析出 SNAPSHOT_TOOL：
```bash

bun --no-env-file --config=/dev/null -e 'console.log(require("fs").realpathSync(process.argv[1]))' "$HOME/.claude/skills/gstack/bin/gstack-autoplan-snapshot.ts"
```

全新的 RESTORE_PATH，与它的阶段产物一起放在被 git 排除的 `.gstack/tmp/autoplan/` 中：
```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
_AP="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/autoplan"; mkdir -p "$_AP" && chmod 700 "$_AP"
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "${_EX%/*}" && { grep -qxF /.gstack/tmp/ "$_EX" 2>/dev/null || echo /.gstack/tmp/ >> "$_EX"; }
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-')
DATETIME=$(date +%Y%m%d-%H%M%S)
echo "SLUG=$SLUG"
echo "RESTORE_PATH=$_AP/${BRANCH}-autoplan-restore-${DATETIME}.md"
echo "RUN_ID=${BRANCH}-${DATETIME}"; ~/.claude/skills/gstack/bin/gstack-autoplan-timing estimate --run "${BRANCH}-${DATETIME}" --out "$_AP"
```

在范围判定/审查之前：
```bash
bun "<SNAPSHOT_TOOL>" init "<SOURCE_PLAN>" "<ACTIVE_PLAN>" "<RESTORE_PATH>"
```
把 init 作为独立的 Bash 调用执行，使用字面绝对路径：不要变量、替换、串联、管道或重定向，门禁无法绑定这些。使用它返回的路径/`scope`；绝不手工包装。init 会精确备份 SOURCE_PLAN，然后以原子方式初始化 ACTIVE_PLAN，保留每一条需求。
审查者只拿到 `## Implementation plan`；分析内容（包括结构化输入）留在 `## Review record`。辅助工具出错时停下；不要隐藏 stderr 或用 grep 兜底。
重跑：把 RESTORE_PATH 的字节复制回 SOURCE_PLAN，然后运行 /autoplan。

### Step 2: 读取上下文

- 读取 CLAUDE.md、TODOS.md、git log -30、针对基线分支的 git diff --stat
- 查找设计文档：`~/.claude/skills/gstack/bin/gstack-design-doc-find "$SLUG" "$BRANCH"`（打印文档路径，或什么都不打印）
- 使用 init 的全输入 `scope`。输入发生变化或语义启用标志变化时，重跑：
```bash
bun "<SNAPSHOT_TOOL>" scope "<ACTIVE_PLAN>"
```
  UI 范围通过返回的 `uiRequired` 判定：一个渲染文件路径，或与视觉名词相邻的 UI 术语（`uiEvidence`）；单独的 UI 词从不引入设计阶段。使用返回的 `dxRequired`（初始为 `scope.dxRequired`）；记录它的输入哈希和匹配到的术语。阈值是 2 次及以上术语匹配（按出现次数计，不是不同术语数）。当产品是开发者工具（开发者会安装、集成或基于它构建），或 AI 智能体是主要用户时，也要启用 DX：加 `--developer-tool` 或 `--agent-primary`。这些标志只用来启用 DX；任何上下文标签都不能否定一个肯定结果。只有两者都为假时才跳过 DX。


### Step 3: 定位审查技能；在阶段入口加载它们

把本阶段的来源解析为绝对路径 `<REVIEW_SKILL>`；通过它的检查点加载：
- 阶段 1：`~/.claude/skills/gstack/plan-ceo-review/SKILL.md`
- 阶段 2：`~/.claude/skills/gstack/plan-design-review/SKILL.md`（仅当检测到 UI 范围）
- 阶段 2.5：`~/.claude/skills/gstack/plan-devex-review/SKILL.md`（仅当检测到 DX 范围）
- 阶段 3：`~/.claude/skills/gstack/plan-eng-review/SKILL.md`

使用 /autoplan 已安装的注册表；从它发现的 SKILL.md 目录解析同级技能，绝不用 cwd/运行时资产。技能缺失时：报告该阶段和修复方式；绝不用别的运行框架替换，也不要声称完成。

只在触发时读取技能/分节，绝不要预取未来阶段。在阶段 4 加载任务聚合器。完整运行每个适用的技能和惰性分节。

**分节跳过清单 — 跟随已加载的技能文件时，跳过这些分节（它们已由 /autoplan 处理）：**
- Preamble (run first)
- Scope gate（被审查的计划已经是目标）
- AskUserQuestion Format
- Completeness Principle — Boil the Ocean
- Search Before Building
- Completion Status Protocol
- Telemetry (run last)
- Step 0: Detect platform and base branch
- Review Readiness Dashboard
- Plan File Review Report
- Prerequisite Skill Offer (BENEFITS_FROM)
- Outside Voice — Independent Plan Challenge
- Design Outside Voices (independent)

只遵循审查专属的方法论、分节和必需输出。

输出：“Here's what I'm working with: [计划摘要]. UI scope: [yes/no]. DX scope: [yes/no]。审查技能在各阶段入口加载；以自动决策启动完整流水线。”

---

## 阶段 0.5：外部审查者预检

```bash

# Codex preflight: the probe runs as a command, so any shell works.
_CODEX_PROBE=~/.claude/skills/gstack/bin/gstack-codex-probe
_CODEX_CFG=$(~/.claude/skills/gstack/bin/gstack-config get --stored codex_reviews 2>/dev/null)
_gstack_helper_error=""
[ -x "$_CODEX_PROBE" ] || _gstack_helper_error="gstack: cannot load gstack-codex-probe; re-run ./setup. https://github.com/garrytan/gstack/blob/main/docs/troubleshooting.md#sourced-helper-location"
if [ "$_CODEX_CFG" = "disabled" ] || [ "$_CODEX_CFG" = "unreadable" ]; then
  _CODEX_MODE="disabled"
elif { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  _CODEX_MODE="under_codex"
elif ! command -v codex >/dev/null 2>&1; then
  _CODEX_MODE="not_installed"; "$_CODEX_PROBE" log-event codex_cli_missing 2>/dev/null || true
elif [ -n "$_gstack_helper_error" ]; then
  _CODEX_MODE="helper_unavailable"; echo "$_gstack_helper_error"
elif ! "$_CODEX_PROBE" check-auth >/dev/null 2>&1; then
  _CODEX_MODE="not_authed"; "$_CODEX_PROBE" log-event codex_auth_failed 2>/dev/null || true
else
  _CODEX_MP=0
  "$_CODEX_PROBE" check-sandbox || _CODEX_MP=3
  if [ "$_CODEX_MP" -eq 3 ]; then
    _CODEX_MODE="sandbox_unavailable"
  else
    _CODEX_MODE="ready"; "$_CODEX_PROBE" check-version || true
  fi
fi
echo "CODEX_MODE: $_CODEX_MODE"
```

按回显的 `CODEX_MODE` 分支：
- **`disabled`**（或某次发送出现 `consent_missing` 行）— `codex_reviews` 已关闭或不可读。只跳过 Codex 通道；下面的 Claude 对抗子代理**仍然**要跑（它免费且快）。打印：“Codex passes skipped (codex_reviews disabled) — running Claude adversarial only.”
- **`helper_unavailable`** — 探针缺失或不可执行；转述上面那一行（原因和修复）。保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`not_installed`** — Codex CLI 不存在。打印：“Codex not installed; outside coverage unavailable. Install: `npm install -g @openai/codex`.” 保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`under_codex`** — 过时的产物选了自己的运行框架。打印：“Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage. Repair: setup --host codex.” 跳过外部调用，按下文工作流的原生审查说明执行。继承来的运行框架标记互相冲突，不构成猜测另一个提供方的理由。
- **`not_authed`** — 已安装但没有凭据。打印：“Codex not authenticated; outside coverage unavailable. Run `codex login` or set `$CODEX_API_KEY`.” 保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`broken_install`** — CLI 在 PATH 上但无法执行（spawn ENOENT、二进制不可执行、缺少 vendor 载荷）。打印：“Codex is installed but its binary cannot run — Codex passes skipped. Reinstall: `npm install -g @openai/codex`.” 转述探针的 HINT 行。保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`model_unusable`** — 角色调用被策略、认证或模型选择拒绝。转述它的原因和来源专属的 Repair/HINT 行，而不是一个优先级更低的设置。`AUTH_FAILED` 需要 `codex login`；绝不用别的模型代替。保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`quota_exhausted`** — Codex 用量上限：逐字转述探针的输出行（重置时间、重试）；本次运行不再有 Codex 调用。保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`sandbox_unavailable`** — Codex 的沙箱在此无法启动（没有用户命名空间的容器）；探针已打印原因和修复。没有发生付费调用；外部覆盖不可用。保留必需的 Claude 对抗通道；不要派发重复的一份。
- **`ready`** 或 **`unverified`** — 运行下面的 Codex 通道。`unverified` 表示模型检查超时，或在带 `(rate_limited)` 时遇到 429；要说明这一点，让该通道自己的结论来决定。
计划审查就绪检查会探测[策略](https://github.com/garrytan/gstack/blob/main/docs/model-policy.md)模型。转述它的诊断信息；绝不从审查块的退出状态推断配额。

禁用/不可用会保留适用的原生通道。每次外部派发都要重新检查。
按阶段记录提供方以及完成/不可用/禁用/跳过（CEO 只覆盖 CEO）。缺失的声音记为 N/A，绝不记作 CONFIRMED。已跳过的范围保持跳过。


## 阶段 1：CEO 审查（战略与范围）

> **STOP。** 开始阶段 1（CEO 审查 — 总是运行，在阶段 0.5 预检之后）之前，Read `~/.claude/skills/gstack/autoplan/sections/ceo-phase.md` 并完整执行。
> 不要凭记忆操作 — 该分节是这一步的唯一事实源。

---

## 阶段 2：设计审查（条件性 — 无 UI 范围则跳过）

**跳过条件：** 阶段 0 未检测到 UI 范围：完全跳过这个阶段 — **不要**读它的分节。发送：“Phase 2 skipped — no UI scope detected.” 在 ACTIVE_PLAN 中记录这次跳过；它不算已完成的审查。

> **STOP。** 开始阶段 2（设计审查 — 仅当阶段 0 检测到 UI 范围；否则完全跳过读取）之前，Read `~/.claude/skills/gstack/autoplan/sections/design-phase.md` 并完整执行。
> 不要凭记忆操作 — 该分节是这一步的唯一事实源。

---

## 阶段 2.5：DX 审查（条件性 — 无面向开发者的范围则跳过）

**跳过条件：** 阶段 0 未检测到 DX 范围：完全跳过这个阶段 — **不要**读它的分节。发送：“Phase 2.5 skipped — no developer-facing scope detected.” 在 ACTIVE_PLAN 中记录这次跳过；它不算已完成的审查。

> **STOP。** 开始阶段 2.5（DX 审查 — 仅当阶段 0 检测到面向开发者的范围；否则完全跳过读取）之前，Read `~/.claude/skills/gstack/autoplan/sections/dx-phase.md` 并完整执行。
> 不要凭记忆操作 — 该分节是这一步的唯一事实源。

---

## 阶段 3：工程审查 + 双声部（总是运行，总是最后 — 必需门禁审查最终修正后的计划）

> **STOP。** 开始阶段 3（工程审查 — 总是运行，在所有更早的适用阶段关闭之后）之前，Read `~/.claude/skills/gstack/autoplan/sections/eng-phase.md` 并完整执行。
> 不要凭记忆操作 — 该分节是这一步的唯一事实源。

---

## 决策审计轨迹

每次自动决策之后，立刻用 Edit 向计划文件追加一行：

```markdown
<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
```

---

## 门禁前校验

对照每个适用交付物检查计划和会话：

| 阶段 | 必需输出 |
|---|---|
| CEO | 点名的前提挑战（前提表的 `REALITY:` 行）；每个适用分节的发现，或明确的已检查/无发现；错误与救援登记表和失效模式登记表（或带原因的 N/A）；不在范围内；已存在的东西；梦想状态差距；完成摘要；共识表。 |
| 设计（若有 UI） | 全部 7 个维度的评分；已识别并已决策的问题；试金石记分卡。 |
| DX（若面向开发者） | 全部 8 个维度的评分；开发者旅程图；共情叙述；TTHW 评估与目标；DX 实现清单；共识表。 |
| 工程（总是最后） | 以代码为依据的范围挑战及其 `REALITY:` 行；架构 ASCII 图；代码路径到测试的图；位于 ~/.gstack/projects/$SLUG/ 的测试计划；不在范围内；已存在的东西；带关键缺口的失效模式登记表；完成摘要；共识表。 |

按阶段校验原生和外部声音的结果，或明确的不可用/跳过状态、跨阶段主题，以及每个自动决策一行决策审计轨迹。
在门禁之前产出缺失的输出；最多修补 2 次之后，就地警告每一项未完成的内容。

Reality 行：每个阶段的 `PLAN_REALITY: … verdict=complete` 来自 `~/.claude/skills/gstack/bin/gstack-plan-reality check --phase <ceo|eng> <review-file|->`。在无人值守运行中，缺少适用的行就是 `incomplete`，绝不是警告；交互式运行遵循上面的修补规则。

---

## 阶段 4：最终批准门禁

> **STOP。** 呈现最终批准门禁（阶段 4）之前 — 聚合器会算出 $AGGREGATED_TASKS 供门禁消息替换 — 先 Read `~/.claude/skills/gstack/autoplan/sections/tasks-aggregator.md` 并完整执行。
> 不要凭记忆操作 — 该分节是这一步的唯一事实源。

**停在这里，向用户呈现一页简报。**

写 `$_AP/gate.json`（格式见：`gstack-gate --help`）：每个用户挑战一项（`uc<n>`，批准类；`why` = 你说过什么 / 双方建议 / 理由 / 盲区 / 判断错误的代价），每个品味决策一项（`d<n>`，自动类；`why` = 依据的原则以及替代方案的影响），以及 `plan`（批准类：a) 原样批准（推荐）b) 带覆盖项 c) 追问 d) 修订 e) 否决）。运行 `~/.claude/skills/gstack/bin/gstack-gate render $_AP/gate.json`，把它的 `decisions` 输出追加到 `$_AP/decisions.jsonl`。把完整审查写入 `$_AP/review-record.md`，把其中的 Plan Summary 单独写入 `$_AP/summary.md`：

```
## /autoplan Review Complete

## URGENT, outside this plan
[`~/.claude/skills/gstack/bin/gstack-artifact urgent $_AP/findings.jsonl` 的输出（本计划之外的安全或数据丢失问题，或 `None.`）；同时写入 ACTIVE_PLAN 中 `## Implementation plan` 之上]

### Plan Summary
[1-3 句摘要]

### Decisions Made: [N] total ([M] auto-decided, [K] taste choices, [J] user challenges)
Auto-decided: see the plan file's Decision Audit Trail; the rest are the brief's decisions.

### Review Scores
CEO, Design, DX and Eng: phase summary plus Codex, Claude
and consensus status; say skipped where a phase did not run. Then the CYCLE line
from `~/.claude/skills/gstack/bin/gstack-autoplan-timing summary --run <RUN_ID> --out "$_AP"`.

### Cross-Phase Themes
Concerns independently raised in 2+ phases, or "No cross-phase themes — each phase's concerns were distinct."

### Deferred to TODOS.md
[Items auto-deferred with reasons]

### Implementation Tasks (aggregated across phases)
[Substitute $AGGREGATED_TASKS. If empty: "_No per-phase task lists found in $TASKS_DIR for branch $BRANCH._"]
```

原样呈现 `~/.claude/skills/gstack/bin/gstack-owner-brief render --out "$_AP" --write` 的输出（URGENT 块、朴素摘要、每页七条编号决策并带各自的自动默认值、review-record 路径；后续页用 `--page N`），绝不呈现完整审查。

解析回复：`~/.claude/skills/gstack/bin/gstack-gate parse $_AP/gate.json --reply "<text>" --gate-rev <rev>`；无法解析或过时的回复要重新呈现（`gate_rev`+1），绝不猜测。`all` 或 `plana` 且无覆盖项 = A；`d<n>` 覆盖项 = B；`uc<n>` 覆盖项 = B2；`planc`/`pland`/`plane` = C/D/E。在 `SESSION_KIND: unattended` 下 Read `sections/unattended.md`，以它的 `GSTACK_RESULT` 行在这里结束，绝不批准。

**选项处理：**
- A：标记 APPROVED，运行 `~/.claude/skills/gstack/bin/gstack-owner-brief close --out "$_AP" --plan <ACTIVE_PLAN>`（草拟方向行变为已定选项和日期），写审查日志，建议 /ship
- B：询问是哪些覆盖项，应用它们，然后按 D 的受影响阶段重跑规则（工程最后）再重新呈现门禁；与 D 一样最多 3 轮。
- B2：逐个接受/拒绝用户挑战；被拒绝的保留用户的方向。重跑工程，然后重新呈现门禁。
- C：以自由文本回答，重新呈现门禁
- D：做出改动，重跑受影响的阶段（scope→1，design→2，dx→2.5，test plan→3，arch→3；任何更早阶段的重跑都要在其后重跑工程 — 门禁始终审查最终计划）。最多 3 轮。
- E：从头再来

**启动受影响阶段的重跑：** 保持当前 Implementation plan 和所有先前已接受的义务不变。把该阶段已应用的 `autoplan-baseline-edits` 记录逐字移入 Review record 中带围栏的历史区，保留其原始来源 SHA。创建新的修正检查点。新的基线编辑使用 `create` 的 `baselineEdits.record` 和 `sourceSha256`；审查投影哈希不是基线身份。原样保留未变动的已接受需求。绝不重放旧的替换，也不要改写历史来源 SHA。这是一次新的阶段调用；压缩会恢复现有调用及其检查点。工程仍然最后运行。

---

## 完成：写审查日志

批准时，为 /ship 的仪表盘记录每一项已完成的审查，替换掉 TIMESTAMP、STATUS（"clean" 或 "issues_open"）和 N。

```bash
COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-ceo-review","timestamp":"'"$TIMESTAMP"'","status":"STATUS","unresolved":N,"critical_gaps":N,"mode":"SELECTIVE_EXPANSION","via":"autoplan","commit":"'"$COMMIT"'"}'
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-eng-review","timestamp":"'"$TIMESTAMP"'","status":"STATUS","unresolved":N,"critical_gaps":N,"issues_found":N,"mode":"FULL_REVIEW","via":"autoplan","commit":"'"$COMMIT"'"}'
```

如果阶段 2 运行过（UI 范围）：
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-design-review","timestamp":"'"$TIMESTAMP"'","status":"STATUS","unresolved":N,"via":"autoplan","commit":"'"$COMMIT"'"}'
```

如果阶段 2.5 运行过（DX 范围）：
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-devex-review","timestamp":"'"$TIMESTAMP"'","status":"STATUS","initial_score":N,"overall_score":N,"product_type":"TYPE","tthw_current":"TTHW","tthw_target":"TARGET","unresolved":N,"dx_rubric":"agent-ready-v1","via":"autoplan","commit":"'"$COMMIT"'"}'
```

双声部日志：每个阶段（`ceo`、`design`、`dx`、`eng`）一条记录，带该阶段的状态/计数，共用同一个 AUTOPLAN_RUN_ID 和 TIMESTAMP。
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"autoplan-voices","run_id":"AUTOPLAN_RUN_ID","timestamp":"'"$TIMESTAMP"'","status":"STATUS","source":"SOURCE","host":"claude","outside_provider":"codex","outside_status":"OUTSIDE_STATUS","phase":"PHASE","via":"autoplan","consensus_confirmed":N,"consensus_disagree":N,"commit":"'"$COMMIT"'"}'
```

始终记录被跳过的设计/DX：status/outside_status 为 "skipped"，source 为 "none"，共识计数为零。只有完成了外部输出才令 SOURCE = "codex"；原生结果用 "in-host"。OUTSIDE_STATUS：completed、unavailable、disabled 或 skipped。绝不把成功跨阶段/跨运行沿用；保留 modelUsage。

保留历史上的 review-log 技能 ID；添加 `"host":"claude","outside_provider":"codex","outside_status":"completed|unavailable|disabled|skipped","phase":"autoplan"`。分别记录不同尝试的结果。`source:"codex"` 要求有已完成的 CLI 输出；原生用 `source:"in-host"`（历史上的 `source:"claude"`：原生 Claude）。可用性/原生回退不算外部完成。保留所有上报的 modelUsage；未知的模型身份保持未知。在 `GSTACK_CODEX_NO_SANDBOX=1` 下添加 `"codex_sandbox":"danger-full-access"`。

呈现一张阶段覆盖表（CEO、设计、DX、工程）：宿主、外部提供方/状态、原生完成度、发现、部分覆盖，附实际计数。

**实现模型：** 转述 `"$HOME/.claude/skills/gstack/bin/gstack-models" resolve --role implementation --provider anthropic` 给出的模型/来源。gstack 无法更改本会话。只做推荐；除非被要求，不派生子进程也不改配置。出错时转述它的修复方式，而不是某个模型。[策略设置](https://github.com/garrytan/gstack/blob/main/docs/model-policy.md)。

准备好创建 PR 时，建议 `/ship`。