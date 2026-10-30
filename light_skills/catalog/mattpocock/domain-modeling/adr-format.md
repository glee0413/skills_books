---
id: mattpocock/domain-modeling/adr-format
title: adr-format
description: 规定 ADR 的存放位置、极简模板、可选小节，以及什么时候值得写一篇 ADR。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/domain-modeling/ADR-FORMAT.md
snapshotPath: source-snapshots/mattpocock/domain-modeling/adr-format.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/domain-modeling
---

# ADR 格式

ADR 放在 `docs/adr/` 下，使用连续编号：`0001-slug.md`、`0002-slug.md`，以此类推。

惰性创建 `docs/adr/` 目录：只在需要第一篇 ADR 时才创建。

## 模板

```md
# {决策的简短标题}

{1-3 句话：背景是什么，我们决定了什么，以及为什么。}
```

就这样。一篇 ADR 可以只有一段话。它的价值在于记下*某个*决策被做出、以及*为什么*，而不是把各个小节填满。

## 可选小节

只有当它们带来真实价值时才包含。大多数 ADR 都不需要。

- **Status** frontmatter（`proposed | accepted | deprecated | superseded by ADR-NNNN`）：在决策会被重新审视时有用
- **Considered Options**：只有当被否决的备选方案值得记住时才写
- **Consequences**：只有当存在不明显的下游影响需要点明时才写

## 编号

扫描 `docs/adr/` 中现有的最大编号，加一。

## 什么时候提出写 ADR

以下三条必须同时成立：

1. **难以逆转**：以后改主意要付出的代价是实质性的
2. **没有上下文会让人意外**：未来的读者看到代码会想“他们到底为什么这么做？”
3. **是真实取舍的结果**：确实存在备选方案，而你出于特定理由选了其中一个

如果一个决策很容易逆转，就跳过：你到时候直接逆转它就好。如果它不让人意外，没人会追问为什么。如果本来就没有真正的备选，除了“我们做了显而易见的事”之外也没什么可记的。

### 什么算数

- **架构形态。**“我们用 monorepo。”“写模型是事件溯源的，读模型投影到 Postgres。”
- **上下文之间的集成模式。**“Ordering 和 Billing 通过领域事件通信，而不是同步 HTTP。”
- **带锁定效应的技术选型。**数据库、消息总线、认证服务商、部署目标。不是每个库：只是那些换掉要花一个季度的。
- **边界与范围决策。**“客户数据归 Customer 上下文所有；其他上下文只通过 ID 引用它。”明确说出的“不做”和“做”一样有价值。
- **对显而易见路径的有意偏离。**“我们用原生 SQL 而不是 ORM，因为 X。”凡是合理的读者会假设成相反做法的地方都算。这类记录能阻止下一位工程师去“修好”一个本来就有意为之的东西。
- **代码里看不见的约束。**“因为合规要求，我们不能用 AWS。”“响应时间必须低于 200ms，这是合作方 API 合约的要求。”
- **被否决的备选方案，且否决理由不明显。**如果你考虑过 GraphQL，最后因微妙的原因选了 REST，就记下来；否则六个月后又会有人提议用 GraphQL。