---
id: cedar-docs/bp-relationship-representation
title: 表示关系
description: 对比用实体属性与用模板表达主体-资源关系的两种做法，并给出按关系是否独立于授权而存在来选择的标准。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-relationship-representation.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-relationship-representation.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-relationship-representation.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 表示关系

资源之间的关系有两种主要表达方式。选哪一种，取决于这段关系是否已经存在应用数据库里、并因权限之外的原因（例如合规）被维护。若已经存在，采用属性式；若不存在、只为授权而设，采用模板式。

## 属性式关系

属性可以作为授权决定的**输入**，表示主体与一个或多个资源之间的关系。这种模式适用于关系本来就因权限之外的目的被跟踪和管理的场景：例如记录主要账户持有人是“了解你的客户”合规要求，权限由这些关系派生。关系数据在授权系统之外维护，做决策时作为输入取来。

```json
{
  "id": "df82e4ad-949e-44cb-8acf-2d1acda71798",
  "name": "alice",
  "email": "alice@example.com",
  "primaryOnAccounts": [
    "Account::\"c943927f-d803-4f40-9a53-7740272cb969\"",
    "Account::\"b8ee140c-fa09-46c3-992e-099438930894\""
  ]
}
```

策略中沿属性判断即可：

```cedar
permit (
    principal,
    action in Action::"primaryAccountHolderActions",
    resource
) when {
    resource in principal.primaryOnAccounts
};
```

反过来，把同样的关系放在资源的 `primaryAccountHolders` 属性上、存一组用户，也等价。若主体与资源之间有多种关系，应分别建模为不同属性。例如账户还有授权签字人，且这些人的权限不同，就要另设 `authorizedSignatoryOnAccounts` 属性，并配一条 `authorizedSignatoryActions` 的策略，而不是混进同一个集合。

## 模板式关系

如果关系存在的唯一目的就是权限管理，适合把它存成模板链接策略，也就是模板；也可以理解为“在某个具体资源上被授予的角色”。

文档管理系统中，文档所有者 Alice 允许 Bob 参与文档，形成 contributor 关系，其唯一目的就是允许编辑和评论，因此可以用模板表示。做法是每种关系建一个模板，例如 `Contributor` 与 `Reviewer`：

```cedar
permit (
    principal == ?principal,
    action in Action::"DocumentContributorActions",
    resource in ?resource
);
```

面向用户组时，把 `==` 换成 `in`，即 `principal in ?principal`；其余不变。授予访问时，用具体的主体和资源实例化模板，得到一条链接策略，例如把某个用户或用户组与某份文档、某个文件夹关联起来。模板本身只说明“这类关系允许哪些动作”，具体授予谁、授予到哪个资源，由链接时的占位符取值决定。

## 如何选择

判断标准只有一条：这段关系是否独立于授权而存在。合规、账单、组织架构等外部系统已经维护的关系，用属性，避免在授权侧再造一份；纯属“某人被允许访问某物”的授予记录，用模板，让每次授予对应一条可单独回收的链接策略。两者也能并存。模板的占位符与生命周期成本见[策略模板](./templates.md)，实体与父子关系见[实体与实体层级](./entities.md)。