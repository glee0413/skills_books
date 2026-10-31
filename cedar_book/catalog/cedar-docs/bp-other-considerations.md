---
id: cedar-docs/bp-other-considerations
title: 其他考虑
description: 讨论授权查询除拦截请求之外的用途，以及列表与界面渲染需求如何反过来影响 ABAC 与 RBAC 的取舍。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-other-considerations.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-other-considerations.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-other-considerations.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 其他考虑

原文标题是“考虑查询授权的其他理由”。我们通常把授权检查与用户请求绑定：判断用户有没有权限执行该请求。但授权数据也可以反过来影响应用界面的设计。

## 不只是拦截请求

例如首页只想列出终端用户可访问的那些资源；打开某个资源的详情页时，界面只显示该用户能对该资源执行的操作。这类“先问再渲染”的用法要求授权查询不仅能对单个请求回答允许或拒绝，还要能支撑枚举和过滤。

## “谁能访问什么”的查询成本

这些场景会给授权模型带来权衡。原文指出：重度依赖 ABAC 时，回答“谁能访问什么”会更困难，因为必须把每条规则对每个主体和资源逐一比对，才能确定是否匹配。一个需要优化“只列出我可访问资源”的产品，可能更适合采用 RBAC：遍历附加到某个用户的全部策略，就能确定其资源访问范围，比逐条规则做全量比对便宜得多。

## 建模时的取舍

也就是说，同一个系统里往往同时存在两类问题：

- “这个主体能否对这个资源做这个动作？”——ABAC 的属性判断很自然；
- “这个主体能访问哪些资源？”——需要可枚举、可索引的结构，组与角色更合适。

设计时先确认产品是否真的需要后者，再决定哪些权限放在组或角色上、哪些留给属性条件。否则模型定型后才发现列表页无法高效实现，改造成本会很高。这也是[最佳实践概览](./best-practices.md)把这条列在最后、作为收尾提醒的原因；列表型端点本身的设计见[授权模式](./auth-patterns.md)，把角色交给组承载的做法见[利用用户组](./bp-user-groups.md)。