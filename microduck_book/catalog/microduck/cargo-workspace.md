---
id: microduck/cargo-workspace
title: Cargo workspace
description: 一个 crate 一个服务，default-members 把笔记本客户端排除在交叉构建之外，四条外部版本 pin 各只有一处真相。
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

根 `Cargo.toml` 是机器人守护进程的 workspace：**一个 crate 对应一个服务或工具**，与 `docs/design/architecture.md` §1 的服务切分一致，`robotd`、`btd`、`mediad` 如今是平级的兄弟。

## 成员与 default-members

`members` 列出 25 个 crate：`btd`、`configd`、`duck-ble`、`duck-control`、`duck-detect`、`duck-ether`、`duck-ipc-proto`、`duckctl`、`kinematics`、`mediad`、`netpadd`、`nfc`、`odometry`、`pad-imu`、`pad-map`、`padd`、`pet-detect`、`sounds`、`tof`、`updater`、`robotctl`、`robotd`、`robotd-params`、`test-support`、`uyvy`、`xtask`。`resolver = "3"`。

`default-members` 与 `members` 只差一项，而这一项就是该键存在的全部理由：`duckctl` 不在其中。`cargo board --bins`（`dev-push.sh` 与发布工作流都用）会为 aarch64 构建每一个 default member——这对机器人的守护进程是对的，对开发者在自己机器上跑的客户端是错的：它会在发布路径上为一块**永远不该看见蓝牙栈**的板子交叉编译一整套蓝牙栈，毫无收益。替代方案是在每个 `--bins` 调用点显式点名二进制，但那样有两处要手工保持同步，正是这个仓库反复写下的那类失败；放一个列表在这里，新守护进程被两处同时接住，没人需要记得。`--workspace` 不受影响，所以 CI 照旧 lint 并测试 `duckctl`。

## 四条外部版本 pin

`[workspace.metadata.*]` 里的四个版本各自只有一处真相，理由完全一致：安装脚本是**用 curl 单独取得**的，读不到这个文件，所以脚本里带一个字面量，再由测试断言两者一致。两份版本漂移过一次的后果，就是一块板子上的 ONNX Runtime 是 1.20.1，而 `ort` 在低于 1.23 时会 panic。

- `onnxruntime`：`floor = "1.23"` 是 `ort` 接受的最低值（随 `ort` 依赖一起提），`target = "1.28.0"` 是板子低于下限时装的那个。`xtask package` 把它们烤进 release 的 preinstall 钩子，测试断言 `scripts/setup-board.sh` 与之相符。
- `rknpu`：`runtime = "v2.3.2"` 是 Rockchip `rknn-toolkit2` 仓库里的 tag（`.so` 在那里）。它必须至少和转换器产出的模型一样新，因为比模型旧的运行时会在 `rknn_init` 处带着一个数字失败。
- `policies`：`pollen-robotics/microduck-policies`，`version = "v8"`，且它是**下限**——新 provision 的板子装的那套，也是本守护进程默认值所能加载的最旧官方集合；低于它的板子被 post-install 钩子抬上来，高于它的不动。越过它用 `robotctl policy update`，不需要发守护进程版本；而升这个 pin 需要，因为它随 release 走，且只在某个槽位的默认文件名只有新集合才有时才升。
- `detector`：`pollen-robotics/microduck-duck-detector`，`version = "duck-v1"`，同样由 `scripts/seed-detector.sh` 播种、由 `robotctl duck-detector update` 抬升。注意模型仓库与**数据集**仓库同名，而机器人只寻址模型（`huggingface.co/<repo>/resolve/…`、`api/models/<repo>`），数据集在 `datasets/` 下，共享的名字在线上无法混淆。
- `gst-plugins`：`pollen-robotics/microduck-gst-plugins`，`version = "v3"`，即 `mpph264enc` 与 `webrtcsink`/`webrtcsrc` 的预编译插件——两者都不存在于任何 Debian 套件；同样由 `setup-gstreamer.sh` 的字面量加测试对齐。

## 工具链的上下限

`[workspace.package]` 是 `version = "0.18.3"`、`edition = "2024"`、`rust-version = "1.89"`。1.89 是为了 `std::fs::File::try_lock`——单飞更新锁靠它实现而不必加依赖；edition 2024 需要 1.85，所以这个数字覆盖两者。声明出来是为了让用旧工具链的同事看到“requires rustc 1.89”，而不是一个“方法不存在”的错误。

它同时是**上限**：Yocto 镜像用其 OE 发行版自带的 Rust 从源码构建每个 release（wrynose 上是 1.94.1），所以这里不能要求更新的东西。0.15.1 曾把下限抬到 1.99 以用原子量的 `try_update`，结果构建不进镜像；`mediad` 现在把那几处写成 compare-exchange 循环。这条规则写在 `CONTRIBUTING.md` 里。

## 依赖与 release 配置

`[workspace.dependencies]` 统一了 `serde`、`serde_json`、`semver`（带 `serde`）、`thiserror` 2、`tokio` 1、`socket2` 0.6、`clap` 4（derive）、`hound`、`tracing`、`tracing-subscriber`、`tokio-util`、`async-trait`、`url` 的版本，成员按需 `workspace = true` 引用。

**没有自定义 `[profile.release]`，这是决定而不是疏忽。** 二进制大小不值得优化——模型产物会让几 MB 的二进制相形见绌；而调优的代价大于收益，尤其 `strip = true` 会去掉符号表，把 journald 里的一次 panic 回溯变成一串裸地址，而那正是你诊断一块无法挂调试器的机器人时最需要的东西；`lto` 与 `codegen-units` 只是让构建更久。

工作区如何切分服务、`duck-ipc-proto` 为什么只依赖 serde，见[IPC 契约](./ipc.md)；控制核心为什么是库而不是守护进程，见[控制核心](./control.md)；这些 pin 怎样进入产物，见[构建工具 xtask](./xtask.md)。