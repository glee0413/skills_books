---
id: mattpocock/to-tickets
title: to-tickets
description: 把计划、规格或当前对话拆成一组曳光弹工单，每张声明阻塞它的边，并发布到配置好的跟踪器。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/to-tickets/SKILL.md
snapshotPath: source-snapshots/mattpocock/to-tickets/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# To Tickets

把一份计划、规格或对话拆成一组**工单**：曳光弹式的垂直切片，每张工单声明哪些工单**阻塞**它。

议题跟踪器和分诊标签词表应当已经提供给你。如果没有，请让用户运行 `/setup-matt-pocock-skills`。

## Process

### 1. Gather context

从对话上下文里已有的内容开始。如果用户把某个引用（规格路径、issue 编号或 URL）作为参数传进来，就取回它，读完它的正文和全部评论。

### 2. Explore the codebase (optional)

如果你还没浏览过代码库，先浏览一遍，了解代码的当前状态。工单标题和描述应当使用项目的领域术语表词汇，并遵守你所触及领域的 ADR。

寻找机会先做预重构（prefactor），让实现更容易。“先让改动变简单，再做简单的改动。”

### 3. Draft vertical slices

把工作拆成**曳光弹**工单。

<vertical-slice-rules>

- 每个切片都穿过每一层（schema、API、UI、测试），切出一条窄但完整的路径：是垂直的，而不是某一层的水平切片
- 一个完成的切片本身就能演示或验证
- 每个切片的大小要能装进一个全新的上下文窗口
- 任何预重构都应当先做

</vertical-slice-rules>

给每张工单标出**阻塞边**：在它开始之前必须完成的其它工单。没有阻塞项的工单可以立刻开始。

**大范围重构是垂直切片的例外。** **大范围重构**（wide refactor）指一次机械改动（重命名一列、给共享符号换类型），它的**影响半径**（blast radius）横跨整个代码库，因此一次编辑会同时打断成千上万个调用点，没有任何垂直切片能带着绿灯落地。不要硬把它塞进曳光弹，而要按**先扩展、后收缩**（expand–contract）来排序。先扩展：在旧形式旁边加上新形式，保证什么都不坏。然后按影响半径分批迁移调用点（按包、按目录），每批一张工单，由扩展那一步阻塞；由于旧形式仍在，批次之间 CI 能保持绿灯。最后收缩：在没有任何调用者之后删除旧形式，这张工单由所有迁移批次阻塞。如果连这些批次单独都无法保持绿灯，就保留同样的顺序，但让它们共用一个集成分支，所有批次共同阻塞一张最终的“集成并验证”工单，绿灯只在那里承诺。

### 4. Quiz the user

把提议的拆解以编号列表呈现。对每张工单展示：

- **Title**：简短描述性的名字
- **Blocked by**：还有哪些工单（如果有）必须先完成
- **What it delivers**：这张工单让哪一段端到端行为跑通

问用户：

- 粒度感觉对吗？（太粗 / 太细）
- 阻塞边正确吗：每张工单是否只依赖真正卡住它的工单？
- 有没有工单该合并或进一步拆分？

反复迭代，直到用户认可这个拆解。

### 5. Publish the tickets to the configured tracker

发布已批准的工单。**如何**发布取决于 `/setup-matt-pocock-skills` 配置的跟踪器；两种方式下工单内容相同，变化的只是阻塞边的形态：

- **本地文件** → 在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md` 下每张工单一个文件，按依赖顺序（阻塞者在前）从 `01` 开始编号。每个文件的“Blocked by”列出它依赖的编号/标题。使用下面单张工单的文件模板：一个文件一张工单，绝不写成一个合并文件。
- **真实的议题跟踪器（GitHub、Linear……）** → 按依赖顺序（阻塞者在前）每张工单发布一个 issue，这样每张工单的阻塞边都能引用真实标识符。平台如果有原生的阻塞关系就用它；否则把每张工单的“Blocked by”设成阻塞它的那些 issue。如果来源是一个已存在的 issue，就让每张工单成为它的子 issue（按跟踪器文档里的操作）。除非另有指示，打上 `ready-for-agent` 分诊标签；按构造方式，这些工单就是 agent 可以直接抓取的。

按**前沿**推进：任何阻塞者都已完成的工单。对于纯线性的链条，这就是从上到下。

不要关闭或修改任何父 issue。

<local-ticket-template>

# <NN>: <工单标题>

**What to build:** 这张工单让哪一段端到端行为跑通，从用户视角描述，而不是逐层的实现清单。

**Blocked by:** 卡住这张工单的那些工单的编号/标题，或者“None (can start immediately)”。

**Status:** ready-for-agent

- [ ] 验收标准 1
- [ ] 验收标准 2

</local-ticket-template>

<issue-template>

## Parent

指向跟踪器上父 issue 的引用（如果来源是已存在的 issue；否则省略这一节）。

## What to build

这张工单让哪一段端到端行为跑通，从用户视角描述，而不是逐层的实现。

## Acceptance criteria

- [ ] 标准 1
- [ ] 标准 2

## Blocked by

- 指向每张阻塞工单的引用，或者“None (can start immediately)”。如果阻塞关系已用原生边设置，就省略这一节。

</issue-template>

无论哪种形式，都避免写具体文件路径或代码片段：它们很快会过时。例外：如果某个原型产出的片段比文字更能精确表达一个决策（状态机、reducer、schema、类型形状），就把它内联进来，并简要说明它来自原型。只保留决策密集的部分，不要放可运行的演示，只要关键内容。