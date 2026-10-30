---
id: mattpocock/domain-modeling/glossary-format
title: glossary-format
description: 规定 GLOSSARY.md 的结构、术语定义规则，以及单上下文与多上下文仓库各自的组织方式。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/domain-modeling/GLOSSARY-FORMAT.md
snapshotPath: source-snapshots/mattpocock/domain-modeling/glossary-format.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/domain-modeling
---

# GLOSSARY.md 的格式

## 结构

```md
# {上下文名称}

{一到两句话，说明这个上下文是什么、为什么存在。}

## Language

**Order**：
{对这个术语的一到两句说明}
_Avoid_：Purchase、transaction

**Invoice**：
交付之后发送给客户的付款请求。
_Avoid_：Bill、payment request

**Customer**：
下单的个人或组织。
_Avoid_：Client、buyer、account
```

## 规则

- **要有主见。**同一个概念存在多个说法时，选出最好的那个，其余列在 `_Avoid_` 下。
- **定义要紧凑。**最多一到两句。定义它*是*什么，而不是它*做*什么。
- **只收录本项目上下文特有的术语。**通用编程概念（超时、错误类型、工具函数模式）不该进来，即使项目大量使用它们。添加术语前先问：这是这个上下文独有的概念，还是通用编程概念？只有前者属于这里。
- **自然形成聚类时，把术语分到小标题下。**如果所有术语都属于同一个内聚领域，平铺列表也可以。

## 单上下文与多上下文仓库

**单上下文（大多数仓库）：**仓库根目录放一个 `GLOSSARY.md`。

**多上下文：**仓库根目录放一个 `GLOSSARY-MAP.md`，列出各个上下文、它们所在的位置，以及彼此的关系：

```md
# Glossary Map

## Contexts

- [Ordering](./src/ordering/GLOSSARY.md)：接收并跟踪客户订单
- [Billing](./src/billing/GLOSSARY.md)：生成发票并处理付款
- [Fulfillment](./src/fulfillment/GLOSSARY.md)：管理仓库拣货与发货

## Relationships

- **Ordering → Fulfillment**：Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费这些事件开始拣货
- **Fulfillment → Billing**：Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费它们来生成发票
- **Ordering ↔ Billing**：共享 `CustomerId` 和 `Money` 类型
```

技能会推断适用哪种结构：

- 如果存在 `GLOSSARY-MAP.md`，读它来找到各个上下文
- 如果只有根目录的 `GLOSSARY.md`，就是单上下文
- 如果两者都不存在，在第一个术语确定时惰性创建根目录的 `GLOSSARY.md`

存在多个上下文时，推断当前话题与哪个上下文相关。如果不清楚，就问。