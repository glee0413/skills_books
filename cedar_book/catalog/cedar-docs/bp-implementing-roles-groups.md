---
id: cedar-docs/bp-implementing-roles-groups
title: 用组实现角色
description: 为每组资源建立独立的审批人组和策略，把角色分配留在 IdP，并在授权请求中传入主体与资源的组成员关系。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-implementing-roles-groups.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-implementing-roles-groups.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-implementing-roles-groups.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 用组实现角色

本页把[实现基于角色的访问控制](./bp-implementing-roles.md)里的“审批人”角色细化到资源子集：不再用一个 `Approver` 组管所有时间表，而是按国家各建一个组——`Approver-France`、`Approver-Germany`、`Approver-UK`。每个角色在策略存储里对应一条策略。

## 每组资源一条策略

三条策略的结构完全相同，只有组名和资源组名不同：

```cedar
// Role to approve French timesheets
permit (
    principal in Role::"Approver-France",
    action in Action::"ApproverActions",
    resource in TimesheetGrp::"French-timesheets"
);
```

```cedar
// Role to approve German timesheets
permit (
    principal in Role::"Approver-Germany",
    action in Action::"ApproverActions",
    resource in TimesheetGrp::"German-timesheets"
);
```

英国版同理，把两处名字换成 `Approver-UK` 与 `UK-timesheets`。这种写法的优点是每条策略都能直接读出“谁、在哪些资源上、能做什么”，验证器也容易判断作用域；代价是策略数量随资源分组线性增长。

## 分配用户

管理员把用户加入对应组即完成角色分配。例如 Bob 同时属于 `Approver-France` 和 `Approver-Germany`，Alice 属于 `Approver-France` 和 `Approver-UK`。关键点是：**策略存储不记录用户被分配了哪些角色**，组成员关系必须由 Cedar 之外的系统维护，通常是 IdP。Cedar 只负责在请求时按传入的实体数据求值。

## 发起授权请求

应用调用 `IsAuthorized` 时，`entities` 必须描述主体的组成员关系与资源的组成员关系。判断 Alice 能否审批 JeanPaul 的时间表，请求里至少要包含：Alice 所属的组列表，以及 JeanPaul 的时间表所属的组列表。缺任何一侧，`principal in ...` 或 `resource in ...` 都无法匹配。

原文还区分了两种部署：自建授权引擎（直接用 Cedar SDK）时，调用方还要把相关策略一并传入；使用 Amazon Verified Permissions 这类托管服务时，服务会从策略存储中自行挑选要评估的策略。这个差别决定了“策略如何到达求值器”，但不改变请求里实体数据的形状。

## 扩展到新国家

进入日本市场时，要在 IdP 新建 `Approver-Japan` 组，并为该组新增一条策略，只允许其成员审批日本时间表：

```cedar
// Role policy to approve Japanese timesheets
permit (
    principal in Role::"Approver-Japan",
    action in Action::"ApproverActions",
    resource in TimesheetGrp::"Japanese-timesheets"
);
```

也就是说，每次扩张都是“一个组 + 一条策略”的固定成本。若资源分组会像项目那样频繁增减，这种成本会迅速累积，此时应改用[用属性实现角色](./bp-implementing-roles-attributes.md)或[用模板实现角色](./bp-implementing-roles-templates.md)。