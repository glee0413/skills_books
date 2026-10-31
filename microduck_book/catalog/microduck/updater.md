---
id: microduck/updater
title: 更新引擎
description: 配置驱动的更新引擎：把机器人差异收进 config，把每种失败映射成客户端可行动的 JSON-RPC 错误码。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: updater/src/lib.rs
snapshotPath: source-snapshots/microduck/updater/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/updater/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 更新引擎：配置驱动，失败即协议

`updater/src/lib.rs` 是 `updaterd` 依赖的库根。它的第一句话就是架构承诺：引擎与机器人无关，所有机器人相关的东西都在 `config::Config` 里。换一台机器人意味着新的配置文件、新的签名密钥，也许还有新的健康探针，而不是 fork 这个 crate。

## 模块清单读起来就是更新流程

`manifest` 与 `source` 负责“有什么可装”，`verify` 校验签名与哈希，`store` 管理磁盘上的 release 目录，`preflight` 与 `hooks` 跑安装前后的门槛，`reconcile` 做切换与回滚，`journal` 记录每一次尝试，`telemetry` 上报，`transcript` 保留可回看的运行记录，`policy` 处理策略拉取，`os` 管 A/B 系统槽，`faults`、`orphan`、`vetbook`、`account`、`unix` 各守一角。`preflight` 的失败和 `verify` 的失败必须分开，因为它们对应完全不同的处置。

`pub use duck_ipc_proto as proto` 这一行值得单独看：线上类型在第二个服务也需要它们时才搬出去，之前一直住在这个 crate 里。`robotd` 与 `robotctl` 依赖 `duck_ipc_proto` 而不是这个 crate，于是恢复路径上的代码不会继承引擎的 http/tar/zstd/crypto 依赖树。

## 错误枚举是对外契约

`Error` 的每个变体都映射一个 JSON-RPC 码，由 `code()` 决定，`to_rpc_error()` 转成线上形式。因为“更新失败”对客户端和对支持都毫无用处，错误信息本身就是产品的一部分：`StagingBehind` 会直接告诉操作者 `robotctl update apply {component} --staging --version {candidate}` 这条绕过命令；`ReleaseNotReady` 解释一个刚发布、构建还没上传完资产的 release 长什么样，并给出 release 页面地址；`AlreadySignedIn` 说清“这个机器人已经属于谁”以及 `--force`。

码的复用也是刻意的。`StagingBehind` 共用 `WOULD_DOWNGRADE`，因为对客户端来说答案一样——目标比已装的旧；`SelfTest` 共用 `HEALTH_CHECK_FAILED`，因为要区分的只是消息里点名的二进制；而 `Busy` 有自己的码，因为脚本会重试它，绝不能看起来像通用内部错误。`Verification` 与 `Network` 分开，是为了让被篡改的字节永远不会被自动重试。

`From<hf_robot_account::Error>` 的实现把账号 crate 的错误翻译成本协议的错误，但**不搬运它的措辞**：账号 crate 不知道绕过 `AlreadySignedIn` 在鸭子上的拼法是命令行里的 `--force`，而少一个连字符就够让支持多跑一个来回。

## 反复声明的非目标

模块文档列出四条：不预先抽象运行时（只在守护进程真的会等的地方用 async，`store`、`verify`、`journal` 这类 CPU 或快文件系统工作保持同步，用 `spawn_blocking` 调）；不提前拆 crate；不做操作系统或内核更新，只做应用层；不做硬件能力矩阵，v1 只针对一种硬件配置。四条都是“先不做什么”的决定，也正是这个文件值得当架构文档读的原因。

## 它与谁相邻

发布侧的另一半在 [构建工具 xtask](xtask.md)：它打包、签名、生成 manifest，`promote` 时复用同一份字节；引擎这边只负责验证、安装、切换与回滚。健康门禁询问的对象是 [robotd main.rs](robotd-main.md) 的 `robot.health`，而那个回答的语义——回路是否守住截止时间——正是整条回滚链是否有意义的前提。