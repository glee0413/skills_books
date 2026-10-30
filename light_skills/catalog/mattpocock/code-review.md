---
id: mattpocock/code-review
title: code-review
description: 从标准与规格两个轴并行审查自某个固定点以来的改动，并排报告两边的发现。
invocation: model
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/code-review/SKILL.md
snapshotPath: source-snapshots/mattpocock/code-review/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

对 `HEAD` 与用户给出的固定点之间的 diff 做双轴审查：

- **标准（Standards）**：代码是否符合本仓库成文的编码标准？
- **规格（Spec）**：代码是否忠实实现了来源 issue / 规格？

两个轴都作为**并行子代理**运行，这样它们不会污染彼此的上下文，然后由这个技能汇总它们的发现。

议题跟踪器应该已经提供给你了。如果没有，让用户运行 `/setup-matt-pocock-skills`。

## 流程

### 1. 钉住固定点

用户说的任何东西就是固定点（一个提交 SHA、分支名、标签、`main`、`HEAD~5` 等等）。如果用户没有指定，就问。

把 diff 命令记下来一次：`git diff <fixed-point>...HEAD`（三个点，这样比较是基于合并基点的）。同时通过 `git log <fixed-point>..HEAD --oneline` 记下提交列表。

在继续之前，确认固定点能够解析（`git rev-parse <fixed-point>`）且 diff 非空。坏的引用或空 diff 应该在这里失败，而不是在两个并行子代理内部失败。

### 2. 确定规格来源

按这个顺序寻找来源规格：

1. 提交信息里的 issue 引用（`#123`、`Closes #45`、GitLab `!67` 等），通过跟踪器文档里的工作流获取。
2. 用户作为参数传入的路径。
3. `docs/`、`specs/` 或 `.scratch/` 下与分支名或功能匹配的规格文件。
4. 如果什么都没找到，问用户规格在哪里。如果用户说没有，**规格**子代理会跳过并报告“no spec available”。

### 3. 确定标准来源

在仓库里搜索每一个记录代码该怎么写的文件。当 `CODING_STANDARDS.md` 或 `CONTRIBUTING.md` 存在时，它必须在清单上。

在仓库记录的任何东西之上，标准轴始终携带下面的**坏味道基线**：一组固定的 Fowler 代码坏味道（《重构》第 3 章），即使仓库什么都没记录也适用。有两条规则约束它：

- **仓库优先。** 成文的仓库标准永远获胜；当它认可了基线会标记的东西时，就压下那个坏味道。
- **永远是判断题。** 每个坏味道都是带标签的启发式（“可能的 Feature Envy”），绝不是硬性违规。和这里的任何标准一样，跳过工具已经强制的东西。

每个坏味道的读法是*它是什么* → *怎么修*；拿它去对照 diff：

- **Mysterious Name**（神秘的名字）：一个函数、变量或类型的名字没有揭示它做什么或装什么。→ 重命名；如果找不到诚实的名字，说明设计本身是浑的。
- **Duplicated Code**（重复代码）：同一种逻辑形状出现在这次改动的一个以上 hunk 或文件里。→ 提取共享的形状，从两处调用它。
- **Feature Envy**（依恋情结）：一个方法更多地去摸另一个对象的数据，而不是自己的。→ 把这个方法搬到它艳羡的数据上。
- **Data Clumps**（数据泥团）：同样的几个字段或参数总是结伴旅行（一个想要诞生的类型）。→ 把它们捆成一个类型，传那个类型。
- **Primitive Obsession**（基本类型偏执）：用一个基本类型或字符串来代表一个值得拥有自己类型的领域概念。→ 给这个概念一个自己的小类型。
- **Repeated Switches**（重复的 switch）：对同一类型的同一个 `switch`/`if` 级联在这次改动里反复出现。→ 用多态替换，或用一个两处共享的映射。
- **Shotgun Surgery**（霰弹式修改）：一次逻辑改动迫使你在 diff 的许多文件里做零散的编辑。→ 把一起变化的东西收进一个模块。
- **Divergent Change**（发散式变化）：一个文件或模块因为几个不相关的原因被修改。→ 拆开，让每个模块只为一个原因变化。
- **Speculative Generality**（夸夸其谈通用性）：为规格并不存在的需求添加的抽象、参数或钩子。→ 删掉它；先内联回去，等真实需求出现。
- **Message Chains**（过长的消息链）：调用方不该依赖的长链导航 `a.b().c().d()`。→ 把这段行走藏到第一个对象上的一个方法后面。
- **Middle Man**（中间人）：一个主要只是继续转发的类或函数。→ 砍掉它，直接调用真正的目标。
- **Refused Bequest**（被拒绝的遗赠）：一个子类或实现者忽略或覆盖了它继承来的大部分东西。→ 放弃继承，改用组合。

### 4. 并行生成两个子代理

把两个子代理调用一起发出，放在前台，然后汇总它们返回的报告。

**标准子代理的提示词**应包含：

- 完整的 diff 命令和提交列表。
- 你在第 3 步找到的标准来源文件清单，**再加上第 3 步的坏味道基线**，全文粘贴进去（子代理没有别的途径拿到它）。
- 简报：“Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words.”

**规格子代理的提示词**应包含：

- diff 命令和提交列表。
- 规格的路径或已获取的内容。
- 简报：“Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words.”

如果规格缺失，跳过规格子代理，并在最终报告里说明这一点。

### 5. 汇总

把两份报告分别放在 `## Standards` 和 `## Spec` 标题下，原样或用轻度清理的版本呈现。**不要**合并或重排发现，因为这两个轴是被故意分开的（见*为什么是两个轴*）。

以一行摘要结束：每个轴的发现总数，以及*每个轴内部*最严重的问题（如果有）。不要在轴之间选一个总冠军：那正是这种分离要防止的重排。

## 为什么是两个轴

一次改动可以通过一个轴而失败于另一个轴：

- 代码遵守了每条标准，但实现了错误的东西 → **标准通过，规格失败。**
- 代码完全照 issue 要求做了，但破坏了项目的约定 → **规格通过，标准失败。**

分开报告可以防止一个轴掩盖另一个轴。