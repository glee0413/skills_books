---
id: cedar-docs/schema-format
title: Cedar Schema 格式
description: 按语法逐段讲解 Cedar 可读 schema 的命名空间、实体类型、动作、公共类型与类型名消歧规则。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_schema/human-readable-schema.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_schema/human-readable-schema.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_schema/human-readable-schema.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# Cedar Schema 格式

Cedar 格式是 schema 的人类可读写法，语法接近策略。一份 schema 由零个或多个命名空间组成，每个命名空间里有三种定义：**实体类型定义**、**动作定义**、**公共类型定义**。定义之间用 `;` 分隔；与 JSON schema 不同，这里可以写 Cedar 风格的注释。从 4.6 起还支持实体类型与动作的**声明**（只有名字，没有定义）。

## 命名空间

```cedarschema
namespace Foo { entity Bar; }
```

命名空间名必须是合法的 Cedar 标识符，不能占用保留的 `__cedar`。命名空间内的声明在外部引用时必须写全限定名，因此上面的实体类型是 `Foo::Bar`。也可以不写命名空间，直接 `entity Bar;`，此时永远以非限定名 `Bar` 引用。

命名空间声明本身可以带注解，例如 `@doc("this is a Foo") namespace Foo { entity Bar; }`，但不能注解空命名空间。同名 `namespace` 声明不允许重复，内部声明同理。

## 实体类型定义

下面的定义声明了实体类型 `User`，父类型为 `Group`，并带四个属性：

```cedarschema
entity User in [Group] {
    personalGroup: Group,
    delegate?: User,
    blocked: Set<User>,
    team: Team,
} tags String;
@doc("Only three values of EIDs are valid for entities of type `Group`.")
entity Group enum ["G1", "G2", "G3"];
external entity Team in [Organization];
external entity Organization;
```

要点：

- `delegate?` 中的 `?` 表示该属性可选；其余属性必填。
- `Group` 是枚举实体，合法 EID 只有 `G1`、`G2`、`G3`。
- `Team` 和 `Organization` 用 `external` 声明，只使用不定义。外部实体类型没有定义体，但可以声明父类型，前提是父类型不是枚举实体。
- `tags String` 表示实体可带任意数量、任意名称的标签，标签值均为字符串。
- 一个定义可同时声明多个同构实体类型，如 `entity UserA, UserB, UserC`。
- 定义前可加注解，如 `@doc("user entity") entity User ...`。

### 成员关系

在 `entity <Name>` 之后用 `in <EntityTypes>` 声明成员关系。多个父类型写成方括号逗号列表，如 `entity User in [UserGroup1, UserGroup2]`；只有一个父类型时可省略方括号。

### 形状与类型

形状沿用策略的记录语法，括号内是 `<Name>:<Type>` 键值对，属性名可以是标识符或字符串。属性声明前可加 `=`（如 `entity User = {...};`），以与公共类型声明保持一致。省略属性声明等价于空记录 `{}`，即该类型没有属性。

schema 类型写在属性或公共类型的右侧。`Bool`、`String`、`Long` 与同名 Cedar 基础类型对应；实体类型与扩展类型用名字表示，实体类型名可含 `::`，例如 `User` 与 `ExampleCo::User` 都合法。从语言 3.1 起 `__cedar` 是保留命名空间，可用 `__cedar::ipaddr` 唯一指代扩展类型 `ipaddr`。

复合类型有两种：

```cedarschema
entity List {
  owner: User,
  flags: {
    organizations?: Set<Org>,
    locales?: Set<Location>,
    tags: Set<String>,
  },
};
```

记录类型与策略里的记录相似，只是值的位置放的是类型。集合类型写作 `Set<T>`，如 `Set<Long>`、`Set<User>`。

## 动作定义

```cedarschema
action ViewDocument in [ReadActions, ExampleNS::Action::"Write"] appliesTo {
    principal: [User,Public],
    resource: Document,
    context: {
        network: ipaddr,
        browser: String
    }
};
external action ReadActions;
```

这个动作是 `ReadActions` 与 `ExampleNS::Action::"Write"` 两个动作组的成员，适用于主体 `User`、`Public` 和资源 `Document`，上下文含 `network` 与 `browser`。

动作名可以是标识符或字符串。父动作可以是字符串，实体类型名必须是标识符；跨命名空间的父动作要写全限定动作实体名，如 `ExampleNS::Action::"Write"`。

`appliesTo` 是含 `principal`、`resource`、`context` 三个键的记录。不写 `appliesTo` 时，动作不适用于任何主体、资源或上下文；写了则 `principal` 与 `resource` 必填，取实体类型或非空类型列表，`context` 可选且必须是记录，缺省为空记录。

`ReadActions` 是外部动作，其适用范围由所链接的 schema 提供。在链接到定义它的 schema 之前，本 schema 既不能验证策略，也不能验证针对 `ReadActions` 自身的请求。外部动作声明必须列出该动作的**全部祖先**，这比外部实体类型更严格。

## 公共类型

语法类似类型别名：`type <Id> = <Type>`，右侧可以是 schema 类型，也可以引用其他公共类型。正因为可以互相引用，可能出现环，例如 `type A = Set<B>; type B = {"a" : A};`，解析器会直接报错。公共类型声明同样可加注解。

## 类型名消歧

类型名可能冲突：`ipaddr` 既可作非限定公共类型名，又是扩展类型名；`Foo::Bar` 既可是限定公共类型名，也可是实体类型名。规则如下：

1. 基础类型与扩展类型名按设计不能互为别名；
2. 类型引用按优先级解析；
3. `__cedar` 保留，用于唯一指代基础类型与扩展类型，如 `__cedar::Long`。

优先级为：

```text
common type > entity type > primitive/extension type
```

解析时依次检查公共类型、实体类型、基础或扩展类型。此外，不允许定义会遮蔽空命名空间中同名实体类型或公共类型的定义，否则 schema 无效——例如空命名空间已有 `type id`，`namespace Demo` 里再定义 `type id = String;` 就会报错。

完整的 PhotoFlash 示例 schema 见原文 `#schema-examples`，它同时被[策略示例](./policy-examples.md)引用。