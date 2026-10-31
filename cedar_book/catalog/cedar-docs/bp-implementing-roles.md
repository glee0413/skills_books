---
id: cedar-docs/bp-implementing-roles
title: 实现基于角色的访问控制
description: 用主体组表示角色、用动作组收敛策略，并把角色分配留在 IdP，是 Cedar 中实现 RBAC 的推荐路径。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-implementing-roles.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-implementing-roles.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-implementing-roles.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 实现基于角色的访问控制

这是 RBAC 系列的总览页。原文把**角色**定义为一组任务：为某个目的分配给一个人或事物（主体），主体需要相应权限才能在资源上执行操作，而这些权限用 Cedar 策略表达。角色独立于被分配者定义；一个主体可以拥有多个角色，也可以一个都没有；分配角色即授予其在特定资源上执行特定操作的权限。

## 推荐做法：用主体组表示角色

Cedar 推荐的建模方式是用主体组承载角色：角色权限写成针对该组的一条或多条策略，分配角色就是把主体加入组。角色分配不由策略存储管理，通常交给 IdP。原文用时间表系统举例，系统有两个角色——提交时间表的 Worker 和审批时间表的 Approver，同一个人可以两者兼任。按推荐做法，为两个角色各建一个组，再在策略存储里为每组写策略。审批人策略是：

```cedar
// Permits any member of the group Role::"Approver" to review and approve timesheets
permit (
    principal in Role::"Approver",
    action in [Action::"TimeSheetReview", Action::"TimeSheetApprove"],
    resource in TimesheetGrp::"all-timesheets"
);
```

这里还建了资源组 `TimesheetGrp::"all-timesheets"`，所有时间表都是它的成员。资源组让策略不必逐个列举资源，也为后面按国家切分留下接口。

## 用动作组收敛策略

把 `TimeSheetReview` 和 `TimeSheetApprove` 抽成动作组 `ApproverActions` 后，策略可以缩短为：

```cedar
// Permits any member of the group Role::"Approver" to review and approve timesheets
permit (
    principal in Role::"Approver",
    action in Action::"ApproverActions",
    resource in TimesheetGrp::"all-timesheets"
);
```

动作组应定义在 schema 里，这样应用不必在授权请求的实体数据中传动作组成员关系。它还有一个运维收益：要给审批人角色增加新动作，只需把动作加进 `Action::"ApproverActions"` 的定义，**无需改动任何策略**。

把 Joe 分配为审批人，就是把他加入 `Role::"Approver"` 组；这条信息存在策略存储之外，可能在 IdP 或其他记录系统。分配与撤销都不需要修改策略。发起请求时则要提供主体的组信息，例如询问 `User::"Joe"` 能否执行 `TimeSheetReview` 时，必须告诉引擎 Joe 属于 `Role::"Approver"`。

## 资源特定角色

上面的模型里，审批人可以审批所有时间表。现实常要求角色只覆盖资源子集：Bob 可以审批德国和法国的时间表，Alice 可以审批法国和英国。原文假设时间表已按国家组织成资源组，并给出两条路线：一是为每组资源建独立的角色，见[用组实现角色](./bp-implementing-roles-groups.md)；二是在组策略上加属性条件，见[用属性实现角色](./bp-implementing-roles-attributes.md)。若没有 IdP 记录角色分配，还有第三条路：[用模板实现角色](./bp-implementing-roles-templates.md)。

三种方案没有绝对优劣：组方案直观但策略随资源分组增长；属性方案策略少，但依赖属性真实存在；模板方案把分配写进策略存储，代价是与用户生命周期强耦合。选择时可结合[授权模式](./auth-patterns.md)先确认请求里能拿到哪些实体数据，再决定角色边界放在目录、属性还是策略里。