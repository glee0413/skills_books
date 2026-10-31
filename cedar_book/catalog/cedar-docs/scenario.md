---
id: cedar-docs/scenario
title: PhotoFlash 示例场景
description: 介绍贯穿 Cedar 文档的照片分享应用 PhotoFlash，并用两条策略演示 permit、forbid、when/unless 的读法。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_overview/scenario.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_overview/scenario.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_overview/scenario.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# PhotoFlash 示例场景

Cedar 文档用同一个虚构应用承载所有例子：**PhotoFlash**，一个让用户存储、整理和分享照片的服务。先把它的数据形状和人物关系记住，后面读策略会轻松很多。

## 应用与实体

用户把照片上传到自己的账户，再组织进**相册（Album）**。相册可以嵌套在别的相册里，一张照片也可以同时属于多个相册。照片可以附加用户自定义的元数据，也就是**标签（tags）**，例如 `private`、`work`、`fun`，还可以按时间、地点等标签检索。

用户 Jane 建了三个组来代表家人（`janeFamily`）、朋友（`janeFriends`）和同事（`janeCoworkers`），把其他用户放进组，再规定各组成员如何访问她的照片与相册。用户组和相册一样灵活：可以嵌套，一个人可以属于多个组。照片本身带有 `created` 时间戳。

书写约定：实体**类型名**用 PascalCase（`UserGroup`），**实体名与属性名**用 camelCase（`janeFriends`）。

## 一条 permit 的读法

```cedar
// Jane's friends can view all photos in her janeTrips album

permit (
    principal in Group::"janeFriends",
    action in [Action::"view", Action::"comment"], 
    resource in Album::"janeTrips"
);
```

`janeFriends` 的成员可以对 `janeTrips` 相册里的照片执行 `view` 和 `comment`。注意 `action in [...]` 列的是一组具体动作，而 `resource in Album::"janeTrips"` 用的是层级：因为 `in` 具有传递性，嵌套在 `janeTrips` 下的 `janeVacation`、`conference` 相册里的照片也被这条策略覆盖。

没有被任何策略显式允许的动作一律拒绝——这是 Cedar 的默认拒绝。

## 一条 forbid 的读法

有些动作出于服务级安全或设计约束需要**永远**禁止，即使有人写了允许策略。下面的策略保证：任何标了 `private` 的资源，除账户所有者外，谁都不能执行任何操作。

```cedar
// Only the owner can access any resource tagged "private"

forbid ( principal, action, resource )
when { resource.tags.contains("private") }    // assumes that resource has "tags"
unless { resource in principal.account };     // assumes that principal has "account"
```

它不限定具体的主体、动作、资源，因此自动匹配**任意**请求；当 `when` 表达式为真且 `unless` 表达式为假时拒绝。要留意：这条策略不授予任何权限，资源所有者自己仍然需要另一条 `permit` 才能操作。

## when 与 unless 的顺序

Cedar 按子句在策略中出现的顺序求值 `when` 和 `unless`。如果两个子句各自都会产生错误，先出现的那个决定了你最终看到的错误。写策略时把更基础、更容易失败的检查放在前面，诊断信息会更贴近根因。

## 标识符必须不可复用

示例里用 `jane`、`bob` 这样的简单标识符只是为了可读。生产系统必须使用**唯一且永不复用**的值，推荐 UUID。设想用户 `jane` 离职，之后另一个人接手了 `jane` 这个名字：新人会自动获得所有仍引用 `User::"jane"` 的策略所授予的权限，而 Cedar 无法区分新老用户。这条警告同时适用于主体和资源标识符。

用 UUID 时，建议在逗号后用 `//` 注释写上友好名，让策略仍然可读：

```cedar
principal == User::"a1b2c3d4-e5f6-a1b2-c3d4-EXAMPLE11111", // alice
```

实体的完整结构见[实体与实体层级](./entities.md)，策略各部分语法见[策略语法基础](./policy-syntax.md)。
