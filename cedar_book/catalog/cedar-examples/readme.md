---
id: cedar-examples/readme
title: 示例仓库总览
description: 九个官方示例的用途、所用语言与对应 SDK，作为选择学习起点的索引。
project: cedar-examples
sourceCommit: f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37
sourceRef: f4d2dbb
sourcePath: README.md
snapshotPath: source-snapshots/cedar-examples/README.md
sourceUrl: https://github.com/cedar-policy/cedar-examples/blob/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/README.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 示例仓库总览

`cedar-examples` 收集了演示 Cedar 用法的应用与策略集。顶层 README 只做一件事：用一张表告诉你每个示例用什么语言、演示哪套 API，然后让你进入子目录看各自的操作说明。它适合当索引用，不适合当教程读。

## 九个示例一览

| 示例 | 语言 | 说明 |
|---|---|---|
| [`tinytodo`][] | Rust, Python | 任务清单应用，用 Cedar 做授权，演示 [Cedar Rust APIs][] 的用法 |
| [`tinytodo-go`][] | Go, Python | 同一类任务清单应用，演示 [Cedar Go APIs][] 的用法 |
| [`cedar-java-hello-world`][] | Java | 演示 [Cedar Java APIs][] 的最小应用 |
| [`cedar-rust-hello-world`][] | Rust | 演示 [Cedar Rust APIs][] 的最小应用 |
| [`cedar-wasm-example`][] | TypeScript | 演示 [Cedar Wasm APIs][] 的最小应用 |
| [`cedar-policy-language-in-action`][] | Cedar | 配套“Cedar policy language in action”工作坊的策略与 schema |
| [`cedar-example-use-cases`][] | Cedar | 两个示例应用的策略与 schema（目录内现已扩展为六个用例） |
| [`oopsla2024-benchmarks`][] | 多种 | OOPSLA2024 Cedar 论文的性能评测策略、schema、基准代码与脚本 |
| [`cedar-java-partial-evaluation`][] | Java | 演示 [Cedar Java APIs][] 的偏求值（partial evaluation）能力 |

## 怎么选起点

**想学 SDK 集成**，按语言选 hello world：Rust 看 `cedar-rust-hello-world`，Java 看 `cedar-java-hello-world`，TypeScript 看 `cedar-wasm-example`。三者结构相似——解析策略、构造请求、带实体判定、按 schema 验证——先读一个，再对照其他语言看 API 形状的差异。

**想看完整应用**，选 `tinytodo`。它有 HTTP 服务端、Python CLI、内存实体存储、策略文件和 schema，覆盖从请求解析到授权再到业务执行的整条链路。`tinytodo-go` 是同一思路的 Go 版本，适合做跨语言对照。

**想学策略建模**，选 `cedar-example-use-cases`。它不含应用代码，只有策略、schema、实体和成组的允许/拒绝请求，最适合拿来练“读策略、猜结果、再验证”。

**想做性能或学术复现**，看 `oopsla2024-benchmarks`；**想研究新特性**，看 `cedar-java-partial-evaluation`。这两个偏专门用途，初学可以跳过。

## 仓库的共同约定

所有示例都遵循同一套输入形态：策略写在 `.cedar` 文件，schema 用 `.cedarschema` 或 `.cedarschema.json`，实体存储是 `entities.json`，授权请求可以写成 JSON。这套约定让 `cedar` CLI 能直接对任意示例执行 `validate` 和 `authorize`，不必为每个项目写适配层。

语言绑定方面，Rust 对应 `cedar-policy` crate，Go 对应 `cedar-go`，Java 对应 `cedar-java`，TypeScript 对应 `cedar-wasm`。四套 API 的语义一致，差异主要在类型系统和错误处理风格。表里的 API 链接正是指向这些绑定：读某个示例前先点开对应链接，能少走很多“这个类型从哪来”的弯路。

各子目录对环境的假设并不统一：Rust Hello World 明确要求把 `cedar` 仓库克隆到同级目录并使用路径依赖，TinyTodo 则由 `cargo build` 从 crates.io 拉取 Cedar 包。因此构建前必须读子目录的 `README.md`，不能照搬另一个示例的步骤。版本要求也要留意，旧 SDK 跑新示例往往在编译期就失败。

## 阅读顺序建议

如果跟着本书读，建议顺序是：先读 Rust Hello World 建立 API 骨架，再读 TinyTodo 看工程化落地，最后读六个真实用例练策略建模。其余示例按需查阅——它们是同一批概念的横向展开，不必逐个通读。

## 许可与贡献

仓库使用 Apache-2.0 许可证。安全问题的报告方式写在 `CONTRIBUTING.md` 的 security issue notifications 一节，不走公开 issue。各子目录的 `README.md` 才是构建与运行的准确说明，顶层表格只保证“这个示例存在、大致讲什么”。

[`tinytodo`]: ./tinytodo-tutorial.md
[`tinytodo-go`]: https://github.com/cedar-policy/cedar-examples/tree/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/tinytodo-go
[`cedar-java-hello-world`]: https://github.com/cedar-policy/cedar-examples/tree/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/cedar-java-hello-world
[`cedar-rust-hello-world`]: ./rust-hello-world.md
[`cedar-wasm-example`]: https://github.com/cedar-policy/cedar-examples/tree/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/cedar-wasm-example
[`cedar-policy-language-in-action`]: https://github.com/cedar-policy/cedar-examples/tree/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/cedar-policy-language-in-action
[`cedar-example-use-cases`]: ./use-cases.md
[`oopsla2024-benchmarks`]: https://github.com/cedar-policy/cedar-examples/tree/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/oopsla2024-benchmarks
[`cedar-java-partial-evaluation`]: https://github.com/cedar-policy/cedar-examples/tree/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/cedar-java-partial-evaluation
[Cedar Rust APIs]: https://docs.rs/cedar-policy/latest/cedar_policy
[Cedar Go APIs]: https://github.com/cedar-policy/cedar-go
[Cedar Java APIs]: https://github.com/cedar-policy/cedar-java
[Cedar Wasm APIs]: https://github.com/cedar-policy/cedar/tree/main/cedar-wasm