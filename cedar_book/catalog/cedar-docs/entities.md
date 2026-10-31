---
id: cedar-docs/entities
title: 实体与实体层级
description: 说明实体的类型、标识符、属性与标签，以及 parent 层级、命名空间和实体相关操作符。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/syntax-entity.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/syntax-entity.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/syntax-entity.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 实体与实体层级

在 Cedar 里，主体、动作、资源都是**实体（entity）**——一种被存储的对象，用统一的结构表示应用中的各类参与者与数据。

## 实体由什么组成

- **实体类型**：决定该类型支持或要求哪些属性，例如 `User`、`Photo`、`Album`、`Group`、`Account`。类型在 schema 中定义。`Action` 有特殊含义：请求中的 `action` 必须是 `Action` 类型，动作实体不允许有属性和标签。`__cedar` 是保留类型，凡包含该标识的类型名都不能使用。
- **实体标识符（EID）**：让你在策略里指向某个具体实体。类型 + EID 唯一确定一个对象。
- **属性**：零个或多个，值可以是 Cedar 支持的任意数据类型。例如 `Photo` 可以有 `name`、`createdDate`、`location`（Decimal 集合表示的坐标）、`photographer`（指向另一个实体的引用）。
- **标签**：零个或多个，类似属性，但键名在运行时才确定，写策略和 schema 时并不知道。

EID 的安全提醒与策略页相同：生产环境必须用 UUID 一类不可复用的值，否则 `jane` 这个名字被新人接手后会继承旧权限。

## 层级：parent

给实体指定 `parent` 属性，就把它归入某个组。层级按场景需要任意组织：`Photo` 可以放进一个或多个 `Album`。一个实体可以有多个父实体，层级也可以嵌套——相册 `trips` 是 `vacations` 的父级，`vacations` 又是一批照片的父级，而其中一张照片同时还可以属于 `picturesOfBob`，只要再加一个 `parent` 指向那个相册。

组也能嵌套组，因此可以表达多级组织架构。除了主体侧的 `User` 属于 `UserGroup`，同样的机制可用于资源（文件属于文件夹，文件夹再属于上层文件夹）和动作（`viewPhoto` 属于 `readOnly` 动作组）。

## 实体支持的操作符

- **相等 `==`**：判断两个实体是否字面相同、UID 相同。
- **层级/成员 `in`**：判断一个实体是否在另一个实体的层级之下。
- **属性存在 `has`**：在取值前确认属性存在；访问不存在的属性会报错。
- **属性访问 `.`**：`entityName.attributeName`。
- **标签存在 `.hasTag()`**：取值前确认标签存在。
- **标签取值 `.getTag()`**：返回类型由 schema 中的 `tags` 声明决定。

`in` 是传递且自反的：`A in B`、`B in C` 蕴含 `A in C`，且 `A in A` 恒为真。详见[操作符](./operators.md)。

## 命名空间

实体可以带命名空间前缀，用 `::` 分隔，用来推断类型之间的逻辑层次。例如 `PhotoFlash::Groups::Album::"vacation"` 表示 EID 为 `"vacation"`、类型为 `PhotoFlash::Groups::Album` 的实体。这种层次只存在于设计者的约定中，语言层面没有真实结构。含保留标识 `__cedar` 的命名空间全部不可用，所以 `__cedar::Album::"vacation"` 非法。

## 同一实体可以扮演多个角色

这种统一结构让同一类型的实体既能当主体又能当资源。用户目录（如 LDAP）就是典型：任何用户都能读自己的数据，HR 部门的用户可以改别人的信息。此时主体和资源是同一类型，甚至就是同一个用户。

```cedar
// Allow every user to read their own data in the user directory
permit (
    principal,
    action == Action::"readUser",
    resource
)
when {
    principal == resource // The same entity
};
```

除动作实体外，没有额外信息时无法判断一个实体究竟是主体还是资源。这个约束交给 schema：它可以限定某类型只能出现在 principal 还是 resource 位置。

## 属性访问的两种写法

属性用点号访问，也可以用索引写法，两者等价：

```cedar
SomeUser.name                  // SomeUser is an entity of type user
SomeEmployee.department        // SomeEmployee is an entity of type employee
SomePhoto.description          // SomePhoto is an entity of type photo.
```

```cedar
SomeUser["name"]
SomeEmployee["department"]
SomePhoto["description"]
```

属性解析出的值可以是任意受支持的数据类型，因此只要该类型合法，属性就能出现在任何表达式位置。类型清单见[数据类型](./data-types.md)。
