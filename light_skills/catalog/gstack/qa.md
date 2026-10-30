---
id: gstack/qa
title: qa
description: 在浏览器、API、CLI、job、worker、webhook 等目标上做测试、修复与验证的完整 QA 流程。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: qa/SKILL.md
snapshotPath: source-snapshots/gstack/qa/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /qa：测试 → 修复 → 验证

---

## 章节索引 —— 在对应情形出现时阅读相应章节

需要时完整阅读章节，不要凭记忆做事。

| 何时 | 读哪一节 |
|------|-------------------|
| 搭建或探测某个目标时，除非本次调用已经确立了它的接口面和隔离方式 | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/scope.md` |
| 搭建明确选定的浏览器接口面时；纯功能目标永远不读 | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/browser-setup.md` |
| 用调用方授予的权限，运行所选目标的 QA 基线与探索性探测时 | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/exploratory.md` |
| 用仓库支持的工具探测选定的 API、CLI、job、worker 或 webhook 接口面时 | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/system-functional.md` |
| 修复后复查已复现的浏览器缺陷时；纯功能修复永远不读 | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/browser-verify.md` |
| 在 Setup 阶段检查浏览器目标的测试框架时；纯功能目标永远不读——生态识别、获准的引导、CI 流水线与首批测试 | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/test-bootstrap.md` |
| 运行 QA 基线（Phase 1-6）时——模式选择（Diff-aware/Full/Quick/Regression）、逐阶段的浏览器工作流、Health Score Rubric、框架相关指导，以及浏览器测试的 Important Rules | 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/qa-patterns.md` |

---

## Setup

> **STOP。** 在搭建或探测某个目标之前，除非本次调用已经确立了它的接口面和隔离方式，请完整阅读相对于已安装 `qa`/`gstack-qa` SKILL.md 目录的 `sections/scope.md` 并照做。
> 使用本宿主已安装的路径，永远不要用产品工作目录或另一宿主的资源。
> 如果文件缺失或不可读，报告一个 QA 搭建阻塞项，并把受影响的探测标记为阻塞；继续做其他安全的探测（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

**从用户的请求里解析这些参数：**

| 参数 | 默认值 | 覆盖示例 |
|-----------|---------|-----------------:|
| Target | （从请求/仓库推断，或询问） | 浏览器 URL、API 路由、CLI 命令、job、worker 或 webhook |
| Tier | Standard | `--quick`、`--exhaustive` |
| Mode | full | `--quick`、`--regression <previous-report-or-baseline>` |
| Output dir | `.gstack/qa-reports/` | `Output to /tmp/qa` |
| Scope | 所选目标（或按 diff 划定） | `Focus on duplicate webhook delivery` |
| Auth | 用于功能探测的隔离合成身份 | 浏览器会话处理属于 browser setup；永远不要在聊天里索取凭证 |

**层级决定哪些问题会被修：**
- **Quick：** 只修 critical + high 严重度
- **Standard：** 再加 medium 严重度（默认）
- **Exhaustive：** 再加 low/外观类严重度

`--quick` 同时设置 Quick 修复层级和 Quick 探索；`--exhaustive` 只改变修复层级。
Regression 模式保留所选的修复层级。
如果同时给了 `--quick` 和 `--regression`，在搭建或探测之前先问用哪种探索模式。
保留所选的修复层级；这个选择只关乎探索。

**在功能分支上且没有明确范围时：** 对改动的和相邻的行为做 diff-aware 测试。
先选接口面；没有 URL 从来不会迫使你使用浏览器。

**检查工作区是否干净：**

```bash
git status --porcelain
```

如果脏，**STOP** 并用 AskUserQuestion。解释干净的工作区能让 QA 修复保持原子性：
- A) 先用一条描述性信息提交当前所有改动，再做 QA（推荐）。
- B) 暂存（stash）改动，跑 QA，然后 pop 回来。
- C) 中止，由用户手工清理。

只执行用户的选择，然后继续搭建。

**在浏览器设置之前准备报告产物。** 先解析好所有传入的历史报告
和基线路径。选择输出覆盖目录或 `.gstack/qa-reports`。
该目录不存在就创建。只有当它为空时才把它当作 `REPORT_DIR`；
否则选一个本次运行专属的新子目录。
用 UTC 的 `run-YYYYMMDDTHHMMSSZ`，冲突时加后缀。把所有本地证据都放在那里。
永远不要覆盖之前的报告、基线、截图或探索笔记。
调用方固定的产物路径和权限优先；如果无法安全保留下，报告输出阻塞项，
而不是扩大写权限。

**仅限浏览器接口面：** 加载它的设置；纯功能运行跳过这一节。

> **STOP。** 在搭建明确选定的浏览器接口面之前——纯功能目标永远不读——请完整阅读相对于已安装 `qa`/`gstack-qa` SKILL.md 目录的 `sections/browser-setup.md` 并照做。
> 使用本宿主已安装的路径，永远不要用产品工作目录或另一宿主的资源。
> 如果文件缺失或不可读，报告一个 QA 搭建阻塞项，并把受影响的探测标记为阻塞；继续做其他安全的探测（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

**仅限浏览器接口面：** 检查测试框架，需要时使用已有的引导方案。
功能目标使用受支持的原生测试，或报告这项缺口；
它们不加载这套浏览器引导，也不生成 CI。

> **STOP。** 在 Setup 阶段检查浏览器目标的测试框架之前——纯功能目标永远不读——生态识别、获准的引导、CI 流水线与首批测试，请完整阅读相对于已安装 `qa`/`gstack-qa` SKILL.md 目录的 `sections/test-bootstrap.md` 并照做。
> 使用本宿主已安装的路径，永远不要用产品工作目录或另一宿主的资源。
> 如果文件缺失或不可读，报告一个 QA 搭建阻塞项，并把受影响的探测标记为阻塞；继续做其他安全的探测（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

---

## Prior Learnings（既往经验）

搜索以往会话中相关的经验：

```bash
_CROSS_PROJ=$(~/.claude/skills/gstack/bin/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  { _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --query "qa testing bug regression flake fixture" --cross-project 2>&1 >&3 3>&-); _LR=$?; } 3>&1
else
  { _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --query "qa testing bug regression flake fixture" 2>&1 >&3 3>&-); _LR=$?; } 3>&1
fi
[ "$_LR" = 0 ] || { _LE=${_LE%%$'\n'*}; echo "LEARNINGS: unavailable (${_LE:-exit $_LR})"; }
```

如果 `CROSS_PROJECT` 是 `unset`（第一次）：用 AskUserQuestion：

> gstack 可以搜索你这台机器上其他项目的经验，找出可能适用于这里的
> 模式。这一切都在本地（数据不会离开你的机器）。
> 单人开发者建议开启。如果你同时维护多个客户的代码库、担心交叉污染，
> 就跳过。

选项：
- A) 启用跨项目经验（推荐）
- B) 经验只在项目内可见

如果选 A：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings true`
如果选 B：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings false`

然后用相应参数重新跑一次搜索。

如果找到经验，把它们并入你的分析。当某条 QA 发现
匹配上一条既往经验时，显示：

**“Prior learning applied: [key] (confidence N/10, from [date])”**

这让积累效应可见。用户应该看到 gstack 在他们的代码库上越来越聪明。

## Test Plan Context（测试计划上下文）

优先使用最近的项目测试计划和对话中的计划，而不是 git diff；取信息更丰富的那个：

1. **项目范围的测试计划：** 找这个仓库最新的一份：
   ```bash
   GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
   setopt +o nomatch 2>/dev/null || true  # zsh 兼容
   SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
   ls -t "$GSTACK_STATE_ROOT"/projects/$SLUG/*-test-plan-*.md 2>/dev/null | head -1
   ```
2. **对话上下文：** 之前的 `/plan-eng-review` 或 `/plan-ceo-review` 测试计划。
3. 只有前两者都不存在时，才回退到 git diff。

---

## Phases 1-6：QA 基线

遵循共享章节里有序的准备工作，然后跑它的探测循环。
在那个循环里，浏览器运行把 qa-patterns.md 编号的 Phase 1-6 当作技术手段，
功能运行则套用 system-functional.md 的契约映射；两者都不是独立的工作流。

> **STOP。** 在运行所选目标的 QA 基线与探索性探测之前，且权限归调用方所有时，请完整阅读相对于已安装 `qa`/`gstack-qa` SKILL.md 目录的 `sections/exploratory.md` 并照做。
> 使用本宿主已安装的路径，永远不要用产品工作目录或另一宿主的资源。
> 如果文件缺失或不可读，报告一个 QA 搭建阻塞项，并把受影响的探测标记为阻塞；继续做其他安全的探测（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

修复之前先报告基线发现。浏览器评分和功能结果分开保存。

---

## Output Structure（输出结构）

在 `$REPORT_DIR` 下写 `qa-report-{target}-{YYYY-MM-DD}.md` 和浏览器的
`baseline.json`。浏览器的 `{target}` 是一个安全的主机名。
浏览器证据放进 `screenshots/`：`initial.jpg`、
`issue-NNN-step-N.jpg`、`issue-NNN-result.jpg`、带标注的 `issue-NNN.png`
和 `issue-NNN-after.jpg`（Phase 5 是修复前）。
功能报告使用安全的命令/服务标签，以及脱敏后的命令/请求/状态证据。

---

## Phase 7：分诊

按严重度排序问题，并应用所选的修复层级。把较低层级的问题和
无法从源码修复的问题（第三方组件、基础设施）标记为“deferred”。

### 为 bug 所在的组件/页面刷新经验

在修复循环之前，针对出问题的组件/页面再搜索一次。用一个只含
字母、数字或连字符的名词（例如 `checkout-button`、`payment`），绝不用路径、
引号、空白或其他标点；必要时简化为字母数字词干。

```bash
{ _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --query "<your-keyword>" --limit 5 2>&1 >&3 3>&-); _LR=$?; } 3>&1
[ "$_LR" = 0 ] || { _LE=${_LE%%$'\n'*}; echo "LEARNINGS: unavailable (${_LE:-exit $_LR})"; }
```

用一句话点名一条适用的经验，没有适用的就继续。

---

## Phase 8：修复循环

对每个可修复的问题，按严重度顺序：

### 8a. 诊断并复现

使用共享循环里的因果假设与最小化重放，在修改前记录实际行为与
文档所述行为的差异。只改应当负责的文件。环境故障
和不清楚的契约永远不构成修复的授权。

### 8a.5. 修复前的回归测试

**测试价值门槛。** 在写或提议一个测试之前，已复现的 bug 已经回答了它保护什么、
什么会让它失败；还要回答：

1. 为什么现有覆盖没有抓到它？优先在已有的表驱动测试或共享 fixture 里加一行，
   而不是再写一个近乎重复的测试。
2. 它是否需要一条生产接缝（export、flag、wrapper、注入 hook），而没有任何生产
   调用方需要这条接缝？如果是，就在真实的边界上测。

价值卡片：`Value: protects=<...>; fails_when=<...>; why_new=<...>; seam=none; no_claim=<...>`（seam：`none` 或它的名字；`no_claim`：一句话说明“绿”不能证明什么、哪些 fixture 或 mock 替代了什么，例如 `no_claim=provider acceptance (mocked provider; unit only)` 或 `no_claim=none beyond protects`；它永远不能免除必需的实况检查）；每个字段在此最多 160 个 UTF-8 字节（截到 157 再加 `...`；写入的 JSON 保留完整值）。把它放进 8e.5 的记录里。上游卡片缺失从不阻塞：自己推导；忽略未知字段。

示例：Value: protects=refundPayment rejects an empty reason; fails_when=the reason guard is removed or inverted; why_new=billing.test.ts covers processPayment only; seam=none; no_claim=provider acceptance (mocked provider; unit only)
被拒（covered_elsewhere）：“checkout renders”；checkout.e2e.ts:15 已覆盖，扩展那个测试即可。

已有表或 fixture 覆盖该边界时，扩展它；永远不要为测试新增生产
接缝。匹配附近 2-3 个测试的命名、导入、断言和 fixture，并检测出运行它们的命令。在一个新的原生测试里复现
失败。在修复前先跑检测到的命令；证明失败是缺陷造成的，
而不是 fixture、导入或服务的问题。用该语言的注释语法标注：

```text
// Regression: ISSUE-NNN — short defect description
// Found by /qa on YYYY-MM-DD
// Report: .gstack/qa-reports/qa-report-{target}-{date}.md
```

一个清晰、健康但未覆盖的契约，可以在不改产品代码的情况下新增一个通过的测试。

应用共享探索章节里的原生单元/集成/E2E 规则。
纯 CSS 缺陷可以使用浏览器证据。基础设施缺失仍然算覆盖债务。

用组件名和原生扩展名，放进自增的 `{name}.regression-N.test.{ext}`。
N 取现有最大编号 + 1，从 1 开始；永远不要替换已有文件。
保留有效的红色回归测试；只对已证明的 fixture/test 错误做窄幅修正，或报告未解决的 bug。

### 8b. 修复

读周边源码，做**最小修复**。不做无关的重构或新功能。

### 8c. 复测

重跑回归测试、原先失败的探测和相邻的正常路径。检查每个
最终状态；仅凭验收无法验证 worker 修复。失败或不可用的复测保持未解决：
再试一次修订后的最小修复，否则把它归为已回退。

仅针对浏览器缺陷：

> **STOP。** 在修复后复查已复现的浏览器缺陷之前——纯功能修复永远不读——请完整阅读相对于已安装 `qa`/`gstack-qa` SKILL.md 目录的 `sections/browser-verify.md` 并照做。
> 使用本宿主已安装的路径，永远不要用产品工作目录或另一宿主的资源。
> 如果文件缺失或不可读，报告一个 QA 搭建阻塞项，并把受影响的探测标记为阻塞；继续做其他安全的探测（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

### 8d. 提交已验证的工作

```bash
git add <only-verified-source-and-regression-files>
git commit -m "fix(qa): ISSUE-NNN — short description"
```

每个已验证的修复连同它的回归测试一起提交，绝不混入无关修复。未解决的
修复和有效的红色回归/证据不要提交；告诉用户还剩下什么。

### 8e. 分类

- **verified**：通过 8c（可用时含原生回归测试）；披露缺失的测试覆盖
- **best-effort**：已应用修复但无法完全验证（例如需要认证状态、外部服务）
- **reverted**：发现回归或问题仍未解决 → 只撤销本次运行的修复（已提交的则回退该 commit），保留有效的回归/证据，并把该问题标为“deferred”。永远不要丢弃用户的改动。

### 8e.5. 回归测试记录

记录 8a.5 中在修复前创建的测试，以及 8c 中的复测结果：
文件、命令、归因、被测边界、价值卡片和红/绿证据，或它为何被推迟。
这一步只记录结果；不会创建另一个测试。
健康契约的提交使用 `test(qa): regression test for {contract}`。
**自我调节豁免：** 只含测试的提交不计入 8f 的停止规则。

### 8f. 自我调节（STOP AND EVALUATE）

每 5 次修复，以及任何一次回退之后，检查循环是否弊大于利。
**立即 STOP** 的情形：两次回退之后，或出现一次与发现无关的文件编辑。
当修复总是横跨很多文件，或只剩 Low 问题时也要停。
向用户展示目前做了什么，并询问是否继续。

**硬上限：50 次修复。** 达到 50 次后，无论还剩多少问题都停止。

---

## Phase 9：最终 QA

在最终输入上重跑受影响的契约和相邻的正常路径。
调用方要求的复查不能以“未受影响”为由跳过。对于浏览器
接口面，复查受影响的页面并计算最终健康分。如果分数变差或契约回归，
要显著警告；阻塞或不确定的复查永远不能证明修复有效。

---

## Phase 10：报告

把 Output Structure 报告写在本地，并把同样的内容复制到项目上下文：
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
```
写到 `<PROJECT_DIR>/{user}-{branch}-test-outcome-{datetime}.md`（`PROJECT_DIR` 见上面输出），
其中 user 取自 `git config user.name`，branch 取自 `git branch --show-current`（否则 `unknown-user`、`detached`；
非字母数字字符 → `-`），datetime 用 UTC `YYYYMMDDTHHMMSSZ`。

**每个问题的附加信息：**
- Fix Status：verified / best-effort / reverted / deferred
- Commit SHA（如果已修）
- Files Changed（如果已修）
- 前后证据：浏览器用截图，功能用输出/请求/持久状态

**总结：** 问题总数、verified/best-effort/reverted 的修复和推迟的问题。
浏览器覆盖要包含分数变化。功能覆盖要包含
通过/失败/阻塞/未运行的契约、永久回归和剩余风险，
永远不要给分数。混合结果要分开保存。

**PR 摘要：** 一行，“QA found N issues, fixed M, health score X → Y.”
功能目标：写契约结果，不要写分数。

---

## Phase 11：更新 TODOS.md

如果仓库里有 `TODOS.md`：

1. **新推迟的 bug** → 作为 TODO 加入，带严重度、类别和复现步骤
2. **`TODOS.md` 里已修的 bug** → 标注 “Fixed by /qa on {branch}, {date}”

---

## Capture Learnings（记录经验）

如果你在本次会话中发现了不明显的模式、陷阱或架构洞见，
记录下来供以后的会话使用：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"qa","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
```

**类型：** `pattern`（可复用的做法）、`pitfall`（不该做什么）、`preference`
（用户明确说过）、`architecture`（结构性决策）、`tool`（库/框架洞见）、
`operational`（项目环境/CLI/工作流知识）。

**来源：** `observed`（你在代码里发现的）、`user-stated`（用户告诉你的）、
`inferred`（AI 推断）、`cross-model`（Claude 和 Codex 都同意）。

**置信度：** 1-10。要诚实。你在代码里验证过的观察模式是 8-9。
拿不准的推断是 4-5。用户明确说过的偏好是 10。

**files：** 写上这条经验涉及的具体文件路径。这让过期检测成为可能：
如果那些文件后来被删除，这条经验可以被标记出来。

**只记录真正的发现。** 不要记录显而易见的事。不要记录用户已经知道的事。
一个好标准：这条洞见能在以后的会话里省下时间吗？能，就记录。



## Additional Rules（qa 专属）

**在明确批准的浏览器引导之外：** 只能通过 Phase 8a.5 中被授权的编纂来创建测试。永远不要修改 CI 配置或削弱已有测试；使用新的原生测试文件。

拿不准就停下来问。