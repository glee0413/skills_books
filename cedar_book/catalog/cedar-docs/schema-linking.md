---
id: cedar-docs/schema-linking
title: Schema 链接
description: 讲解 Cedar 4.6 的外部声明如何通过链接合并成完整 schema，以及祖先一致性与部分验证的限制。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_schema/schema-linking.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_schema/schema-linking.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_schema/schema-linking.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# Schema 链接

从 Cedar 4.6 起，schema 可以只**声明**实体类型和动作而不给出定义，关键字是 `external`。这类外部声明由**链接**（linking）解决：把若干 schema 合并，用同名定义填充每个 `external` 声明。链接的产物仍是 schema，其中可能还有未解决的外部声明。

链接的输出与 schema 的传入顺序、分组方式无关，这是它可以安全用于分布式建模的前提。

## 基本链接

下面的 `Documents` schema 声明了 `User`，`Users` schema 定义了它。

**`Documents` schema**

```cedarschema
external entity User;
entity Document {
    owner: User,
};
```

**`Users` schema**

```cedarschema
entity User;
```

**Linked result**

```cedarschema
entity Document {
    owner: User,
};
entity User;
```

两个 schema 也可以互相解析对方的声明：`Documents` 声明 `User` 并定义 `Document`，`Users` 声明 `Document` 并定义带 `lastRead: Document` 属性的 `User`，链接后两份定义同时成立。

若所有参与链接的 schema 都没有定义某个外部声明，它就保持 `external`。例如 `Documents` 与 `Folders` 都只声明 `external entity User;`，链接结果里 `User` 仍未解析，另外两个实体照常合并。外部动作的解析方式完全相同：一方 `external action viewDocument;`，另一方给出 `appliesTo`，链接后即得到完整动作。

## 带祖先的实体类型

外部实体类型可以声明父类型，链接时会把各方的父类型合并。

**`Documents` schema**

```cedarschema
external entity Account;
external entity Folder in Account;
```

**`Shares` schema**

```cedarschema
external entity Team;
external entity Folder in Team;
```

**Linked result**

```cedarschema
external entity Account;
external entity Team;
external entity Folder in [Account, Team];
```

这里有一条硬性约束：**每个已定义实体类型的祖先集合在链接前后必须保持不变**。原文给了一个反例——`Documents` 定义 `entity Document in Folder;`，而 `Shares` 声明 `external entity Folder in Account;`。链接会把 `Account` 变成 `Folder` 的父类型，从而间接成为 `Document` 的祖先，改变了 `Document` 的定义，因此链接失败。这条规则是为了避免因链接产生不可靠的验证结论。

## 带祖先的动作

动作的规则更严：链接时，**同一动作的所有声明必须声明相同的祖先**。例如一方只有 `external action viewDocument;`，另一方写 `external action viewDocument in readActions;`，链接直接报错。原因不难理解：动作只应有一套适用范围与成员关系，若各方给出不同的动作组归属，合并后的语义就没有唯一答案。注意这与外部实体类型不同——实体类型允许各方补充不同的父类型，动作不允许。

## 用外部声明做部分验证

含外部声明的 schema 并非无用，它仍能完成一部分验证。

可以做：

- 验证**已定义类型**的实体，即使其属性、标签或祖先引用了外部类型；
- 验证动作，无论外部还是已定义；
- 验证针对**已定义动作**的请求。

不能做：

- 验证策略；
- 验证外部类型的实体；
- 验证针对**外部动作**的请求。

原因很直接：策略验证需要完整的类型与属性信息，外部声明没有定义体；同理，外部类型的实体和外部动作的请求也缺少可用于检查的结构。需要完整能力时，先把 schema 链接成没有未解决外部声明的版本。

Schema 的整体结构见 [Schema 概览](./schema.md)，可读语法的写法见 [Cedar Schema 格式](./schema-format.md)，验证流程见[策略验证](./validation.md)。