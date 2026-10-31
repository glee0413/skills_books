---
id: cedar-docs/bp-user-groups
title: 利用用户组
description: 建议只保留一种 User 类型，把管理员、客服、财务等人员分类建成组并在组级授予权限。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-user-groups.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-user-groups.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-user-groups.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 利用用户组

建模时常常会造出多种用户类型，例如 `Admin`、`CustomerSupportTech`、`FinanceUser`。Cedar 的建议是只创建一种用户类型，比如 `User`，再把“不同种类的用户”建成**组**，在组级别控制权限。

## 为什么不按人员分类建类型

用户类型属于 schema，描述的是结构中有什么，而不是组织里有哪些角色。为每类人建一个类型会带来几个连锁问题：

- 类型数量随岗位膨胀，每次组织调整都要改 schema，动作的主体约束也得跟着改；
- 同一个人兼任多种角色时无法同时属于多个类型，只能复制身份或反复改类型；
- 权限散落在多个类型上，“这个人到底能做什么”要靠读遍所有类型才能回答。

组是实体，成员关系是数据。人员变动时只改成员关系，schema 和策略都不动。

## 组级授权

权限写在组上，策略通过 `principal in Group::"..."` 匹配组成员，用户凭父子关系继承组的权限。新增一名财务人员，把他加入财务组即可，不必新写策略；离职时移出组，权限随之失效。这比给每个人单独写策略稳定得多，也更容易审计：想知道财务能做什么，只看财务组相关的策略。

组还可以嵌套，从而表达“所有员工”“某部门的所有工程师”这类层级，授权时用一次 `in` 就能覆盖整棵子树。

## 与其他角色实现方式的关系

组是 RBAC 的首选载体。需要更细的粒度时，可以把组与属性结合：组决定“能做哪一类事”，属性决定“能操作哪些对象”。角色也可以用属性或模板表达，各有适用场景；模板的做法见[策略模板](./templates.md)，属性式关系见[表示关系](./bp-relationship-representation.md)。

需要注意：组名同样是策略里的标识符，必须唯一、不可变、不可回收。不要直接把会改名的工作目录组名写进策略，见[避免可变标识符](./bp-mutable-identifiers.md)；组在实体层级中的位置见[实体与实体层级](./entities.md)。