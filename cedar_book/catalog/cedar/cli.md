---
id: cedar/cli
title: Cedar CLI
description: 安装、构建并用 cedar 命令行验证策略、发起授权请求，以及理解 @id 注解与实验特性。
project: cedar
sourceCommit: d5fb0422e6edb8617b595428530224663e122668
sourceRef: v4.3.0-782-gd5fb0422
sourcePath: cedar-policy-cli/README.md
snapshotPath: source-snapshots/cedar/cedar-policy-cli/README.md
sourceUrl: https://github.com/cedar-policy/cedar/blob/d5fb0422e6edb8617b595428530224663e122668/cedar-policy-cli/README.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# Cedar CLI

`cedar-policy-cli` 提供 `cedar` 可执行文件，是把策略、实体和请求放在终端里快速验证的最短路径。它也是理解 SDK 行为的参照物：同一个请求在 CLI 里得到 `ALLOW`，在应用里也应得到 `Allow`，否则问题通常出在实体数据或请求构造上。

## 安装：预编译包、实验版与源码

README 给出三条安装路线，先看清差异再选。

**预编译二进制**附在每个带 `cedar-policy-cli-v*` 标签的 GitHub Release 上，覆盖：

- Linux：`x86_64-unknown-linux-gnu`、`aarch64-unknown-linux-gnu`
- macOS：`x86_64-apple-darwin`、`aarch64-apple-darwin`
- Windows：`x86_64-pc-windows-msvc`

压缩包内含 `cedar` 二进制、`LICENSE`、`NOTICE`、`THIRD_PARTY_LICENSES.txt` 和 sha256 校验值；发布页还提供 `curl | sh`（POSIX）与 `irm | iex`（PowerShell）的一行安装脚本。

这些是默认特性构建。两个关键限制：`tpe` 与 `symcc` 子命令只在实验版构建中可用（实验版启用 `tpe` 与 `analyze`，后者才暴露 `symcc`）；`partially-authorize` 以及 `--validation-mode permissive`/`partial` 参数根本不随二进制发布，需要就从源码构建。

**实验版**是并行发布的 `cedar-policy-cli-experimental-<target>.<ext>` 归档，二进制名同样是 `cedar`，但启用了 `tpe` 和 `analyze`。`analyze` 特性暴露 `cedar symcc ...` 子命令，用于策略的符号验证，运行时还必须另外安装 [cvc5](https://github.com/cvc5/cvc5) SMT 求解器。README 提醒这些特性的接口可能随版本变化，重视稳定性就用常规版。

**从源码安装**需要先装 Rust（rustup）：

```sh
cargo install cedar-policy-cli
```

## 构建与运行

在仓库内构建：

```sh
cargo build
```

或 `cargo build --release`。在仓库里运行帮助命令可以列出全部子命令：

```sh
cargo run -- --help
```

`sample-data` 目录存放 CLI 的示例输入，覆盖策略、实体和请求 JSON；每个子目录的 `README.md` 写了具体跑法，照着执行就能看到 `ALLOW` 或 `DENY`。本书“六个真实用例”一页也给出了 `cedar validate` 与 `cedar authorize` 的完整命令形态：前者只关心策略是否与 schema 一致，不需要实体；后者需要实体存储和一条具体请求。把请求写进 JSON 文件的好处是能进版本库、能批量回归，也方便和策略评审一起 diff。

## @id 注解：CLI 自己的命名约定

README 开头专门说明：CLI 使用 `@id("PID")` 注解来给策略起名。这不是 Cedar 标准语义——注解在语言里没有内置含义，怎么用由应用决定。CLI 只是选择用它作为策略 ID 的便捷写法。

这个约定影响诊断输出。默认策略名是按加入顺序生成的编号；一旦写了 `@id`，响应里的 `reason` 就会显示该名字。TinyTodo 直接复用了 CLI 的 `rename_from_id_annotation` 逻辑，因此在日志里能看到 `admin-omnipotence` 这类可读的策略名，而不是数字编号。做策略审计时，这一点比想象中重要：报警和日志里出现的是人写得出的名字。

## 版本与许可

变更记录维护在 `main` 分支的 `cedar-policy-cli/CHANGELOG.md`，历史版本看 crates.io 或 GitHub Releases。许可证为 Apache-2.0；预编译归档额外附带 `NOTICE` 与 `THIRD_PARTY_LICENSES.txt`，运行 `cedar license` 也能打印同样的归属信息。

## 什么时候该用 CLI

三类场景最适合：写策略时做即时反馈；把策略和请求样例交给同事复现问题；在 CI 里跑一遍 `validate` 加批量 `authorize`，防止策略改动引入回归。真正上线时仍应通过 SDK 集成，CLI 的角色是“开发期的显微镜”，不是运行时组件。