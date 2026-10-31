---
id: cedar-docs/bp-populate-policy-scope
title: 填充策略作用域
description: 说明为何要把 principal 与 resource 写进作用域、无约束策略的代价，以及角色、资源类型与动作划分上的三个常见错误。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-populate-policy-scope.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-populate-policy-scope.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-populate-policy-scope.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 填充策略作用域

作用域（scope）指策略中 `permit` 或 `forbid` 关键字之后、圆括号之内的部分，由 `principal`、`action`、`resource` 三个元素组成。官方建议：只要可能，就把 `principal` 和 `resource` 填成具体值。

## 为什么要填满作用域

填了值，策略在存储中就能被索引，授权时只取回相关策略，性能更好。若同一组权限要授予许多主体或资源，应使用[策略模板](./templates.md)，为每个主体-资源对链接一条，而不是写一条大策略。

也要避免在 `when` 里维护主体或资源列表：增删一个用户需要读出整条策略、编辑列表、整体写回，还要处理两个管理员互相覆盖的并发错误。改用多条细粒度策略后，增删用户只是增删对应那一条。

## 无约束策略的代价

把命令式的授权代码搬进 `when` 是最省事的路，但从扩展性和分析角度看是死路。旧世界里每个请求只运行该 handler 的那部分检查；如果所有策略都无约束，那么每个请求都要评估全部策略——I/O、性能、分析全面受损。真正的自主授权（任意用户可被授予任意资源）会退化成数百万条策略，没有 `principal`、`resource` 头部约束就难以跑得动。

理想情况是：被评估的条件数量不比旧方案显著增加。一个请求进来时，引擎只应评估与该主体、其组、该资源及其组相关的少数策略。为此要把授权模型切分好。

一条策略就代表主体与资源之间的一条关系。系统不变式（如“管理员可对所有资源做所有动作”）用全局策略表达；给具体用户授予具体对象时，每条策略对应那条具体关系。10 个用户乘 10 种资源得到 100 条策略是正常且正确的，Cedar 只评估相关子集。细粒度还让管理界面更简单：连接主体（组）与资源（组），不必拼 AST。

## 常见错误

**把角色或组写成属性。** `when { principal.role == "analyst" }` 让主体和资源都无约束，每个 `ViewReport` 请求都要评估。改成 `principal in App::Role::"analyst"`，角色成为实体层级中的组，引擎按主体索引，非成员请求直接跳过：

```cedar
permit(
    principal in App::Role::"analyst",
    action == App::Action::"ViewReport",
    resource
);
```

**以为没有资源可写。** 总能限制资源类型。最简单的 `is` 子句只要求资源属于某类型，不符时策略根本不必取：

```cedar
permit(
    principal == App::User::"alice",
    action == App::Action::"ViewDashboard",
    resource is App::Dashboard
);
```

更细可用**合成资源组**：造一个代表“该类型全部资源”的实体，请求时作为每个资源的父级，策略写 `resource in App::Dashboard::"all"`。多租户则把租户建成父节点，用 `resource in Platform::Tenant::"acmeCorp"`，比在 `when` 里查租户属性更好索引。`is` 简单优先，需要类型之外的层级分组时再用合成组。

**动作太泛。** `View`、`Read` 横跨几十种资源时，要么权限过宽，要么在 `when` 里用 `resource has projectId` 做鸭子类型，脆弱且难分析。应定义 `ViewProject`、`ViewDocument`、`ViewDashboard` 等业务动作，每个只对应一种资源类型，作用域自然填得满；动作划分见[最佳实践概览](./best-practices.md)，实体层级见[实体与实体层级](./entities.md)。