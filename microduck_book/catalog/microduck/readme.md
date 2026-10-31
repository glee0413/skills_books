---
id: microduck/readme
title: Microduck 是什么
description: Microduck 是一只由 RK3566 上若干 Rust 守护进程驱动的 25 厘米双足机器人，本仓库就是它的大脑。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: README.md
snapshotPath: source-snapshots/microduck/README.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/README.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# Microduck 是什么

仓库自述的第一句话把它定位得很清楚：**这是鸭子的脑子**。机器人本体约 25 厘米、800 克，跑在 Rockchip RK3566 上；这个仓库里没有机械图纸，只有让它动起来、连上网、以及安全换掉自己软件的代码。

## 一个身体，七个守护进程

系统由若干常驻守护进程组成，各自守着一件事：`robotd` 拥有控制回路和电机总线，用神经网络策略以 50 Hz 驱动十五个舵机；`updaterd` 安装签名发布并在机器人启动不健康时回滚；`configd` 管 Wi-Fi 与身份；`btd` 是手机使用的蓝牙入口；`padd` 读手柄；`mediad` 通过 WebRTC 推摄像头；`tofd` 提供头部深度传感器。

它们之间只有一份 JSON-RPC 契约，跑在 Unix socket 上。原文强调的关键点是：**每一个客户端——手机应用、控制台、手柄、你自己的脚本——发出的调用完全一样**。因此没有"应用专用通道"这种东西，也没有哪条路径会因为长期无人使用而悄悄腐坏。服务拆分与不变量的完整论证见[系统架构](./architecture.md)。

## 策略从哪里来

仓库只负责**加载**策略，不负责训练。所有步态策略在隔壁的 `microduck_rl` 里产生：MuJoCo 做物理仿真、PPO 做强化学习、域随机化做 sim2real 迁移，最后导出成本仓库加载的 ONNX。这条边界解释了为什么 `robotd` 的代码里满是"观测 61 维、动作 14 维"的形状检查，却没有任何训练逻辑。

策略文件的来源、试用与回退是另一条独立通道，见[策略通道](./policy-channel.md)。

## 它会做什么

README 用四段视频说明能力：走路（拿起手柄就能开）、装上轮子后请求 roller 模式并加载"另一个大脑"、低头用喙捡东西、被推倒后自己站起来。此外还会坐下、踢球、按命令前滚，以及用一种属于它自己的声音叫。

这些动作在代码里不是四个特例，而是一条优先级链上的不同网络，机制见[robotd 控制回路设计](./robotd-design.md)。

## 文档怎么分

原文把入口分成两类人。已经有鸭子的读者从 `docs/robot/cheatsheet.md` 开始，那里列全了 `robotctl` 命令。要在它上面开发的读者则看 `docs/design/architecture.md`（一页讲清整机，再一页讲一个部件）、`docs/robot/install-dev.md`（从空板到能接收分支构建）、`docs/robot/dev-push.md`（本机编译、ssh 安装，约一分钟）和 `docs/robot/simulation.md`（没有真机时用 `scripts/duck-sim` 让真实守护进程对接 MuJoCo 身体）。

原文特意指出 `docs/design/` 记录的是"为什么是这样"，`docs/project/` 记录的是"哪里出过错、什么能补上"。这个区分很重要：设计页是契约，项目页是会过期的现场记录。完整地图见[文档地图](./docs-index.md)。

## 一件小事

README 末尾写"制造过程中没有鸭子受到伤害，但咨询了好几只"。这句玩笑背后是项目的态度：这是一台进入家庭的相机与麦克风，隐私与安全必须在设计里被认真对待，而不是等出事再补。