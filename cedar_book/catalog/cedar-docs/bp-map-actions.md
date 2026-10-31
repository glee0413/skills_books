---
id: cedar-docs/bp-map-actions
title: 把动作映射到业务域
description: 反对用 Create/View/Update/Delete 这类通用动作覆盖多种资源，主张按资源类型定义业务动作以获得精确作用域。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-map-actions.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-map-actions.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-map-actions.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 把动作映射到业务域

设计授权模型时，动作应当是**业务动作**，而不是 API 动作。不要把 `POST`、`GET` 定义成动作，而要关注用户真正完成的事情。原文的例子是支持技术员执行的 `CreateSupportCase`、`ListSupportCase`、`ViewSupportCase`。

## 通用动作为什么是坏实践

假设一个项目管理应用的 schema 这样写：

```cedar
action View appliesTo {
    principal: [User],
    resource: [Project, Task, TaskComment, Sprint, Epic]
};
```

`Create`、`Update`、`Delete` 也照此覆盖五种资源。这样一个 `View` 的 `appliesTo` 里塞了五种资源类型，会把人逼进两个都不好的选项。

**选项一：权限过宽。** 不限定资源的 `View` 策略会覆盖 `View` 适用的**所有**资源类型。用户一旦获得某类资源的查看权，就顺带获得了其余全部：

```cedar
// Grants View access to ALL resource types — documents, projects, dashboards, etc.
permit(
    principal == ProjectApp::User::"alice",
    action == ProjectApp::Action::"View",
    resource
);
```

**选项二：在 `when` 里做脆弱的鸭子类型判断。** 为了收窄范围，只能靠属性是否存在来猜资源类型：

```cedar
// Fragile — relies on attribute presence to infer resource type
permit(
    principal == ProjectApp::User::"alice",
    action == ProjectApp::Action::"View",
    resource
)
when {
    resource has projectId &&
    resource.projectId == "proj-123"
};
```

原文对这种写法的评价很直接：脆弱、难以分析，基本抵消了类型化 schema 的意义；而且资源作用域没有约束，授权引擎无法高效地为策略建索引。作用域为何影响性能，见“填充策略作用域”一页的说明。

## 按资源类型定义动作

替代方案是让每个业务动作精确对应一种资源类型。把 `CreateProject`、`ViewProject`、`UpdateProject`、`DeleteProject` 分别声明，再为 Task、TaskComment、Sprint、Epic 各写一组：

```cedar
// Project actions
action CreateProject appliesTo {
    principal: [User],
    resource: [Project]
};
action ViewProject appliesTo {
    principal: [User],
    resource: [Project]
};
```

动作多了，但每个动作的语义和责任范围都清楚。策略也随之变得具体：

```cedar
permit(
    principal == ProjectApp::User::"alice",
    action == ProjectApp::Action::"ViewProject",
    resource is ProjectApp::Project
);
```

注意这里用 `resource is ProjectApp::Project` 进一步锁死资源类型。即使动作定义将来被放宽，策略本身仍表达“只针对项目”。

## 收益与边界

按资源定义动作带来三方面好处：策略作用域可写满，读起来就是一句业务规则；验证器能借助 schema 检查类型；授权引擎能按动作和资源类型索引策略，减少每次请求的候选集。代价是 schema 更长，动作数量随资源类型相乘增长。缓解办法是用动作组表达“同一角色的多个动作”，例如把项目的四个动作收进一个组，再由角色策略引用该组，写法见[实现基于角色的访问控制](./bp-implementing-roles.md)。

粒度选择与[细粒度权限](./bp-fine-grained-permissions.md)相互呼应：先按资源类型拆出业务动作，再判断同一资源上的读写是否还需要继续细分。两者共同决定了策略能写得多精确。