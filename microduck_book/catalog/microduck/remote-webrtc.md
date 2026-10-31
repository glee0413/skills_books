---
id: microduck/remote-webrtc
title: 远程 WebRTC
description: 本页讲 mediad 如何用 webrtcsink 在机器人内跑信令、用一条 PeerConnection 承载视频与控制通道，以及局域网无鉴权、远程靠桥接的设计取舍。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/remote-webrtc.md
snapshotPath: source-snapshots/microduck/docs/design/remote-webrtc.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/remote-webrtc.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 远程 WebRTC

手机、浏览器或服务端程序如何通过 WebRTC 驱动并观察机器人。本页只管机制；需求在[系统架构](./architecture.md) §5。范围是**局域网信令**；局域网外到达是同一设计前面加代理，见[外网访问与账号](./remote-access.md)。

## 一条会话，四路流

`webrtcbin` 没有被使用。`mediad` 用的是 `gst-plugins-rs` 的 **`webrtcsink`**：它自带信令协议、会话模型和按消费者管理编码器，剩下要设计的是**控制面**而不是媒体管线。

```text
peer（浏览器 / 手机 / 服务端程序）
   ├── video track      摄像头，硬件 H.264（mpph264enc，constrained-baseline）
   ├── audio track      麦克风；遥操作时双向
   ├── datachannel "control"  可靠、有序 → 机器人 API
   └── datachannel "teleop"   不可靠、无序 → 输入与高频遥测
```

重传的 80 ms 旧摇杆命令比无用更糟，所以 teleop 用 `maxRetransmits: 0`。**第一版只开 `control`**：可靠有序的 SCTP 让 `intents.rs` 的"后写胜出"继续成立。代价是队头阻塞——一个丢包停住后面所有东西，包括控制 RPC。

等 teleop 落地，`maxRetransmits: 0` 会**乱序**，旧 twist 可能后到并赢得后写胜出。所以 teleop 帧要带**单调序号**，写入方丢掉不比已应用值新的帧；这是传输属性，属于 `mediad`。死区不用改：`safety.gate(command, twist_age)` 本来就按年龄。

## mediad 自己跑信令服务器

`webrtcsink` 有 `run-signalling-server`，服务器跑在 **`mediad` 自己的进程里**，没有第二个要构建、发布、监督的二进制——我们发布的插件是 `.so`，而 `gst-webrtc-signalling-server` 是同一上游 crate 的独立 Rust 二进制。signaller 默认连 `ws://127.0.0.1:8443`，局域网客户端直接连同一个服务器；`mediad/webclient/index.html` 就是一个，单文件、手写协议。

**绑定地址是决定，不是默认值。** 只绑 loopback 会让局域网对端够不着，每次会话都走桥；所以它绑所有接口，这直接决定了谁可以驱动机器人。

## 管线：原始帧分叉，按需取帧

`webrtcsink` 的 sink pad 收已编码 H.264，管线在编码器**之前**分叉原始 NV12：

```text
                              ┌─ queue ─ mpph264enc ─ h264parse ─ webrtcsink
capture ─ NV12 ─ capsfilter ─ tee
                              └─ queue(leaky, 1) ─ appsink ─ 按需一帧
```

两件事需要**像素**：服务器端程序要的是一两秒一帧，不是 30 fps 的 H.264 去解码；以及"感知放在传感器旁边"。NV12 一路到底，因为 rkisp 输出它、`mpph264enc` 接受它。每条分支有自己的 `queue`，原始分支 leaky 且只存一帧，要的是**最新**快照。

**只有读者要帧时才从 appsink 拷出来**：两个读者合起来每秒两帧，而 720p30 一帧是 1.84 MB；全拷是 55 MB/s 的 memcpy，为没人读的帧。没人要的帧只花一次 relaxed load。请求由**下一次**采集回答，而不是最近交付的那帧，否则曝光闭环会振荡。分叉从第一天就在：往活管线里插 `tee` 比一开始就有难得多。

## 授权：局域网没有，远程由桥负责

**第一版没有任何门。** 能到达信令服务器的对端就能开会话、驱动机器人、看相机；这是决定，不是疏忽。配对 PIN 是共享的 `000000`，一个每台都一样的 PIN 不认证任何人。代价直说：同一网络上的任何人都能看机器人的相机。实验台与办公室可以，**家里不行**。

远程路径不需要机器人上的门，因为它在到达之前已被**两端**认证：客户端用 OAuth 向 rendezvous 认证，服务只给它该账号拥有的机器人；机器人向外认证，relay 持有账号 token。

**信任移动了，不是消失了**：机器人与账号的绑定成了必须正确的东西，而它住在服务里——唯一知道答案的位置，但仍是依赖。

## 控制通道是既有 API 的管子

`control` 上的帧是 **JSON-RPC 2.0、一行一个对象**。`mediad` 把调用路由到拥有它的服务的 Unix socket。`btd` 是现成先例：`route.rs`、`session.rs`、`upstream.rs` 都传输无关。路由表该提升为两传输共用、按可到达子集参数化。

要保留的不是代码，是**穷尽匹配**：给 `proto::Call` 加一个变体就让那个文件编译失败。这个保证必须**按传输**成立，否则 WebRTC 就成了它的洞。WebRTC 能到的比 BLE 多，但"多"不是"全部"：`system.pairingPin` 仍排除——不是怕危及本传输，而是它授权的是**另一个**传输，能改 PIN 的对端可以把手机锁在 BLE 恢复路径之外；`update.*` 变更暂时排除，因为更新会重启 `mediad`、断开会话。`account.*` 则放进来。

**回复故意不做关联。** `btd` 转发 socket 输出而不解析：订阅是连接上的通知流，每一条都必须到达客户端，关联回复会破坏这一点。`mediad` 继承同一规则，新增方法时它不需要改动。lane 概念也转移：每个守护进程每连接一次只服务一个请求，`update.subscribe` 后在同连接上发别的会挂起；按方法路由到每 lane 的 socket，各自泵回，不做关联。

## 桥、媒体与几何

远程路径是**到本地信令服务器的桥**：relay 向外连 rendezvous，把同一协议代理到 `ws://127.0.0.1:8443`；DTLS-SRTP 让媒体即使过中继也端到端加密。**本地模式从不依赖桥**。但它不是纯 relay：rendezvous 用 HTTP（SSE 入、`POST` 出）承载同样的信封，peer 与 session id 逐跳不同，所以桥要重写信封、双向维护会话表——**载荷不透明的翻译器**。

媒体质量用一个 `quality` 键命名档位（`1080p30`、`720p30`、`720p15`、`360p30`），而不是宽、高、帧率三个独立键：三者并不独立变化，一个采集路径产不出的组合就是一条起不来的管线，而它会连**控制**通道一起带走，因为 datachannel 与视频轨道捆绑。每一档都是 16:9。

`media.video` 回答画面的几何：宽、高、安装旋转，以及**内参** `fx`、`fy`、`cx`、`cy` 和 `calibrated`。没有它们，单目重建没有尺度、角度也是错的。四个数描述**发送时**的未旋转帧，所以应用 `rotate` 的消费者要交换 `cx` 与 `cy`。`false` 是模块设计值，够画一张房间；`true` 是测量值。**几何未知时键是缺席的**，而不是存在且错误。

`teleop` 数据通道；多对端视频；每会话同意与串流指示；TURN。另外，"所有上线的东西都该带发生时间"仍只是愿望：媒体要用 `abs-capture-time` RTP 头扩展，控制通道要一个单调读数加启动纪元，两者必须用同一个时钟。
