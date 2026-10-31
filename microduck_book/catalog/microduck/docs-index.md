---
id: microduck/docs-index
title: 文档地图
description: 本页是 Microduck 所有文档的分类索引，并给出“一页只拥有一个机制”的归属规则及其被漂移文档逼出来的理由。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/README.md
snapshotPath: source-snapshots/microduck/docs/README.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/README.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 文档地图

`docs/README.md` 不是目录列表那么简单，它同时是一份**归属契约**：哪一页拥有哪个机制，别处只能指过去。

## 两个前门

根目录的 [README](./readme.md) 是给"想了解这是什么"的人；`docs/faq.md` 是另一个前门，面向**在鸭子之上做东西**的人：模型太重跑不动、想把摄像头接进自己的程序、为什么某个 Space 连不上。FAQ 也是发布者的起点——`docs/policy-manifest.md` 是 `.onnx` 旁边 `manifest.json` 的字段契约，设计页只给理由并指向它。

## robot/：你已经有一台机器人

这一栏是任务导向的操作文档：`cheatsheet.md` 列全 `robotctl` 命令；`pair-a-gamepad.md` 讲每个手柄配一次的模式、`pad pair`，以及配不上时怎么办；`udp-pad.md` 讲局域网 UDP 手柄的开启方式、`duckctl udp-pad` 和自定义发送端要遵循的线格式；`cheatsheet-dev.md` 是需要开发板的命令（分支构建、候选版本、开发推送）；`dev-push.md` 是本机编译、ssh 安装、不跑 CI；`simulation.md` 是 `scripts/duck-sim`；`telemetry.md` 讲匿名数据、绝不发送的内容和关闭方法；`duckctl.md` 是笔记本经蓝牙操作机器人的全部命令；`install-dev.md` 与 `install-by-hand.md` 分别是"从零装一块板"和"拆成单步以便逐步测试"。

对应到本书，可读[模拟机器人](./simulation.md)、[遥测与隐私](./telemetry.md)、[开发推送](./dev-push.md)。

## design/：你在改守护进程

这一栏讲"怎么运作、为什么"，改动很少；**当行为与设计文档冲突时，文档才是 bug**。

原文在这里写下了整份索引最重要的规则：**一个机制只由一页拥有，其他页用一句话指过去。** 如果某个事实属于下表某一页，别的页就只写一句并链接，而不是再解释一遍。理由是具体的：一个事实写在六处就会朝六个方向漂移，而每个方向单独看都合理——这正是六份文档曾同时承诺"`updaterd` 和 `btd` 会保留旧二进制直到下次重启"的原因，而它们在两个发布之前就不这么做了，其中还包括有人排查这个问题时最先读到的两页。所以两页冲突时，**不拥有该机制的那页是错的**。

归属大致是：`architecture.md` 管服务拆分、IPC 契约、状态归属、安全与授权；`robotd-design.md` 管控制回路（Dynamixel 总线与端口归属、模型、感知、观测、策略、安全，以及挂在 tick 上的其他东西）；`updater-design.md` 管更新引擎（校验、原子交换、健康门禁、回滚、发布格式）；`policy-channel-design.md` 管 ONNX 策略从哪来、怎么试别人的、`reset` 恢复什么；`restart-order.md` 管每条移动 `current` 的路径上哪个单元在第几步重启，以及启动时如何；`app-path-design.md` 管 `btd` 与 `configd`，即手机如何经 BLE 配置机器人；`remote-webrtc.md` 管 WebRTC 会话、信令与控制通道；`remote-access-design.md` 管从局域网外到达机器人；`boot-recovery-net.md` 管启动失败时回退到 golden；`simulation.md` 管孪生体的接缝、身体协议、假无线电与容器。

本书对应页：[系统架构](./architecture.md)、[robotd 控制回路设计](./robotd-design.md)、[更新系统设计](./updater-design.md)、[策略通道](./policy-channel.md)、[重启顺序](./restart-order.md)、[手机 BLE 配置路径](./app-path.md)、[远程 WebRTC](./remote-webrtc.md)、[外网访问与账号](./remote-access.md)、[启动恢复网络](./boot-recovery.md)、[仿真设计](./sim-design.md)。

## project/：你在运营这个项目

这一栏是**带日期的记录**，不是参考手册。它们描述某个时刻，并且故意会过期。包括路线图、CI 密钥与轮换的一次性设置、四个安装路径 bug 如何到达板子的复盘（已关闭，它教出的规则成了 `updater-design.md` §9.1）、真实 Radxa Zero 3W 的启动记录、BLE 更新实验、媒体与 NPU 启动、手柄最简配对、空闲 CPU 测量、按需 ToF。

这类页的价值在于保留"当时看到什么"，所以不要用它们当现状。现状看 roadmap，机制看 design。

## ideas/：还没设计

这是"暂存区"：某个东西将来需要一份设计文档，先在还没有文档时把想法写下来，免得思考丢失，也免得被误当成已经做出的决定。目前只有 `autonomous_behavior.md`，记录行为栈要放弃什么，以及合唱与特雷门琴工作留下的想法。

## 别处

`CONTRIBUTING.md` 是构建、测试、仓库布局、约定与发布（见[开发与测试约定](./contributing.md)）；`project/npu-bringup.md` 讲 RK3566 NPU 上的鸭子检测器；`deploy/README.md` 讲机器人镜像被配置成什么样、provisioning 实际做什么。

原文末尾的这份索引本身就是维护工具：新增文档时，必须先回答"这个机制归谁"，否则六处漂移的故事会重演。