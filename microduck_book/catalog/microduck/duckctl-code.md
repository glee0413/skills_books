---
id: microduck/duckctl-code
title: duckctl 客户端
description: 笔记本侧的命令行客户端：BLE 发现、分片重组、按命令生成 JSON-RPC 行，并在能直连时把自己变成 ssh。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: duckctl/src/main.rs
snapshotPath: source-snapshots/microduck/duckctl/src/main.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/duckctl/src/main.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# duckctl 客户端：用笔记本电脑访问机器人

`duckctl/src/main.rs` 是手机 App 的替身，也是唯一能用真实无线电测试 `btd` 的办法。它的定位有一句精确的表述：**蓝牙只是它今天到达机器人的方式，不是它是什么**。`mediad` 给了机器人第二个传输，按设计能到达另一组方法——`robot.move` 在 BLE 上被拒绝、在 WebRTC 上被允许，`net.connect` 反之——所以名字说的是哪台机器人，不是哪个无线电。BLE 是唯一答案的时候它叫 `duck-btctl`。

**机器人上没有任何东西依赖这个 crate**，这才让 `btleplug` 进不了发布。它曾以 `btd` 的 example 形式存在，靠所在目录被顺带获得；一个没人依赖的 crate 才能把这件事说清楚。真正随镜像发布的是 `robotctl`，它在机器人本机上讲 unix socket。选 `btleplug` 而不是 `bluer`，是因为它跑在开发者的机器上：macOS 的 CoreBluetooth、Linux 的 BlueZ、Windows 的 WinRT，`bluer` 会把客户端锁死在 Linux。

## 发现：为什么不过滤

`scan` 走的是与所有命令相同的发现流程，只是拿到结果就停。它**什么都不连接**，这正是机器人完全失联时该先敲它的原因，也是它只能报告广播里有的东西的原因。

`Seen` 保留每条广播到达时的样子（名字为 `None` 就记 `None`，而不是换成地址回退值，因为“报告了但没有名字”本身就是诊断结论），`Address` 解码 `duck_ble::adv` 里的 IPv4 字段。扫描用 `ScanFilter::default()` 是刻意的：CoreBluetooth 对 service 过滤是**严格**执行的，而一台已配对的机器人经常以空 service 列表上报，于是 `--name` 回退只能匹配到过滤后已经返回的东西，在它最该起作用的场景里形同废纸——这就是“这次 no robot found，下次又好了”的全部解释。所以：全收，然后在这里区分。

时间常量讲述了同一类教训：`SCAN_TIME` 8 秒（BLE 发现确实慢）、`NAME_GRACE` 4 秒（名字只在 scan response 里，可能被漏掉）、`SCAN_POLL` 250 ms（固定睡一觉再取快照会间歇性失败，轮询让常见情况一秒内结束）、`TWIN_GRACE` 1 秒（从 legacy 广播立刻连接在多数 Linux 笔记本上会失败，得等扩展广播）。`Target` 负责 `--name` / `DUCK_ROBOT` / 第一个找到的机器人三级决策，`DEFAULT_PIN = "000000"` 是出厂默认，`DUCK_PIN` 覆盖它。

## RPC：一行请求，一行回答

`characteristics()` 找出 `RPC_UUID` 并**检查**它既可写（`WRITE` 或 `WRITE_WITHOUT_RESPONSE`）又可通知，把“写进去没有回响”的沉默换成一句指名道姓的错误。分帧复用 `duck_ble::framing` 的客户端半边与 `Reassembler`，所以如果分帧不对称，这个工具第一时间就不工作；唯一刻意的不对称是行长上限——机器人那侧的上限约束的是“无线电范围内一个未配对的对等端能迫使它缓冲多少”，这里没有这样的对等端，共用紧的那一个会让 8 KiB 以上的回复读不出来。

`request_line` 把一个 `Command` 变成一个 JSON-RPC 行加一个等待预算。预算按场景分：`REPLY_TIMEOUT` 15 秒、`SLOW_REPLY_TIMEOUT` 60 秒（`net.connect` 会轮询 NetworkManager 45 秒）、`UPDATE_IDLE_TIMEOUT` 从 `duck_ipc_proto::UPDATE_MAX_SILENCE_SECONDS` 推出来（安装前钩子的上限，再加一分钟余量）、`FOLLOW_TIMEOUT` 一天（`update watch` 跟到被中断）。全部是**空闲**超时而非总时长，因为一条进展通知就是机器人还活着的证据，每次都能重置时钟。`LINK_POLL` 每两秒检查一次链路，否则掉线会伪装成机器人失联，而且要等满整个预算才说出来。

版本不一致时 `warn_about_skew` 只警告不拒绝。原来的拒绝错了两处：它误读了 `API_VERSION` 的含义（那是同一块板上二进制之间的约定，笔记本常常比机器人新一个 release），也误判了严格的时机——BLE 是给没有网络的机器人用的传输，而 `wifi connect` 正是它获得网络的路径，因为版本偏差拒绝它，等于在最需要的时候拿走了修偏差的命令。

## 命令面

`Cli` 的全局参数只有 `--name`、`--verbose`、`--pin`；`Command` 覆盖 `Scan`、`Ip`、`Ssh`、`Scp`、`Open`、`Logs`、`Status`、`Version`、`Update(Update)`、`Os(Os)`、`Info`、`Quack`、`Health`、`Wifi(Wifi)`、`Name`、`Do`、`RebootMotors`、`Account(Account)`、`Policy(Policy)`、`Pad(Pad)`、`UdpPad`、`Reboot` 和兜底的 `Call { method, params }`。

`Ip`、`Ssh`、`Scp`、`Open` 和没给地址的 `UdpPad` 只需要广播里的一个字段，所以先按 `scan` 的方式读，读不到再连上去问；`Ssh` 与 `Scp` 会先查本机记住的地址（`recall_reachable`），省掉八秒。`deliver` 最后用 `become_program` **把自己变成** `ssh` 或 `scp`，于是终端、退出码和密钥提示都是它们自己的。`Logs` 不是 `journalctl` 命令行，也永远不会是：它经由一个范围内任何人都能说话的无线电提供，所以机器人从固定列表里挑单元。

它的对端是 [BLE 守护进程](btd.md)；`udp-pad` 子命令则是 [手柄守护进程](padd.md) 那条 LAN 路径的发送端。