---
id: cedar-docs/bp-resources-containers
title: 资源容器
description: 用容器解决资源创建的自举问题：createFile 授权给文件夹、账户乃至 system root，并说明隐式容器要写进模型。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-resources-containers.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-resources-containers.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-resources-containers.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 资源容器

设计授权模型时，每个动作都必须关联一个资源。`viewFile` 这类动作的资源很直观：某个文件，或文件夹里的一组文件。`createFile` 就没那么直观了——文件还不存在，动作作用在什么资源上？它不可能是文件本身。

## 创建是自举问题

这是资源创建的一般化难题：必须存在某种方式，让主体在尚无任何资源时也能获得创建资源的权限。解法是承认**每个资源都存在于某个容器中**，容器本身才是权限的锚点。如果文件夹已经存在，创建文件的能力就可以建模为对该文件夹的权限，因为新资源正是在那里被实例化：

```cedar
permit (
    principal == User::"6688f676-1aa9-456a-acf4-228340b54e9d",
    action == Action::"createFile",
    resource == Folder::"c863f89b-461f-4fc2-b638-e5fa5f79a48b"
);
```

## 容器逐层上移

如果连文件夹都没有——比如一个全新客户账户——仍然有一个直觉上可理解的上下文：客户只能在自己的账户边界内创建文件，不能往任意账户里写。于是账户本身成为创建资源的容器，用 `in` 覆盖账户及其所有子文件夹：

```cedar
// Grants permission to create files within an account,
// or within any sub-folder inside the account.
permit (
    principal == User::"6688f676-1aa9-456a-acf4-228340b54e9d",
    action == Action::"createFile",
    resource in Account::"c863f89b-461f-4fc2-b638-e5fa5f79a48b"
);
```

## 最外层容器

如果账户也还不存在呢？注册流程需要造账户，就得有一个承载最外层边界的容器，让流程能在其中创建账户。这个根级容器代表整个系统，可以叫“system root”。是否需要这一层、叫什么名字，由应用所有者决定。示例应用的层级因此是：system root → 账户 → 文件夹 → 文件。

容器层级可以有多种合法设计，关键不在于形状，而在于记住：资源创建永远发生在某个资源容器的语境里。这些容器可能是隐式的——账户边界就是典型例子，很容易被忽略。设计授权模型时，应把这类隐含假设明确记下来，正式写进模型，而不是留在开发者的直觉里。

容器的另一个用法是把“某类资源的全集”做成合成资源组，见[填充策略作用域](./bp-populate-policy-scope.md)；容器不应直接是用户身份，原因见[分离主体与容器](./bp-separate-principals.md)。