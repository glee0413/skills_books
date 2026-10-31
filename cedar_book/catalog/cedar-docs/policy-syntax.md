---
id: cedar-docs/policy-syntax
title: 策略语法基础
description: 逐项拆解策略的 effect、scope、conditions 与 annotations，并给出 principal、action、resource 的常用匹配写法。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/syntax-policy.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/syntax-policy.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/syntax-policy.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 策略语法基础

一条 Cedar 策略是一段文本文档，由四部分组成：**效果**（必填）、**作用域**（必填）、**条件**（可选）、**注解**（可选），并且必须以分号 `;` 结尾。只有当请求精确匹配作用域、所有 `when` 为真、所有 `unless` 为假时，这条策略才求值为 `true`。

## 效果：permit 与 forbid

`permit` 表示策略匹配时产生 `Allow`，`forbid` 表示匹配时产生 `Deny`。所有策略求值后这样合并：

- 至少一条匹配策略给出 `Allow`，且**恰好零条**策略给出 `Deny`，整体为 `Allow`；
- 至少一条策略给出 `Deny`，**或**恰好零条策略给出 `Allow`，整体为 `Deny`。

由此得到两条要点：空策略集的默认结果是拒绝，称为**隐式拒绝（implicit deny）**；任何一条策略给出拒绝，整体就是拒绝，称为**显式拒绝（explicit deny）**。显式拒绝**永远**压过其他策略的允许。

```cedar
permit (
    principal == User::"alice", 
    action == Action::"view", 
    resource == Photo::"VacationPhoto94.jpg"
);
```

上面的 `permit` 允许 Alice 查看某张照片。下面的 `forbid` 则禁止任何人操作 `private` 为 `true` 的资源，资源所有者也不例外地受此约束——但反过来说，这条策略不授予任何权限，所有者要走通请求，仍需另一条显式允许的策略。

```cedar
forbid (
    principal,
    action,
    resource
)
when {
    resource.private
}
unless {
    principal == resource.owner
};
```

## 作用域：principal、action、resource

作用域回答三个问题：谁在请求、想做什么操作、对什么资源做。三者的顺序固定。

`principal` 必须出现；只写 `principal` 而不加约束，表示匹配**任意**主体。建议不要把角色或组直接当作主体，否则以后无法写更具体的策略，例如 `principal.level >= 10` 这样的用户属性判断。

```cedar
//matches any principal entity of any type
principal

//matches only the one specified entity of type User
principal == User::"alice"

//matches any principal in the hierarchy of the specified Group
principal in Group::"alice_friends"

//matches any principal of type User
principal is User

//matches any principal of type User in the hierarchy of the specified Group
principal is User in Group::"alice_friends"
```

`action` 可以是一个动作，也可以是动作列表或动作组。`resource` 与 `principal` 一样必须出现，不加约束即匹配任意资源。

```cedar
action

action == Action::"view"

action in [Action::"listAlbums", Action::"listPhotos", Action::"view"]

action in Action::"admin"
```

```cedar
resource

resource == Photo::"VacationPhoto94.jpg"

resource in Album::"alice_vacation"

resource is Photo

resource is Photo in Album::"alice_vacation"
```

## 条件：when 与 unless

条件补充与本次请求相关的细节：来源 IP、HTTP 头、时间、用户的认证状态，或者主体与资源的属性。每个 `when` 都必须为 `true`、每个 `unless` 都必须为 `false`，策略才算匹配。作用域里的 principal/action/resource 是系统中的稳定信息，每次请求都带；`context` 是某个时间点的请求信息，只在相关场景中需要。

```cedar
permit (
    principal, 
    action == Action::"editPhoto", 
    resource
)
when {
   resource.owner == principal
};
```

`when` 在表达式为 `true` 时让策略匹配。下例要求主体属于 `HardwareEngineering` 且 `jobLevel` 至少为 5；任一属性缺失，策略都不匹配。

```cedar
when {
    principal.department == "HardwareEngineering" 
    &&
    principal.jobLevel >= 5
}
```

`unless` 则在表达式为 `false` 时让策略匹配。下例在调用方未启用 MFA 时拒绝请求：

```cedar
forbid ( principal, action, resource )
unless {
  context.authentication.usedMFA
};
```

`when` 与 `unless` 按书写顺序求值，这一点在多个子句都可能出错时决定了你看到哪条错误，详见[PhotoFlash 示例场景](./scenario.md)。

## 注解

注解是挂在策略上的任意键值对，**不影响求值**，只是随策略一起存储，供读取策略的服务使用。它只能放在策略最顶端、效果之前，形式为 `@name("value")`；省略值时相当于空字符串，`@shadow_mode` 等价于 `@shadow_mode("")`。

```cedar
@advice("My advice")
@id("My ID")
@shadow_mode
permit (
    ...
);
```

注意 `@id` 在 Cedar 语言里并不特殊，它和别的注解一样；Cedar CLI 用它来设置策略 ID，而 Rust API 等接口另有设置方式。

## 标识符安全

示例中的 `jane`、`bob` 只为可读。生产系统应使用 UUID 之类永不复用的标识符，否则旧名字被新人复用时会连带继承旧策略授予的权限。用 UUID 时建议加 `//` 注释标出友好名：

```cedar
principal == User::"a1b2c3d4-e5f6-a1b2-c3d4-EXAMPLE11111", // alice
```

作用域之外，数据类型见[数据类型](./data-types.md)，条件里可用的运算见[操作符](./operators.md)。
