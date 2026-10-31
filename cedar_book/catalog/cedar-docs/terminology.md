---
id: cedar-docs/terminology
title: 术语与核心概念
description: 梳理 Cedar 的授权、策略、实体、命名空间、组层级与 Schema 等核心术语，为后续各页建立共同词汇。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_overview/terminology.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_overview/terminology.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_overview/terminology.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 术语与核心概念

Cedar 用一套不大的词汇描述细粒度权限。这一页先把后面反复出现的名词钉死：授权与认证的边界、策略的构成、请求如何被求值、实体与 UID 长什么样，以及 schema 在其中扮演什么角色。

## 授权与认证

**授权（authorization）**判断一个具体请求是否被既定策略集合允许，做法是把每个进来的请求与策略集合逐一比对。**认证（authentication）**在它之前发生，负责证明“你确实是你”，手段可以是用户名密码、MFA 设备等。认证通过后，用户或设备才成为**主体（principal）**，可以发起请求。Cedar 只负责授权，不负责认证。

Cedar 把权限写成文本策略：哪些主体、能对哪些资源、执行哪些动作、在什么上下文中。应用在主体尝试操作时生成授权请求，Cedar 求值后给出 **allow** 或 **deny**。常见落地方式有两种：RBAC 把权限挂在角色/组上，再把人分配到组；ABAC 直接读主体与资源的属性，例如“被标为 owner 的用户自动可访问”。

## 策略的三要素

- **效果（effect）**：`permit` 或 `forbid`，声明这条策略的意图。
- **作用域（scope）**：主体、动作、资源的匹配范围，必填。只有作用域、没有额外条件的策略属于 RBAC 风格。
- **条件（condition）**：可选的 `when` / `unless` 子句，读取主体属性、资源属性和请求上下文（IP、时间、MFA 状态等），属于 ABAC 风格。

策略有两种形态。**静态策略**是独立完整的文本，拿来即可参与决策；**模板链接策略**由一个带占位符的模板加上具体的主体/资源值构成，模板本身不能直接用于决策。详见[策略模板](./templates.md)。

## 请求与求值

一次请求在问：“这个主体能否在此上下文中对该资源执行该动作？”Cedar 对每条策略求值，再合并结果，返回**授权响应**：决策（`Allow`/`Deny`）加上**决定策略（determining policies）**，即导致该结果的那些策略。应用必须自己收集相关实体数据、上下文，以及所有可能相关的策略；官方建议全量传入，避免漏掉某条策略。

求值算法与三条性质（默认拒绝、拒绝优先、出错跳过）在[授权如何工作](./authorization.md)中展开。

## 实体、UID 与属性

主体、动作、资源在 Cedar 里统一表示为**实体（entity）**。实体由**类型**和**标识符**组成 **UID**，写作 `User::"jane"`、`Action::"ViewPhoto"`、`UserGroup::"kevinFriends"`。实体带有属性，对应系统里已知的信息，例如一张 `Photo` 可以有 `name`（字符串）、`createdDate`（DateTime）、`location`（Decimal 集合）和 `photographer`（指向另一个实体的引用）。

`Action` 是保留实体类型，只用于定义动作：动作完全由 schema 定义，是请求中 `action` 变量唯一允许的类型；schema 不能给动作实体定义属性或标签，但可以定义父实体（动作组），父实体同样必须是 `Action` 类型。

多个服务共用一个策略库时，`Action::"createTable"` 会产生歧义——是建数据库表还是建家具。**命名空间**就是为消除这种歧义而加的**类型前缀**，用 `::` 分隔，可任意嵌套：

```cedar
ExampleCo::Database::Table::"c7b981f1-97e4-436b-9af9-21054a3b30f1"
ExampleCo::Furniture::Table::"c7b981f1-97e4-436b-9af9-21054a3b30f1"
ExampleCo::This::Is::A::Long::Name::For::Something::"12345"
```

同一个标识符前缀不同，就是完全不同的实体，Cedar 不会把它们混为一谈。

## 组与层级

声明实体时给出 `parent`，所有同父实体即该组的成员；组可以再作为别的组的成员，从而表达多级层级。这个机制不只用于主体：文件夹可以嵌套文件夹，动作也能分组（`viewPhoto` 属于 `readOnly` 动作组）。策略里用 `in` 检查层级：

```cedar
permit (
    principal in Group::"janeFriends",
    action == Action::"ViewPhoto",
    resource in Album::"janeTrips"
);
```

## Schema 的位置

**Schema** 声明应用支持的实体类型、属性结构与动作集合。Cedar 用它验证策略：如果 schema 说 `age` 是 `Long`，那么 `unless { principal.age > "21" }` 会验证失败，因为 `>` 只接受 `Long`，带引号的数字是 `String`。不写 schema 也能运行，但类型或引用不一致时只能在运行时暴露问题，甚至返回错误结果，因此推荐为每个应用定义 schema。细节见[策略验证](./validation.md)。
