---
id: cedar-docs/bp-separate-principals
title: 分离主体与容器
description: 指出把用户身份当作资源容器会阻碍委托、转移与合并，并给出把身份与账户拆成两个实体类型的做法。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-separate-principals.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-separate-principals.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-separate-principals.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 分离主体与容器

设计资源层级时，尤其在面向消费者的应用里，一个常见倾向是把客户自己的用户身份当作其账户内资源的容器。官方建议把这种策略视为反模式。

## 反模式的吸引力

用 `User::"jane"` 作为资源树的根看上去很自然：资源都挂在用户下面，一次 `in` 就表达了“我的东西”。问题不在当下是否能跑通，而在应用变复杂之后。

## 为什么会出问题

更丰富的应用迟早要委托访问。原文列出几类典型诉求：

- **家庭账户**：其他用户可以共享账户资源；
- **企业客户**：想把多名员工指定为账户某部分的运营者；
- **所有权转移**：账户要从一个用户转到另一个用户；
- **账户合并**：多个账户的资源要合并到一起。

一旦用户身份成为账户的资源容器，这些场景都会变难。更值得警惕的是：在这种结构下把账户容器的访问权授予他人，可能连带授予修改用户身份本身的权限，例如改掉 Jane 的邮箱或登录凭据。授权给“账户”意外变成了授权给“这个人”。

## 推荐做法

只要条件允许，就把主体与资源容器分开，用“管理员权限”“所有权”这类概念表达两者之间的连接，而不是让身份成为资源的祖先节点。容器是账户或租户，主体是用户；访问关系由策略表达，而不是由层级隐含。

## 已有应用的折中

如果现有应用无法改成解耦模型，建模时也应尽量模拟它。例如系统里只有一个 `Customer` 概念，把用户身份、登录凭据和其拥有的资源封装在一起；可以在授权模型里映射成两个逻辑实体：`Customer Identity`（姓名、邮箱等）与 `Customer Resources` 或 `Customer Account`（其拥有资源的父节点）。两者可以共享同一个 `Id`，只是 `Type` 不同，这样既保留了原应用的标识，又把“人”和“容器”拆开。

这条与“每个资源都生活在容器里”配套：容器必须存在，但不该是主体本身。见[资源容器](./bp-resources-containers.md)与[实体与实体层级](./entities.md)。