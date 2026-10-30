---
id: mattpocock/domain-modeling
title: domain-modeling
description: 在设计过程中主动构建并磨利项目的领域模型，当场更新 GLOSSARY.md，并谨慎地记录 ADR。
invocation: model
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/domain-modeling/SKILL.md
snapshotPath: source-snapshots/mattpocock/domain-modeling/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 领域建模

在设计过程中主动构建并磨利项目的领域模型。这是一门*主动*纪律：挑战用词、发明边界情况场景、在术语和决策一旦成形的那一刻就把它们写下来。（仅仅为了词汇而*读* `GLOSSARY.md` 并不属于这个技能：那只是任何技能都能做的一行习惯。这个技能用于你在改变模型的时候，而不只是消费它。）

## 文件结构

大多数仓库只有一个上下文：

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

如果根目录存在 `GLOSSARY-MAP.md`，这个仓库有多个上下文。地图指向每一个所在的位置：

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← 系统级决策
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← 上下文相关的决策
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

惰性创建文件：只有当你确实有东西要写时才建。如果没有 `GLOSSARY.md`，在第一个术语被定下来时创建它。如果没有 `docs/adr/`，在需要第一条 ADR 时创建它。

## 会话进行中

### 对照术语表挑战

当用户使用了一个与 `GLOSSARY.md` 中既有语言冲突的词，立刻指出来。“你的术语表把 ‘cancellation’ 定义为 X，但你似乎想说的是 Y。到底是哪一个？”

### 磨利模糊的语言

当用户使用含糊或承载过多含义的词，提出一个精确的规范术语。“你说的是 ‘account’：你是指 Customer 还是 User？这是两回事。”

### 讨论具体场景

当讨论领域关系时，用具体场景去做压力测试。发明一些探查边界情况的场景，迫使用户对概念之间的界限保持精确。

### 与代码交叉对照

当用户陈述某事如何运作时，检查代码是否同意。如果你发现矛盾，就把它摆出来：“你的代码取消整个 Order，但你刚说部分取消是可能的。哪个对？”

### 就地更新 GLOSSARY.md

一个术语被定下来时，就在那里更新 `GLOSSARY.md`。不要攒批处理：发生的时候就捕获。使用 [GLOSSARY-FORMAT.md](./glossary-format.md) 里的格式。

`GLOSSARY.md` 应当完全没有实现细节。不要把 `GLOSSARY.md` 当作规格、草稿纸或实现决策的仓库。它只是术语表，仅此而已。

### 谨慎地提议 ADR

只有当以下三条全部为真时，才提议创建 ADR：

1. **难以逆转**：以后改变主意的代价是有分量的
2. **脱离上下文会令人意外**：未来的读者会问“他们为什么这么做？”
3. **真实取舍的结果**：确实存在其他选项，而你出于具体理由选了这一个

三条中缺任何一条，就跳过 ADR。使用 [ADR-FORMAT.md](./adr-format.md) 里的格式。