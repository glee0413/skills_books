---
id: mattpocock/improve-codebase-architecture
title: improve-codebase-architecture
description: 扫描代码库找出加深模块的机会，用可视化 HTML 报告呈现候选方案，再对选中的方案展开追问。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/improve-codebase-architecture/SKILL.md
snapshotPath: source-snapshots/mattpocock/improve-codebase-architecture/SKILL.md
license: MIT
translatedAt: 2026-10-30
invocation: user
---

# 改进代码库架构

找出架构上的摩擦，并提出**加深机会**：把浅模块变成深模块的重构。目标是可测试性与 AI 可导航性。

这条命令由项目的领域模型*提供信息*，并建立在一套共享的设计词汇之上：

- 用 "codebase-design" 调用 Skill 工具，获取架构词汇（**module**、**interface**、**depth**、**seam**、**adapter**、**leverage**、**locality**）及其原则（删除测试、“接口就是测试面”、“一个适配器＝假设的接缝，两个＝真实的接缝”）。在每个建议里精确使用这些术语，不要漂移到 "component"、"service"、"API" 或 "boundary"。
- `GLOSSARY.md` 里的领域语言为好接缝提供命名；`docs/adr/` 里的 ADR 记录了这条命令不应重新争论的决策。

## 过程

### 1. 探索

**扫描之前先定范围：YAGNI。**加深一个模块的回报在于让未来对它的修改更容易，所以给代码库中最近改动过的部分额外权重。在开始看之前先决定*看哪里*：

- 如果用户点了方向（某个模块、某个子系统、某个痛点），就照它来，跳过下面的推断。
- 否则，往回翻相当一段 commit 历史（`git log --oneline`），找代码库的热点——反复出现的文件和区域——让这些路径先把你的注意力拉过去。如果改动很分散、没有明显热点，就扩大范围。

先读你将要触碰区域的领域术语表（`GLOSSARY.md`）和相关 ADR。

然后派一个子代理走一遍代码库。不要遵循死板的启发式；有机地探索，并记下你感到摩擦的地方：

- 哪里理解一个概念需要在许多小模块之间来回跳？
- 哪些地方的模块是**浅**的，接口几乎和实现一样复杂？
- 哪些地方纯粹为了可测试性抽出了纯函数，而真正的 bug 藏在它们的调用方式里（没有**局部性**）？
- 哪些地方紧耦合的模块越过接缝泄漏？
- 代码库哪些部分没有测试，或者难以通过当前接口测试？

对任何你怀疑是浅的东西应用**删除测试**：删掉它会让复杂度集中，还是只是搬家？“是的，会集中”才是你要的信号。

### 2. 把候选方案呈现为 HTML 报告

写一个自包含的 HTML 文件到操作系统临时目录，让任何东西都不落进仓库。从 `$TMPDIR` 解析临时目录，回退到 `/tmp`（Windows 上是 `%TEMP%`），写到 `<tmpdir>/architecture-review-<timestamp>.html`，让每次运行都得到新文件。为用户打开它（Linux 上 `xdg-open <path>`，macOS 上 `open <path>`，Windows 上 `start <path>`），并告诉他们绝对路径。

报告用**通过 CDN 引入的 Tailwind** 做布局和样式，用**通过 CDN 引入的 Mermaid** 画图——当图、流程或时序能可靠传达结构时。把 Mermaid 与手写的 CSS/SVG 视觉混用：关系是图状时（调用图、依赖、时序）用 Mermaid；想要更有编辑感的东西时（体量图、剖面图、折叠动画）用手工 div/SVG。每个候选方案都配一张**前后对比可视化**。要视觉化。

每个候选方案渲染成一张卡片，包含：

- **Files**：涉及哪些文件/模块
- **Problem**：当前架构为什么造成摩擦
- **Solution**：用平实语言描述会改什么
- **Benefits**：用局部性与杠杆解释，以及测试会如何改善
- **Before / After diagram**：并排、手工绘制，画出浅与加深
- **Recommendation strength**：`Strong`、`Worth exploring`、`Speculative` 之一，渲染成徽标

报告以 **Top recommendation** 小节结束：你会先做哪个候选方案，以及为什么。

**领域用 GLOSSARY.md 的词汇，架构用 `/codebase-design` 的词汇。**如果 `GLOSSARY.md` 定义了 “Order”，就说“Order 入口模块”，而不是 “FooBarHandler”，也不是“Order 服务”。

**ADR 冲突**：如果某个候选方案与现有 ADR 矛盾，只有摩擦真实到值得重审该 ADR 时才提出来。在卡片里清楚标出（例如一个警告框：*“与 ADR-0007 矛盾，但值得重新打开，因为……”*）。不要列出 ADR 禁止的每一个理论上的重构。

完整的 HTML 脚手架、图表模式和样式指引见 [HTML-REPORT.md](html-report.md)。

现在还不要提出接口。文件写完后，问用户：“你想深入探索其中哪一个？”

### 3. 追问循环

用户选定候选方案后，用 "grilling" 调用 Skill 工具，和他们一起走决策树：约束、依赖、加深后模块的形态、接缝后面放着什么、哪些测试能活下来。

副作用在决策成形时即时发生；用 "domain-modeling" 调用 Skill 工具，让领域模型随时保持最新：

- **给加深后的模块起名时用了 `GLOSSARY.md` 里没有的概念？**把术语加进 `GLOSSARY.md`。文件不存在就惰性创建。
- **对话中把一个模糊术语磨清楚了？**当场更新 `GLOSSARY.md`。
- **用户带着关键理由否决了候选方案？**提议写一篇 ADR，措辞是：*“要我把这个记成 ADR，好让未来的架构审查不再重复建议吗？”*只有未来探索者确实需要这个理由来避免重复建议时才提议；跳过临时性理由（“现在不值得做”）和不言自明的理由。
- **想为加深后的模块探索备选接口？**用 "codebase-design" 调用 Skill 工具，使用它的 design-it-twice 并行子代理模式。