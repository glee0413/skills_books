---
id: cedar-docs/authorization
title: 授权如何工作
description: 拆解 PARC 请求、策略求值与结果合并算法，并用四条策略的完整例子演示 determining policies 的产生。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_auth/authorization.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_auth/authorization.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_auth/authorization.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 授权如何工作

应用每次要对受保护资源做操作，都得调用 Cedar 的授权引擎（authorizer），让它拿请求去比对策略库，给出 `Allow` 或 `Deny`。这一页讲清楚这个决定是怎么算出来的。

## 请求的四个部分：PARC

一次授权请求在问：“这个主体能否在此上下文中对该资源执行该动作？”形式化地，请求由四部分组成：

- **P**：主体（principal）
- **A**：动作（action）
- **R**：资源（resource）
- **C**：请求上下文（context）

其中 P、A、R 是实体引用，C 是一个记录。

概念上，应当假设授权器在求值时能看到应用的全部策略与实体数据。工程上这往往太贵，应用需要自己判断哪些策略和实体数据是**相关**的；一种确定所需实体数据的方法是分级验证与按层切片。

## 求值与结果合并

授权器先对每条策略求值，结果有三种：`true`（策略满足请求）、`false`（不满足）、`error`（求值出错）。然后按三条规则合并：

1. 只要有任一 `forbid` 策略求值为 `true`，最终结果为 `Deny`。
2. 否则，只要有任一 `permit` 策略求值为 `true`，最终结果为 `Allow`。
3. 否则（没有任何策略被满足），最终结果为 `Deny`。

响应里除决策外还有诊断信息：**决定策略（determining policies）**和错误情况。`Allow` 时，决定策略是那些满足请求的 `permit`；`Deny` 由 `forbid` 造成时，是那些满足请求的 `forbid`；若因无策略满足而拒绝，决定策略列表为空。无论结果如何，任何求值出错的策略都会连同错误细节出现在诊断里。

## 三条性质的由来

- **默认拒绝**：没有 `permit` 明确授权，结果就是 `Deny`。
- **拒绝优先**：任何被满足的 `forbid` 都压过 `permit`，产生 `Deny`。
- **出错跳过**：求值为 `error` 的策略不参与本次决策。

前两条让策略好读：读者只需理解每条 `permit` 说了什么，不必推理它没说什么；`forbid` 则可以独立理解，相当于给 `permit` 划下永远不能越过的护栏。第三条的理由更微妙：另一种设计是“任一策略出错就拒绝整个请求”，听起来稳妥，但一条有 bug 的新策略会让原本工作正常的应用突然拒绝**全部**请求。跳过错误保留了可用性，应用仍可选择读诊断、自行采取更严格的处置。

## 表达式求值

策略求值的核心是**表达式求值**。作用域里的每个约束、每个 `when`、每个 `unless` 都是表达式，例如 `resource.tags.contains("private")`、`action == Action::"viewPhoto"`、`principal in Team::"admin"`。

求值像普通编程语言一样不断化简，直到得到 Cedar 值（`true`、`1`、`User::"Alice"`、`"blue"`）或 `error`。没有变量的表达式很直接：`2+2` 得 `4`，`if false then "blue" else "green"` 得 `"green"`。含 `principal`、`action`、`resource`、`context` 的表达式，则先由授权器把这些变量**绑定**到请求中的值，再求值。比如把 `action` 绑定为 `Action::"viewPhoto"` 后，`action == Action::"viewPhoto"` 自然为真；把 `resource` 绑定为 `Photo::"vacation94.jpg"` 后，`resource.tags.contains("Private")` 需要到实体数据里查该照片的 `tags`：包含该字符串为真，是集合但不包含为假，属性缺失或不是集合则报错。

## 策略是否满足请求

对策略 *y*，记 *Principal(y)*、*Action(y)*、*Resource(y)* 分别为作用域中的约束，没有约束时视为 `true`；*Conds(y)* 是 `when`/`unless` 列表。

第一步判断**匹配**：把 P、A、R 分别代入三个约束求值，三者都为 `true` 才算匹配（Cedar 的设计保证这三步不会出错）。匹配之后，按顺序求值条件：`when` 为 `true` 才算满足，`unless` 为 `false` 才算满足。遇到第一个不满足的条件立即返回 `false`，不再看后面的条件；任一条件求值出错则返回 `error` 并停止。所有条件都满足，策略才返回 `true`。

## 完整例子

请求：`jane` 能否对 `vacation.jpg` 执行 `viewPhoto`？

- *P* = `User::"jane"`，*A* = `Action::"viewPhoto"`，*R* = `Photo::"vacation.jpg"`，*C* = `{}`
- 实体数据：`User::"jane"` 属于 `Group::"kevinsFriends"`；照片的 `.owner` 是 `User::"kevin"`，`.tags` 是 `["Private","Work"]`

四条策略的结果：

```cedar
permit (
    principal == User::"jane",
    action,
    resource == Photo::"vacation.jpg"
);
```

P1 满足：主体与资源约束都为真，动作未约束视为真，无条件。

```cedar
permit (
    principal in UserGroup::"kevinFriends",
    action == Action::"viewPhoto",
    resource
)
when {
    resource.tags.contains("Holiday")
};
```

P2 匹配但条件为假——`tags` 里没有 `"Holiday"`，所以不满足。

```cedar
forbid (
    principal,
    action == Action::"viewPhoto",
    resource
)
when { resource.tags.contains("Private") }
unless { principal == resource.owner };
```

P3 满足：`tags` 含 `"Private"`，而所有者是 `kevin` 不是 `jane`，`unless` 为假。

```cedar
permit (
    principal,
    action == Action::"updateTags",
    resource
)
when { principal == resource.owner };
```

P4 不匹配：动作是 `viewPhoto`，不等于 `updateTags`。

综合起来：`permit` P1 为真、P2 为假，`forbid` P3 为真，`permit` P4 为假。按规则 1，最终决策是 `Deny`，决定策略为 P3。
