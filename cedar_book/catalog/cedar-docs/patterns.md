---
id: cedar-docs/patterns
title: 授权设计模式
description: 介绍自由裁量、成员与关系三种 Cedar 策略设计模式，以及如何用属性条件加约束、避免角色爆炸。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_overview/patterns.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_overview/patterns.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_overview/patterns.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 授权设计模式

掌握语法之后，真正要设计的是应用的权限模型。授权领域最常用的三个词是：**RBAC**，权限来自角色分配；**ABAC**，权限来自用户或资源的属性值；**ReBAC**，权限来自用户与资源之间的关系。它们是有用的起点，但也会重叠——Owner 既能看成角色，也能看成用户与文档之间的关系，而这份关系还可能正好存在文档的属性里。

原文因此给出三种 Cedar 设计模式。每种模式都可以再加 ABAC 条件来收紧访问。

## 自由裁量权限

自由裁量权限由管理员、开发者或其他有权者临时授予。它的策略**总是**绑定到某个具体主体，作用域以 `principal ==` 开头。典型用途是机器对机器的授权：安全管理员列出哪个服务能调用哪个服务。

```cedar
permit (
  principal == Service::"Service-1343",
  action == Action::"ServiceRequest",
  resource == Service::"Service-7465");
```

主体是单个实体，资源侧却可以指向一组资源，例如 `resource in ServiceGroup::"ServiceGroup-AA44"`。

如果权限在运行时产生，最佳实践是用**模板**定义策略的形状，再让应用填入具体 ID 生成模板链接策略。比如工单系统允许客服把某个工单的访问权分享给另一个用户：

```cedar
// Template for ticket sharing
permit (
  principal == ?principal,
  action in Action::"Shared_TicketAccess",
  resource == ?resource) 
 when {
    resource.status == "OPEN" 
 } ;
```

这种模式适合应用内临时授权，也能通过模板把同一组权限发给多个用户；改模板即可统一追加条件。但多数组织更愿意把权限授予组或角色，让成员继承——那就是下一种模式。

## 成员权限

成员权限描述“组或角色的成员能做什么”。用户通过被加入组而获得权限，组关系存在策略之外，例如身份提供方。这是实现 RBAC 的常见方式：

```cedar
permit ( 
  principal in Role::"ContractManager", 
   action in [Action::"reviewContract", Action::"executeContract"],
   resource
); 
```

当 `Employee::"Alice"` 被提升并加入 `Role::"ContractManager"`，这条策略就对她生效；策略本身不针对 Alice，而针对所有成员。原文特别说明：`Role` 不是 Cedar 的保留词，它只是 schema 里定义的一个实体类型，而 `ContractManager` 是该类型的实体。同样可以按团队写，例如 `principal in Team::"Finance"`。

### 用属性条件加约束

上面的策略允许成员对**任意**资源执行动作。若财务团队只能审批 25000 以下的预算，就加一个与主体无关的固定条件：

```cedar
permit ( 
  principal in Team::"Finance", 
   action in [Action::"reviewBudget", Action::"approveBudget"],
   resource
) when {
 resource.value < 25000 
}; 
```

若每个成员的额度不同，可以把额度存成主体属性，改成 `resource.value <= principal.budgetApprovalLimit`。代价是策略外的属性需要维护，收益是不必为每个人写一条策略。

### 用属性条件避免角色爆炸

假设 Alice 只被指派为加拿大和美国的合规官。若按国家拆角色，就要有 `ComplianceOfficerCanada`、`ComplianceOfficerUSA`，国家一多角色数量会爆炸。更好的做法是给主体加一个随角色而定的属性，名字最好体现角色，例如 `complianceOfficerCountries`，在分配角色时写入：

```cedar
permit ( 
  principal in Role::"ComplianceOfficer", 
   action in Action::"approveAudit",
   resource is Audit) 
when {
 principal has complianceOfficerCountries &&
 principal.complianceOfficerCountries.contains(resource.country)
}; 
```

Alice 的辖区扩到墨西哥时，只需往这个集合里加一个国家，策略不动。

## 关系权限

关系权限来自主体与某个资源（或资源组）之间的关系，对应 ReBAC。关系本身存在策略库之外，例如应用数据库；策略只描述“具备某种关系的人能做什么”。原文用 TinyTodo 说明：任务列表的创建者与列表有 **owner** 关系，拥有全部权限；此外还有 **contributor** 与 **viewer** 关系。

Cedar 里用**资源上的属性**建模关系，每种关系一个属性，属性名体现关系，值是与该资源建立关系的用户集合：

```cedar
// Owners policy
permit (
  principal is User,
  action in Action::"ownerActions",
  resource is List) 
when {
  principal in resource.owners
};  
```

contributor 与 viewer 同理，分别检查 `resource.contributingUsers` 与 `resource.viewingUsers`。注意这类策略的作用域通常只限定类型，具体成员判断放在条件里，因此可以继续叠加约束——比如“已离职用户不算贡献者”：

```cedar
permit (
  principal is User,
  action in Action::"contributorActions",
  resource is List) 
when {
  resource has contributingUsers && principal in resource.contributingUsers
}
unless {
  principal has isTerminated && principal.isTerminated
};  
```

关系也可以建立在资源与**组**之间。TinyTodo 允许管理员建团队，列表所有者把团队设为贡献者；这时再加一个 `contributingTeams` 属性，条件用 `||` 把用户与团队两条路径并起来即可。

## 混合使用

单条策略应当只遵循一种模式，混在一条里既难读又易错；但同一个策略库完全可以混用不同类型。TinyTodo 就可以同时有：管理员角色的成员策略（`principal in Role::"Admin"`）、把列表标为公开后再允许所有人查看的受限成员策略（`when { resource has isPublic && resource.isPublic }`）、以及清理守护进程的自由裁量策略（`principal == daemon::"housekeeping"`）。Cedar 的卖点正是：混用不会牺牲可读性、性能或正确性。

角色建模的三种落地方式（属性、组、模板）见[用属性实现角色](./bp-implementing-roles-attributes.md)等条目，更多策略写法见[策略示例](./policy-examples.md)。