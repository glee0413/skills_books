---
id: cedar-docs/bp-naming-conventions
title: 命名约定
description: 给出实体类型、实例 Id、属性名与上下文键的四类命名约定及示例，并说明它为何是策略一致性的前提。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-naming-conventions.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-naming-conventions.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-naming-conventions.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 命名约定

为保证 Cedar 策略前后一致，官方建议为 schema 中的各类元素定义并遵守统一的命名约定。原文给出一张四行的对照表。

## 约定表

| 标识符类型 | 命名约定 | 示例 |
|---|---|---|
| 实体类型 | PascalCase（首字母大写的 camelCase） | `User` |
| 实体实例 Id | 不透明 Id 或 camelCase | `fcaf664d4f89fec0cda8`、`viewFile` |
| 属性名 | camelCase | `resource.countryOfOrigin` |
| 上下文键 | camelCase | `context.uploadFileSize`、`context.http.headers.userAgent` |

## 逐行解读

**实体类型**是 schema 里的“名词类”，首字母大写，与 `User::"alice"` 的写法一致。类型名会同时出现在 schema、策略和应用代码三处，必须逐字相同，否则验证器会报无法识别的实体类型。

**实体实例 Id** 分两种：由系统生成的用不透明 Id，通常是 UUID；带人类可读语义的用 camelCase。前者天然满足不可变要求，后者只适合稳定、不会被复用的键——像用户名这种会改的值就不该出现在这里。

**属性名**与**上下文键**都以小写字母开头的 camelCase 书写。嵌套路径逐段沿用同一风格，如 `context.http.headers.userAgent` 的每一段都是 camelCase。属性属于实体，上下文键只属于本次请求，两者的边界见[使用上下文](./bp-using-the-context.md)。

## 约定的作用

命名约定本身不改变语义，但能显著减少拼写错误和映射错误，让评审时一眼看出某个名字是类型、属性还是上下文键。它也是[避免可变标识符](./bp-mutable-identifiers.md)的前置条件：只有先区分“给人看的名字”和“机器用的 ID”，才不会把会变的名字写进策略。

## 在 schema 与策略之间对齐

这些名字会在三处重复出现：schema 声明、策略文本、应用代码里的实体构造。三处只要有一处大小写或拼写不同，就会表现为“验证器说属性不存在”或“策略始终不匹配”，而错误信息通常不会指出是命名问题。把约定写成团队规范，并在评审清单里检查新加的类型与属性，成本最低。

实际落地时可以再进一步：用代码常量或代码生成来产出实体类型名与属性名，避免手写字符串；在 CI 里对 schema 与策略做一次验证，让拼写错误在合并前暴露。原文只要求“定义并使用”约定，具体形式由团队决定，关键是**同一概念只有一种写法**。

动作命名另有建议：动作应映射到业务领域，而不是数据库的 CRUD 原语，见[最佳实践概览](./best-practices.md)。动作划分也会影响资源作用域能否填满，见[填充策略作用域](./bp-populate-policy-scope.md)。