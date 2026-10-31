---
id: microduck/sim-design
title: 仿真设计
description: 用同一批 daemon 驱动 MuJoCo 里的鸭身，把仿真限制在 RobotIo 接缝内的设计取舍。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/simulation.md
snapshotPath: source-snapshots/microduck/docs/design/simulation.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/simulation.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 仿真设计

仿真目标写得很明确：不是 mock，也不是测试夹具，而是一只“孪生鸭”。同一批二进制、同一套单位、同一个 `robotctl` 和 `duckctl open`，只是身体从桌面搬进 MuJoCo。当前状态是 `robotd --sim`、`tofd --sim`、`mediad --sim-camera` 都已可用，控制回路对着 MuJoCo 身体保持 `50.0 of 50.0 Hz · 0 missed`。

## 接缝只有一处：RobotIo

仿真被限制在 `duck_control::io::RobotIo` 这个 trait 后面，共六个方法：`read`、`write`、`set_gain`、`set_torque`、`slow_sensors`（电压与逐关节温度）。接缝之上——50 Hz 回路、ONNX 策略、`Safety`、跌倒检测、里程计、运动学、maploc、全部 IPC 与客户端——一行不改。接缝之下真机只有 `DynamixelIo`，IMU 也不是独立设备，它和十五个舵机在同一次 `sync_read` 里读回。`FakeIo` 本来就是该 trait 的完整实现，所以 `cargo test` 不需要硬件；`RemoteIo` 是第三个实现。

传感器的驱动若与硬件不可分，就不替换：`tofd --fake` 在回路层合成帧，`tof/src/sensor.rs` 明说板外 `Sensor`“不是假传感器，也绝不能变成假传感器”。

## 身体协议：TCP 上的 NDJSON

`duck_control::sim` 用 TCP 传按行 JSON，一次调用一请求一应答。选 TCP 是因为 unix socket 路径上限约 108 字节，且模拟器必须能从 daemon 所在的容器外访问（macOS 上是 Linux 虚拟机跑 MuJoCo）；选 JSON 是因为一 tick 约 1 KB、50 KB/s，而 `nc` 能直接读帧、Python 二十行就能写另一端。`TCP_NODELAY` 不是微优化：Nagle 会把小写入延迟约 40 ms，正好两个 tick，表现出来就是“模拟器很慢”。

请求形如 `{"op":"hello"|"read"|"write"|"gain"|"torque"|"slow", …}`。握手携带 `protocol`（当前为 1）并双向校验，因为两半分属两个仓库，“你的模拟器旧了”和“你的 daemon 旧了”症状相同。模拟器直接报机器人单位：弧度、rad/s、mA，IMU 已在躯干坐标系中解算。模拟器死掉只算一个坏 tick：错误返回给调用者，下一次调用重连，不设退避线程——控制回路本身就是重试计时器。一个连接一次 `hello`，之后按需读写；模拟器死后重连也重新握手，所以协议不匹配在两边都能立刻看出。模拟器报的是它自己模型里的顺序与缩放，不对齐在这里做，否则同一套换算会有两份：一份在模拟器，一份在 daemon，迟早漂移。`duck-body` 由 `microduck_rl` 提供，使用策略训练时同一批 BAM 执行器模型；换场景或改鸭子数量会重启它，daemon 侧按坏 tick 处理。

## 假电台要够坏

在场感知本来就是 `robotd` socket 上的 IPC 契约：`chorale.subscribe`、`chorale.beacon`、`chorale.heard`（带 age 而非时间戳）。`btd` 是 robotd 的客户端，所以假以太网不冒充任何东西，也不抢 socket。`duck-ether --discovery <s> --loss <f> --seed <n>` 让每对鸭子各有被发现延迟并按比例丢包：完美链路会让四只鸭子永远收敛到同一首曲子，而现场 bug 恰恰来自不对称。复现命令是 `duck-ether --discovery 90 --loss 0.3 --seed 3`。

## 架构跟随宿主机

所有产物都是 aarch64。用 `qemu-user` 在 x86 上跑板端二进制，daemon 单独跑没问题（`robotctl health` 报 `50.0 of 50.0 Hz · 3804 ticks · 0 missed`），但在 `systemd-nspawn` 里启动就崩：aarch64 systemd 257 用新 mount API（`fsopen`、`move_mount`、`open_tree`），qemu-user 8.2 不翻译，于是 `226/NAMESPACE`、`243/CREDENTIALS` 接连出现。单元级加固正是启动容器而非跑七个进程的理由，所以孪生改用宿主机架构：x86 上是 amd64 容器加本机编译，Apple Silicon 上直接跑签名过的 arm64 产物。

## 覆盖与不覆盖

相同的是控制回路、策略、安全、跌倒检测、运动学、里程计、maploc、IPC、合唱的选举与节拍、真实 systemd 单元和 updater。被建模的是执行器响应（对真实 XL330 拟合的 BAM 模型）、IMU、ToF、RSSI、相机画面。完全缺席的是 Dynamixel 总线驱动、BLE 射频、相机 ISP 与 rkaiq 的 3A、NPU、硬件编码器、热与电池——驱动类 bug 只能在真机上看。

模拟身份只声明一次：`configd --simulated <serial>`，随后 `system.info` 携带它，`mediad` 在注册的 `meta` 里写 `simulated: true`，`robotctl system info` 打印它；没有客户端靠 `sim-` 前缀去猜。`mediad` 的 GStreamer 管线门控是 `any(target_os = "linux", feature = "gstreamer")`，非 Linux 上要装 `gstreamer` 与 `libnice-gstreamer` 两个 formula，后者缺失时 ICE 要到第一个消费者要 pad 才报错。容器形态每只鸭子一个 `systemd-nspawn`，`machinectl shell duck-a` 进入，`scripts/dev-push.sh microduck@duck-a` 安装。鸭子不能热加入（MuJoCo 编译模型，改数量就重启），相机渲染才是扩展瓶颈。三个选错模型的坑：`scene_walk.xml` 没有碰撞、`qpos0` 不是姿态、启动时必须给力矩。

使用方式见[模拟机器人](simulation.md)，安装流程见[开发推送](dev-push.md)，接缝上方的回路见 [robotd 控制回路设计](robotd-design.md)。