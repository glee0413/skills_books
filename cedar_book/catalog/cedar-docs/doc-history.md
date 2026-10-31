---
id: cedar-docs/doc-history
title: 文档版本历史
description: 梳理 Cedar 语言从 2.0 到 4.6 的版本演进、语言版本与 SDK 版本的对应关系，以及指南自身的更新记录。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_other/doc-history.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_other/doc-history.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_other/doc-history.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 文档版本历史

本页是 Cedar 的变更账本，分两张表：语言本身的版本演进，以及官方指南的文档更新。读旧文章或旧示例时先对一下版本，能避免把新语法误当成一直存在的特性。

## 语言版本不等于 SDK 版本

Cedar 的语言版本只在策略语法或语义发生变化时递增；SDK 版本则跟随 `cedar-policy` crate 在 crates.io 上发布。Rust API 的破坏性变更未必影响策略语言，所以一个语言版本往往横跨多个 SDK 版本。原文建议使用**支持目标语言版本的最新 SDK**，因为后续版本通常带有重要修复和可用性改进。查具体 API 变化应看 SDK 的 changelog，而不是这张语言表。

## 4.x：从补强到外部类型

| Cedar 版本 | 主要变化 | SDK 版本 | 日期 |
| --- | --- | --- | --- |
| 4.6 | 外部（`external`）实体类型与动作、schema 链接 | 4.14.0 - 4.14.1 | 2026-10-17 |
| 4.5 | JSON 策略格式支持扩展 `has` | 4.10.0 - 4.13.0 | 2026-04-23 |
| 4.4 | 策略支持尾随逗号（本版仅策略，不含 schema） | 4.5.0 - 4.9.1 | 2025-06-30 |
| 4.3 | 枚举实体类型、`datetime` 扩展、实体切片验证 | 4.4.0 - 4.4.2 | 2025-04-23 |
| 4.2 | `isEmpty`、扩展 `has`、`datetime`（实验）、schema 注解 | 4.3.0 - 4.3.4 | 2025-01-21 |
| 4.1 | 实体标签、无值注解 | 4.2.0 - 4.2.3 | 2024-10-07 |

4.0 是一次清理式的大版本：保留 `__cedar` 标识符、移除“未指定实体”、禁止空命名空间遮蔽、允许 JSON schema 的 `EntityOrCommon` 字段，并禁止把 `Bool`、`Boolean`、`Entity`、`Extension`、`Long`、`Record`、`Set`、`String` 用作公共类型名。这些约束今天仍是写 schema 时的硬边界，详见[JSON Schema 语法参考](./json-schema-grammar.md)。

4.3 的枚举实体让 schema 能预先限定合法 EID；4.6 的外部类型则把“只声明、不定义”的类型引入，需要配合[schema 链接](./schema-linking.md)才能解析，因此含外部类型的 schema 不能用于验证策略。

## 3.x 与 2.x：语言成形

3.1 引入 Cedar schema 格式，3.3 允许公共类型之间互相引用，3.4 增加策略集的 JSON 表示。3.0 是语义收紧的关键版本：加入 `is` 操作符、更严格的验证、禁止记录重复键，并引入请求验证与实体验证。2.x 阶段确立了基础：2.0 于 2023-05-10 首次发布，2.1 禁止命名空间中的空白，2.2 把通用乘法操作符回移植到 2.x。

## 指南自身的更新

文档表记录了七个节点：2023-05-10 首版指南；2023-07-14 增加 JSON 策略格式与最佳实践；2023-07-17 增加 schema 语法；2023-07-27 增加实体与上下文语法；2023-12-15 增加 `is` 操作符；2024-02-21 增加人类可读的 Cedar schema 格式；2024-08-19 增加 JSON 策略集格式。可以看出，最佳实践与 JSON 表示几乎和指南同时起步，而 schema 相关章节是随后补齐的。

## 怎样使用这张表

遇到新语法先确认它属于哪个语言版本，再确认手头 SDK 是否覆盖。例如尾随逗号在 4.4 只对策略生效，不能顺手写进 schema；`external` 类型必须 4.6 及以上，且要准备好链接目标。原文每个条目都附了 RFC 或 PR 链接，需要追溯设计动机时可直接跳到对应提案。