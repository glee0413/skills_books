---
id: mattpocock/setup-matt-pocock-skills/domain
title: domain
description: 说明工程类技能在探索代码库时应当如何读取这个仓库的领域文档。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/setup-matt-pocock-skills/domain.md
snapshotPath: source-snapshots/mattpocock/setup-matt-pocock-skills/domain.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/setup-matt-pocock-skills
---

# 领域文档

工程类技能在探索代码库时，应当如何读取这个仓库的领域文档。

## 探索之前，先读这些

- 仓库根目录的 **`GLOSSARY.md`**，或者
- 仓库根目录的 **`GLOSSARY-MAP.md`**（如果存在）：它指向每个上下文各自的 `GLOSSARY.md`。把与当前话题相关的那些都读一遍。
- **`docs/adr/`**：读那些涉及你即将改动的区域的 ADR。在多上下文仓库里，还要检查 `src/<context>/docs/adr/` 中按上下文划分的决策记录。

如果这些文件不存在，**静默继续**。不要指出它们缺失，也不要建议预先创建它们。`/domain-modeling` 技能（经由 `/grill-with-docs` 和 `/improve-codebase-architecture` 到达）会在术语或决策真正被敲定时按需创建它们。

## 文件结构

单上下文仓库（大多数仓库）：

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `GLOSSARY-MAP.md`）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 上下文专属决策
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## 使用术语表中的词汇

当你的输出要指出某个领域概念时（无论是在 issue 标题、重构提案、假设还是测试名称里），都用 `GLOSSARY.md` 中定义的词。不要漂移到术语表明确避开的同义词上。

如果你需要的概念还不在术语表里，这本身是个信号：要么你在发明这个项目并不使用的语言（请重新考虑），要么这里确实存在空白（记下来，交给 `/domain-modeling`）。

## 标出 ADR 冲突

如果你的输出与现有 ADR 相矛盾，要明确说出来，而不是悄悄覆盖：

> _这与 ADR-0007（事件溯源的订单）相矛盾，但值得重新讨论，因为……_