---
id: microduck/btd
title: BLE 守护进程
description: btd 是一个无状态的 GATT 传输适配器：把分片重组后的 NDJSON 行按路由表转发给拥有答案的服务。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: btd/src/lib.rs
snapshotPath: source-snapshots/microduck/btd/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/btd/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# BLE 守护进程：只做传输适配器

`btd/src/lib.rs` 用四十行说明了整个服务的定位：**一个传输适配器，别的什么都不是**（架构文档 §4.1）。它不持有任何状态，这一点是承重的，不只是整洁：如果配网或配置住在这里，那么所有其他服务都要依赖 `btd`，而一个 SDK 竟然得走蓝牙才能设置机器人的名字。

所以设计是一根管子。一个 GATT 服务、一个特征值——写它发请求、订阅它收回答——承载**与所有其他传输相同的 NDJSON JSON-RPC 行**（`gatt` 模块解释了为什么是一条而不是两条协议）。`btd` 负责重组分片，用 `route` 的表校验方法名，把行原样转发到拥有答案的服务的 unix socket，再把回复切块送回去。给协议加一个方法，这里只需要在表里加一行。

## 路由与分帧

`framing` 与 `route` 是纯逻辑，可以脱离蓝牙测试。`route` 是一张方法到服务的表：`net.*` 与 `system.*`——wifi、名字、重启——各有一臂指向 `configd`。`framing` 负责把一条可能超过单个 BLE 包的 JSON 行切开再拼回，两端的规则必须对称，否则 [duckctl 客户端](duckctl.md) 用同一个模块的客户端半边就不可能工作，而那正是它作为“协议真测试”而非自说自话的重写的价值。

## 会话层

`session` 是全部行为所在，而它接触无线电只通过 `link::Link`——两个 channel，不是一个 trait。这个选择让测试可以在真实 unix socket 上跑完整会话，完全不涉及蓝牙；也让“会话”这个概念不依赖具体适配器。

`upstream` 存放与那些拥有答案的服务的连接。这里是“无状态”最实在的体现：`btd` 记住的只有连接，不记住任何配置、身份或会话结果。

## 为什么它跑非 root

`btd` 是那个解析**无线电范围内任何人**发来的字节的进程，所以它以非特权身份运行；而 `configd`——只从带对等凭据的本地 socket 上看到类型化 JSON——才是跑 root 的那个。模块文档的判断是：把解析器放在这条边界的“安全侧”，比加固派发器更重要。这不是一句安全口号，它直接决定了两个进程的权限划分，也决定了 `pad.pair` 这类需要 root 的操作为什么被放在 `configd` 而不是 [手柄守护进程](padd.md) 里。

## 广播里它自己读的两个字段

大多数方法只是转发，但有两样东西 `btd` 会读回来：机器人的名字和它的 IPv4 地址。两者都要进广播，所以 `bluez` 模块向 `configd` 问它们并让广播保持同步。`adv` 模块定义地址字段的布局，并**与解码它的客户端共享**——客户端就是 `duckctl ip`，它靠这四个字节做 `ssh microduck@$(duckctl ip)`，不需要连接、不需要配对、也不会有 PIN 错。为什么广播里只放 IPv4 而不放 SSID，`adv` 的注释给了答案。

`chorale` 模块是合唱广播这一块的入口：它和 `adv` 一样属于“广播里到底放什么”的问题，而广播正是 `btd` 少数会自己读回字段、而不是单纯转发的地方。哪些方法需要版本握手、哪些只在本地 socket 上出现，也由 `route` 这张表一处说清，所以新增一个方法不会在传输层留下分叉。