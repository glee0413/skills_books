---
id: microduck/architecture
title: 系统架构
description: 本页给出 Microduck 的服务拆分、Unix socket 上的 JSON-RPC 契约、状态归属、安全授权与可观测性，并解释每个结构决定背后的理由。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/architecture.md
snapshotPath: source-snapshots/microduck/docs/design/architecture.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/architecture.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 系统架构

整机：服务怎么拆、彼此怎么说话、状态放在哪、谁有安全授权。原文范围为"第一个出货版本"，不是会被重写的 `microduck_runtime` 原型。

## 七个守护进程与三条结构性规则

**只有 `robotd` 碰机器人。** 十五个舵机和 IMU 板共享一条串口总线，50 Hz 控制回路独占它；客户端只能发**意图**（"这么快走""看那里""站起来"），由 `robotd` 内的安全层决定什么可执行。

`configd`、`updaterd`、`btd` 对 `robotd` 没有 systemd 依赖、不带 ML 运行时、不带媒体栈，因为"控制回路起不来的机器人"正是需要被重新配置、更新或回滚的那台。这也是配置在 `configd` 而非 `robotd` 的理由。`mediad` 和 `padd` 允许依赖它：没有相机和手柄的机器人仍可更新。

`btd`、`padd`、`mediad` **不拥有机器人任何东西**，只是传输：BLE 子集、手柄、WebRTC 数据通道。三者可替换而不触碰行为，且每天被使用，所以应用要用的 API 不会悄悄腐坏。

| 服务 | 拥有 | 监听 |
|---|---|---|
| `robotd` | 电机、感知、策略、安全、`robot.health` | `/run/robotd.sock` |
| `configd` | Wi-Fi、身份、配对 PIN、手柄绑定、重启 | `/run/configd.sock` |
| `updaterd` | 发布的校验、交换、门禁、回滚 | `/run/updaterd.sock` |
| `btd` | 无——API 子集的 BLE 传输 | BLE GATT |
| `padd` | 无——手柄传输 | `/run/padd/pad.sock` |
| `mediad` | 相机音频管线、WebRTC、远程前门 | `:8080`、`:8443` |
| `tofd` | 头部 ToF，8×8 深度，只发布 | `/run/tofd/tof.sock` |

## 发布与状态

一次构建整体落在 `/opt/robot/daemon/releases/<version>/`；`updaterd` 校验签名、移动 `current`、重启单元，再问 `robotd` 健不健康，不健康就放回旧发布。崩溃循环由启动计数器兜住，见[更新系统设计](./updater-design.md)。

状态规则一句话：**`releases/<ver>/` 之外的一切在更新和回滚中都存活**。OS 走 A/B 槽时 `/etc` 随镜像替换，只有 `/var/lib/robot` 存活，于是 `robotd.toml` 分两层：`/etc/robot/robotd.toml` 是镜像基底，`/var/lib/robot/robotd.toml` 只放这台机器改过的键，由 `robotd_params::Params::load` 合并。用户层坏了不拦机器人：搁置文件、按基底运行、报 *degraded* 并点名——绝不 *unhealthy*，否则每一版发布都会因为这个谁也修不了的文件被回滚。

## 控制面与数据面

控制面是命令、配置、状态、感知事件，几十字节、≤100 Hz，走 socket；数据面是约 27 MB/s 的视频，**绝不跨 socket**。

控制面用 **JSON-RPC 2.0、一行一个对象（NDJSON）**，框架 `tokio_util::codec::LinesCodec`。选标准协议看中的是请求/响应关联、错误对象和**通知**——推送进度与事件流正好是这个形状；异步配处处超时，沉默 socket 是正常答案。

真正的理由是 **Unix socket 而非 localhost HTTP**：文件权限（`0660` 加专用组）就是免费授权；`SO_PEERCRED` 给出调用者身份，同时用于审计和强制——socket 组决定谁能**说话**，`allow_uids`/`allow_gids` 决定谁能**改机器人**（仅变更类调用），只读调用故意不设门，好让支持人员检查一台无权修改的机器人；"绑错接口"这一类 bug 不再可表达，因为绑 `0.0.0.0` 会把固件更新控制暴露到网络。不用 HTTP/WS 的独立理由是协议需要服务端推送：HTTP 上要 POST 调用加 WebSocket/SSE 通知两套机制，而持久 NDJSON 上调用和通知是一套、没有握手，**概念更少才是目标**。

数据面坚持**传特征不传帧**：`robotd` 不需要相机帧，需要"球在 (x,y)""有人"这类几十字节、10–30 Hz 的派生特征。感知放在传感器旁边，`mediad` 跑推理并发布；控制回路只读本地缓存的**最新**快照，后写胜出，于是 `mediad` 卡住只降低感知质量，不增加电机抖动。

## 安全与授权

- **死区/心跳**：命令停止或 RTT 突增，`robotd` 自己停下。网络会分区、LLM 会卡住、笔记本会睡眠。
- **意图而非电机写入**：远程只发速度、注视、"坐下"，跌倒检测与关节/温度限制仍由 `robotd` 权威决定。
- **显式仲裁**：手柄、应用、远程、自主层要有优先级与交接，本地/物理应能抢占远程；v1 同时一个媒体会话。

隐私单列：这是别人家里的相机和麦克风——远程会话需显式同意、串流要有可见指示，DTLS-SRTP 过 TURN 也端到端加密。

## 可观测性

每个服务把 `tracing` 写到 stderr 再进 journald，级别由 `RUST_LOG` 控制。**第一行是自己的身份**，级别 `warn`，以扛过 `RUST_LOG=warn`：

```
WARN starting service="robotd" build=0.2.0 (rev a1b2c3d, built 2026-07-28T13:50:00Z)
     exe=/opt/robot/daemon/releases/0.2.0/bin/robotd pid=814
```

`exe` 最值钱：它说明进程实际从哪个发布目录启动，是"更新成功"和"链接动了但 systemd 还在跑旧路径"的区别。每 tick 心跳在 `debug`，`info` 每五分钟一条摘要带达成 tick 率；每 tick 一行 `info` 让空闲机器人一天约 8.6 万条，会挤掉事故需要的日志。

**运行版本与安装版本是两个问题。** `updaterd` 不能中途重启自己，所以更新后几秒内运行二进制合法落后。只报一个版本号的工具在这窗口里必然错，且错得让正常机器人看起来坏了。`robotctl version` 同时报两个：`updaterd` 落后是短暂且唯一不自愈的偏斜；`robotd` 落后**不该发生**，它在本该重启的集合里——两种诊断不能共用一句话。`revision` 由 CI 编译进 `DUCK_REVISION`，本地诚实报告 `rev unknown, not a CI build`，绝不在运行时读 git——出厂的机器人没有仓库。

`robotctl health` 把硬件与软件合成一个答案："这台机器人怎么了"在回答前并不分成两半，而一小时前回滚过发布的机器人和舵机没电的机器人看起来一样。它**在不健康或不可达时非零退出**，可给脚本当门禁；电池、温度、pin 只报告不评判。

## 远端与构建顺序

`mediad` 拥有 PeerConnection：一个 PC 不能跨进程拆（轨道与数据通道共享一条 DTLS/SCTP 关联），于是它就是**远程网关**。服务器端 agent 反而不该塞进 WebRTC：它要的是一两秒一帧加状态，走 rendezvous 的控制通道（HTTP/SSE 上的 JSON-RPC，无 ICE/DTLS/TURN），见[远程 WebRTC](./remote-webrtc.md)与[外网访问与账号](./remote-access.md)。

构建顺序本身是决定：**先建 `updaterd`，再用它运送此后每次迭代**。这在失败还免费时前置风险，也让更新路径在出货前被练习数百次。代价：对着 `robotd` 的**接口**构建；早期健康探针很弱，先测机制；始终保留手工恢复（SSH/重刷），因为更新器装在被它更新的产物里。