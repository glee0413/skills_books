---
id: mattpocock/teach/learning-record-format
title: learning-record-format
description: 规定教学工作区里学习记录的模板、编号方式与何时该写一条。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/teach/LEARNING-RECORD-FORMAT.md
snapshotPath: source-snapshots/mattpocock/teach/learning-record-format.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/teach
---

# 学习记录格式

学习记录存放在 `./learning-records/`，使用连续编号：`0001-slug.md`、`0002-slug.md`，以此类推。目录按需创建：只在写下第一条记录时才建。

它们是 ADR 在教学上的对应物：捕捉不显然的经验、关键洞见，以及用户已声明的先备知识，这些都会左右后续会话。它们用来计算最近发展区。

## 模板

```md
# {所学或所确立内容的一句话标题}

{1–3 句话：学到了什么（或确立了哪些先备知识），以及它为什么对后续会话重要。}
```

这就是全部格式。一条学习记录可以只有一个段落。价值在于记下_这件事现在已算掌握_，以及_它为什么改变了接下来该教什么_，而不在于把各节填满。

## 可选小节

只有确实增加价值时才包含它们。大多数记录都用不上。

- **Status** frontmatter（`active | superseded by LR-NNNN`）：当早先的理解被证明是错的并被替换时，很有用。
- **Evidence**：用户如何展示了这份理解（回答了一个问题、完成了一次练习、引用了以往经验）。当这个判断将来可能被重新审视时，很有用。
- **Implications**：这对后续会话解锁了什么、排除了什么。不显然时值得记下。

## 编号

扫描 `./learning-records/`，找到现有的最大编号，加一。

## 何时写一条学习记录

以下任一条成立时就写：

1. **用户对某件并不简单的事展示了真正的理解**：不只是接触过，而是有证据表明他们能正确使用这个概念。这为接下来能教什么设定了新的下限。
2. **用户披露了先备知识**：“这个我已经会了。”记下来，这样后续会话不会重复教。同时记下对方声称的_深度_。
3. **一个误解被纠正了**：用户原先相信错误的说法，现在明白了为什么错。这类记录价值很高：它们能预判相关话题上未来的绊脚石。
4. **使命因学习而改变**：用户发现自己真正在意的和他们原先以为的不同。交叉链接到 [[MISSION.md]] 并更新它。

### 哪些情况_不算_

- 仅仅覆盖过的材料。覆盖不等于学会。等证据。
- 已经以术语定义的形式简洁记在 [[GLOSSARY.md]] 里的内容。不要重复。
- 逐次的会话活动日志。学习记录不是日记：它们是决策级的洞见。

## 取代

当后一条记录与早先的记录矛盾时（用户的理解加深或纠正了），把旧记录标成 `Status: superseded by LR-NNNN`，而不是删除它。理解如何演变的历史本身就是有用的信号。