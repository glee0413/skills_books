---
id: microduck/mediad
title: 媒体守护进程
description: 媒体守护进程的 crate 结构：可移植的控制通道、与五个服务的上游连接，以及只存在于 Linux 的 GStreamer 管线。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: mediad/src/lib.rs
snapshotPath: source-snapshots/microduck/mediad/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/mediad/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 媒体守护进程：摄像头、音频与 WebRTC 网关

`mediad/src/lib.rs` 只有七十多行，但它是一张地图：这个 crate 的模块划分本身就是设计声明。模块文档开篇说明“目前存在的是控制通道，端到端贯通，除了通道本身”，然后逐个点出三块可移植的核心。

## 控制通道的三段

`route` 决定一个 WebRTC 对等端可以调用哪些方法。这条边界是安全边界，也是产品边界：`robot.move` 在 BLE 上被拒绝、在 WebRTC 上被允许，`net.connect` 反过来。

`upstream` 保存到五个“拥有答案”的服务的连接，每个 (service, lane) 一条。也就是说 `mediad` 不做业务，它只是把对等端的行转发给真正负责的守护进程。

`session` 是管道本身：行进来、行出去，回复从不解析。`session::run` 刻意与传输无关，所以没有 WebRTC 对等端也能测；`relay` 的会合控制通道因此原样复用它——一个函数被两个场景共享，比两套各自正确的实现更能说明抽象是对的。

## 可移植的其余部分

`config` 读 `robotd.toml` 里的 `[media]`，用 `robotctl configure` 编辑；`web` 是那个由它自己驱动的守护进程所服务的控制台页面；`producer` 描述对等端协商之前机器人如何自我介绍，并读取 `updaterd` 写下的账号凭据。`camera` 给出内参和它属于哪个传感器模式，`sensor` 在媒体图里找到实际装配的摄像头并带上单位与光学参数，`stream`、`turn`、`snapshot`、`vetbook` 各管一段。`indicator` 是摄像头 LED——画面正在离开机器人时它必须亮着，这条在架构文档里被单独写出来，因为它是最直白的一眼可见的隐私信号。

`relay` 是通往会合服务的外向连接，也是让一只鸭子在自己的局域网之外可达的东西；`turn` 提供中继候选，给那些路由器后面、外部网络又打不通洞的机器人。

## 平台门控为什么各不相同

`pipeline` 的门控是 `#[cfg(any(target_os = "linux", feature = "gstreamer"))]`：在本进程里跑 `webrtcsink` 和信令服务器，前面接 `mpph264enc`，每个对等端一条 `control` datachannel 接到 `session::run`。这既是打包决定，也是硬件决定。

`exposure` 是**仅 Linux 且不是打包决定**——它通过 `ioctl` 往 V4L2 控件写自动曝光，因为板子的 3A 引擎不做这件事；模拟源或测试图后面没有传感器可测光，所以 `main` 只为真实摄像头武装它。

`detect` 与 `frame` 跟 `pipeline` 同门控而不是跟 `exposure`：前者读 tee 的原始分支，在帧里找别的鸭子，`duck-detect` 与 `ort` 都是可移植的，所以孪生里的鸭子也能被指向一个模型；后者是本地按需的原始帧端点，因为 WebRTC 控制通道刻意不承载相机大小的回复。

## 在系统里的位置

`mediad` 是机器人对外的第二个传输面：手机 App 之外的那条路。它和 [BLE 守护进程](btd.md) 的方法集合是互补的，一个为本机局域网与远程准备，一个为没有网络的出厂状态准备。它读的摄像头几何、深度数据分别与 [ToF 守护进程](tof.md) 和 NPU 侧的检测器共享同一套坐标系约定；`updaterd` 写下的账号凭据由 `producer` 读取，所以媒体面能否建立远程会话，最终取决于更新面写下的身份。