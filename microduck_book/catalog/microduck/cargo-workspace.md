---
id: microduck/cargo-workspace
title: Cargo workspace
description: 一个 workspace、26 个 crate，按守护进程、库和工具分层。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: Cargo.toml
snapshotPath: source-snapshots/microduck/Cargo.toml
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/Cargo.toml
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# Cargo workspace

Microduck 的根 `Cargo.toml` 是一个 workspace：26 个 crate 共享版本、依赖和 profile，但每个服务仍是一个独立可编译单元。当前 workspace 版本是 `0.18.3`，Rust 版本下限和上限都是 `1.89`，因为 Yocto 镜像用 OpenEmbedded 自带的 Rust 构建，不能要求更新。

## 三类 crate

- **守护进程**：`robotd`、`updater`/`updaterd`、`configd`、`btd`、`padd`、`mediad`、`tof`、`nfc`。每个服务一个 crate、一个 systemd unit，但一起打进同一个 release。
- **库**：`duck-ipc-proto`（wire contract）、`duck-control`（控制核心）、`kinematics`、`odometry`、`sounds`、`pet-detect`、`robotd-params`。它们没有 socket、没有 tokio runtime、没有 systemd，只被守护进程驱动。
- **工具**：`robotctl` 随机器人发布；`duckctl` 在笔记本上运行，`xtask` 负责打包/签名/晋升，`test-support` 提供测试夹具。

## 几个关键约束

`default-members` 故意排除了 `duckctl`：`cargo board --bins` 要为 aarch64 构建所有默认成员，而 `duckctl` 是开发机上的 BLE 客户端，不该被交叉编译到板子上；`--workspace` 仍会 lint/test 它。

`[workspace.metadata]` 固定了四个外部运行时/资产版本：ONNX Runtime（floor 1.23，target 1.28.0）、Rockchip NPU runtime（v2.3.2）、官方策略集（`pollen-robotics/microduck-policies` v8）、duck detector（`duck-v1`）和 GStreamer 插件（v3）。这些值同时出现在 `scripts/` 的独立脚本里，测试会断言两处一致，防止板子上出现版本漂移。

release profile 没有做激进的 `strip`/`lto` 优化：机器人出问题时需要 journald 里的 panic backtrace，去掉符号表会让诊断变成裸地址。