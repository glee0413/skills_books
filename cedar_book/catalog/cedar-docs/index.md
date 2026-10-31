---
id: cedar-docs/index
title: 文档首页
description: 介绍 Cedar 的定位、策略与实体等四个基本要素、语言特性，以及初学者的阅读顺序。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/index.md
snapshotPath: source-snapshots/cedar-docs/docs/index.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/index.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 文档首页

Cedar 是一门用来编写授权策略、并依据这些策略做出授权决策的语言。应用在真正执行操作之前，先向 Cedar 的授权引擎提一个问题：“这个请求是否被授权？”决策为 allow 就继续执行业务，为 deny 就返回错误。本指南对应 Cedar 语言 4.6 版。

## 把授权逻辑拿出来

整本指南反复强调的一点，是把授权逻辑与业务代码分开。策略独立于代码之后：安全团队调整权限不必修改应用；多个团队各自维护后端时，改策略不需要跨团队协调；策略一改，判定逻辑立刻变化，无需全系统发布或停机；授权模型独立后更易测试；策略可读可分析，新成员也能看懂。Cedar 的求值是动态的，所以 access control 的变更可以即时生效。

## 四个基本要素

- **授权策略（policy）**：描述谁（principal）在什么上下文（context）下，能对哪些资源（resource）执行哪些动作（action）。原文给了三类例子：只有 `janeFriends` 组成员能查看和评论 `janeVacation` 相册里的照片；公司员工只能读自己的 HR 记录，且只能从特定 IP 访问；医疗应用中只有与病人当前关联的医生才能开具转诊。
- **实体（entity）**：Cedar 做决策时必须看到的应用数据。一个请求可能在问 `User::"jane"` 能否对 `Photo::"GoldenGateBridge.jpg"` 执行 `Action::"viewPhoto"`。`User`、`Action`、`Photo` 是实体类型，引号内是具体标识符。引擎还需要相关实体及其属性，例如 Jane 所在的组、包含这张照片的相册。
- **上下文（context）**：请求中的瞬时数据，由 schema 定义，每个动作有固定形状，例如请求时间、来源 IP、登录时是否使用 MFA。策略可据此限定“只允许公司网段”或“敏感管理操作必须 MFA”。
- **Schema**：声明应用认可的实体类型、属性、动作与上下文形状。Cedar 求值时**不**使用 schema，只在创建或更新策略时用它[验证](./validation.md)策略是否符合应用的真实结构。

## 一次决策长什么样

```cedar
permit (
    principal in UserGroup::"janeFriends",
    action in [Action::"viewPhoto", Action::"commentOnPhoto"],
    resource in Album::"janeVacation"
);
```

引擎把请求、策略与实体数据放在一起评估：有 permit 匹配、且没有 forbid 匹配时返回 allow，否则返回 deny。默认拒绝意味着“没写策略”就是“不允许”，这让权限模型天然收敛到最小授权。

## 语言特性

原文列出六点。**基于策略**：规则写明在什么条件下允许或拒绝。**支持属性**：主体、资源与上下文都带键值对，可表达角色、资源类型、时段、位置等。**有表达力**：一门简单语言同时覆盖 RBAC 与 ABAC，支持布尔运算、整数比较等操作符，足以做细粒度控制。**与代码分离**：策略动态求值，权限调整即时生效。**高性能**：策略结构可被索引，支持有界延迟的实时评估。**人类可读**：技术人员与非技术干系人都能参与策略评审。

## 从哪里开始读

第一次接触 Cedar 的读者，原文建议按这个顺序：先熟悉[术语与核心概念](./terminology.md)，再看 [PhotoFlash 示例场景](./scenario.md)，然后学[策略语法基础](./policy-syntax.md)，接着学[如何用 schema 验证策略](./schema.md)，最后完成官方教程。想把 Cedar 作为托管能力使用，可以看 Amazon Verified Permissions；其他已经采用 Cedar 的服务见[集成方式](./integrations.md)。