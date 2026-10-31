---
id: cedar-examples/rust-hello-world
title: Rust Hello World
description: 用一个可运行的小程序拆解 Cedar Rust API 的五个关键动作：解析、请求、上下文、实体与验证。
project: cedar-examples
sourceCommit: f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37
sourceRef: f4d2dbb
sourcePath: cedar-rust-hello-world/README.md
snapshotPath: source-snapshots/cedar-examples/cedar-rust-hello-world/README.md
sourceUrl: https://github.com/cedar-policy/cedar-examples/blob/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/cedar-rust-hello-world/README.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# Rust Hello World

这个示例的核心代码都在 `src/main.rs`，却把集成 Cedar 时需要掌握的动作都点名了。README 明确列出五件事：从文本解析策略；构造访问请求并询问是否被策略允许；构造带可选 `context` 的请求；随请求提供实体；验证策略与 schema 一致。读懂它，等于拿到一份集成清单。

## 五个演示函数

README 用函数名对应上述能力，逐个看：

- `parse_policy`：解析一条策略，并提取其中的组成部分。它演示 `PolicySet` 的解析，以及如何读取 principal、action、resource 的约束，适合用来写策略检查工具。
- `json_context`：从 JSON 值构造请求的 `context`。上下文承载请求时刻的瞬时信息，例如 IP、时间、MFA 状态；它们不属于实体属性，因此不该塞进实体存储。
- `entity_json`：从 JSON 构造实体。对应生产中最常见的形态——实体数据来自数据库或 API，序列化成 JSON 再转成 `Entities`。
- `entity_objects`：从 Rust 对象构造实体。适合类型安全要求高的场景：先定义业务结构体，再实现转换，避免字符串键拼错。
- `validate`：校验策略。把 schema 与策略一起交给验证器，能在上线前发现未知属性、未知动作和类型不匹配。

这五个函数构成一条由浅入深的路径：先能读策略，再能发请求；先只带主体、动作、资源，再补上下文与实体；最后加上静态校验。TinyTodo 那种完整应用，本质上就是把这条路径工程化。

## 运行方式

示例期望 `cedar` 仓库被克隆到顶层目录，也就是与 `cedar-examples` 同级的位置。然后按 README 的说明，在 `Cargo.toml` 里给 `cedar-policy` 加上 `path = "../cedar/cedar-policy"`，让 Cargo 使用本地版本而非 crates.io 版本。改好后运行：

```shell
cargo run
```

如果目录结构不对，构建会直接报找不到包。也可以改用 crates.io 上的发布版，把路径依赖换成版本号，但那样就看不到本地仓库的改动。

## 从 Hello World 到真实集成

示例刻意保持“单文件、无框架”，因此有些生产问题它不回答：

- **策略从哪来**。示例里是字符串常量，生产中通常来自配置文件或策略服务，并需要版本管理。
- **实体怎么保持一致**。示例用静态数据；真实系统的实体存储必须与业务数据库同步，否则授权决策基于过期事实。
- **失败怎么处理**。示例用 `unwrap`；生产代码要把解析错误、请求构造错误和验证失败区分开，分别上报。
- **决策如何记录**。`Response` 带有 `diagnostics`，包含命中的策略 ID 与错误；这些信息应进入审计日志，而不是只留一个 `Deny`。

## 与其他示例的衔接

读完这个最小程序，下一步推荐 TinyTodo：它把 `is_authorized` 封装成一个方法，在每个 handler 开头调用，并演示了实体存储如何转成 `Entities`、策略如何按 `@id` 命名、启动时如何校验 schema。再往后是六个真实用例，用来看不同业务形态下策略怎么写。

如果只记一件事：Cedar 的集成面很小——解析策略、组装请求、提供实体、读取决策、校验 schema。剩下的复杂度都来自应用自身的数据一致性。