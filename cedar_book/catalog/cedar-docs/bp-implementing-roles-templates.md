---
id: cedar-docs/bp-implementing-roles-templates
title: 用模板实现角色
description: 在没有 IdP 记录角色分配时，用带 ?principal 的模板为每个用户和资源组实例化策略，并权衡其生命周期成本。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-implementing-roles-templates.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-implementing-roles-templates.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-implementing-roles-templates.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 用模板实现角色

Cedar 官方推荐用主体组表示角色，但这依赖一个记录“谁被分配到哪个角色”的系统，通常是身份提供方（IdP）。如果暂时没有这样的系统，可以退一步，用[策略模板](./templates.md)把角色分配放进策略存储本身。本页是“审批人”例子的第三种解法。

## 为每个角色建模板

做法是为每个角色写一个模板，用占位符标出随分配变化的部分。继续时间表的例子，需要一个 Worker 模板和一个 Approver 模板，审批人模板如下：

```cedar
// Approver-Role-Assignment policy template 
permit ( 
    principal == ?principal, 
    action in Action::"ApproverActions", 
    resource in ?resource 
);
```

模板本身不生效，它只描述“一类角色”的形状：某个具体主体，对某个具体资源组，执行审批动作组中的动作。

## 分配角色：实例化模板

在这种方案里，策略存储承担了记录角色分配的职责。给用户分配角色，就是创建一条模板链接策略，把具体主体和资源组填进去。例如让 Alice 担任法国和英国的审批人，需要创建两条：

```
createPolicy ( 
    template = "Approver-Role-assignment", 
    principal = User::"Alice", 
    resource = TimesheetGrp::"UK" 
)
```

```
createPolicy (
    template = "Approver-Role-assignment", 
    principal = User::"Alice", 
    resource = TimesheetGrp::"France" 
)
```

每条链接策略都精确授予“指定用户对指定资源组执行模板中的动作”。Alice 被撤销法国角色时，归档对应的那一条即可，不影响英国那条。

## 授权请求的差异

请求的实体数据仍要包含**资源**的组成员关系，但不再需要主体的组成员关系——因为每个被分配的主体都有一条专属的链接策略，主体在策略里是 `==` 精确匹配，而不是 `in` 组匹配。这是与[用组实现角色](./bp-implementing-roles-groups.md)最实质的区别，也意味着请求构造可以少查一次主体的组列表。

## 扩展新国家

新增国家反而更轻：不需要在 IdP 建用户组，也不需要新建策略或模板，只要建一个资源组来容纳该国资源。例如进入日本时新增 `TimesheetGrp::"Japanese-timesheets"`；之后按常规分配流程为相关用户创建链接策略即可，这属于日常角色分配，而不是为支持新国家改造模型。

## 生命周期代价

原文用一整节警告这套做法的耦合：策略存储被绑到了用户生命周期上。入职并分配角色时要建链接策略；转岗时要找到旧策略、归档、再建新策略；离职时要归档该用户的全部策略。原文特别提醒应**归档而非删除**，否则会丢失“谁曾被允许做什么”的历史记录，取证时可能要用。

角色越复杂，负担越重。上面的角色只需一条策略表达，所以一次分配只建一条链接策略；若一个角色由多条策略组成，分配和撤销都要批量创建或归档多条，出错面随之扩大。因此模板方案适合角色简单、且确实没有 IdP 可用的场景；有条件时仍应优先用组。