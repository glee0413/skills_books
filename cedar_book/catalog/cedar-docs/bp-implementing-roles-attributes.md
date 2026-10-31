---
id: cedar-docs/bp-implementing-roles-attributes
title: 用属性实现角色
description: 当资源组数量随项目快速增长时，用主体与资源的属性条件替代为每个资源组新建角色组和策略。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-implementing-roles-attributes.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-implementing-roles-attributes.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-implementing-roles-attributes.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 用属性实现角色

这是[用组实现角色](./bp-implementing-roles-groups.md)的替代方案。上一页的做法要求每个资源分组都在身份提供方（IdP）里建一个用户组、在策略存储里建一条策略；当资源分组是国家时这还能接受，因为国家数量有限、变化也慢。原文举的例子是公司每年可能新进五个国家，新增用户组和策略的开销并不显著。

## 项目场景为什么撑不住

把资源分组换成项目，问题立刻放大。每启动一个项目，就要为该项目的时间表审批人建一个组：`Approver-project03344`、`Approver-project03345`、`Approver-project03346`，如此类推。一家全球公司一年可能启动和结束数百个项目，目录里会堆出成千上万个角色，管理成本不可忽略。

## 一条带属性条件的策略

此时应判断能否用属性条件表达“这个角色可以操作哪些资源”。若主体带有 `assignedProjects` 属性，时间表资源带有 `project` 属性，就可以只写一条审批人策略，靠比较两个值来限定范围：

```cedar
// Role to approve timesheets for the principal's assigned projects
permit (
    principal in Role::"Approver",
    action in Action::"ApproverActions",
    resource in TimesheetGrp::"all-timesheets"
) when {
    principal.assignedProjects.contains(resource.project)
};
```

注意作用域仍然保留角色组和资源组，细粒度约束放在 `when` 里。这样一条策略覆盖所有项目，新增项目不需要改策略。

## 分配角色与发起请求

管理员把用户加入 `Role::"Approver"` 组即完成角色分配，同时必须设置该用户的 `assignedProjects` 属性，指明其能审批**哪些**项目。授权请求除了传主体的组成员关系和资源的组成员关系，还要带上相关属性值：主体的 `assignedProjects` 与资源的 `project`，否则 `when` 子句无法求值。

## 前提与取舍

原文给出一个重要限定：这套方案优雅的前提是这些属性**已经存在**，或应用能在请求时实时算出。如果为了权限管理专门扩展应用去记录和维护属性，那不如把信息直接以策略形式存进策略存储。换句话说，属性应是业务本来就需要的数据，而不是为授权硬造的旁路账本。

## 扩展新国家

最后一句很短但关键：扩展到新国家不需要改任何策略。因为策略按属性判断，新国家只是资源数据里多了一个 `project` 或国家取值，既不新增 IdP 组，也不新增策略。与组方案相比，这正是把“角色边界”从目录对象转成数据属性的收益。