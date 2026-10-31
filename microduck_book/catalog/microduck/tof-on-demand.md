---
id: microduck/tof-on-demand
title: 按需 ToF
description: 头部传感器空闲时到底花在哪：深度流几乎不花，头部 IMU 才是代价且没有消费者，于是一个默认关闭的开关取代了整套按需启停设计。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/tof-on-demand.md
snapshotPath: source-snapshots/microduck/docs/project/tof-on-demand.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/tof-on-demand.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 按需 ToF

`tofd` 在每只装了头部模块的鸭子上，从开机到关机一直在测距并读一颗 IMU，不管有没有进程订阅。这件事起初设想为“需要时启动、不需要就停掉”，最后落在一个小得多的改动上，因为每一步都先量了：**深度流不是花钱的那个，花钱的传感器根本没有消费者，而它循环里没有一处值得优化。** 于是激光和单元被留下，头部 IMU 得到一个默认关闭的开关。

## 代价在哪，量出来的

在 olducky（Radxa Zero 3，RK3566）空载、两块流都没人订阅时：

```text
$ ps -L -o tid,comm,pcpu -p "$(pidof tofd)"
    TID COMMAND         %CPU
  12209 tofd             0.0
  12212 tof-sensor       0.5
  12213 head-imu         4.5
```

百分比是单核的，所以约 5% 是这颗 SoC 的 1.25%，且**九成是头部 IMU、一成是深度**；服务 socket 的运行时无事可做，花费为零。

**IMU 的数字来自一次采样里的两次读**，不是唤醒也不是融合。crate 的 `bench_imu` 在停掉 `tofd` 的同一块板上把循环跑了五种方式，各 10 秒、100 Hz：

```text
  sleep only  (0 reads)   cpu  0.69 %
  filter only (0 reads)   cpu  1.00 %
  update      (2 reads)   cpu  3.35 %
  update_all  (2 reads)   cpu  3.86 %
  three-reads (3 reads)   cpu  4.20 %
```

唤醒是 0.69 个点，Madgwick 更新加 0.31，两次 I²C 事务是剩下的约 2.4–2.9；一个陀螺样本加一个加速度样本**就是**两个地址上的十二个字节，所以完整采样不可能少于两次事务——这就是“没有值得优化的地方”的由来（噪声底约半个点）。

**而没有任何东西订阅它。** `head_imu.stream` 在这棵树里没有消费者：`btd` 拒绝代理它（`btd/src/route.rs:412`），updater 的降级 IPC 拒绝它（`updater/src/ipc.rs:819`），没有守护进程订阅。它是为尚未到来的建图工作加的，所以这个守护进程最大的经常性开销，是给没人读的传感器做的一次读。（走路策略的 IMU 是 Dynamixel 总线上另一颗芯片，与此无关。）

## 决定了什么

**`[head_imu] enabled`，默认关。** 循环里没有一处能回本，开关就是答案：没人订阅的流不该从开机起花掉约 4% 的一个核。它住在 `robotd.toml`（`mediad` 已在那里读 `[media]`），所以 `robotctl configure` 会写它并提供重启 `tofd`；`tofd --imu` 可只为一次会话读芯片而不碰文件；关闭时有订阅者会得到点名该键的原因。

**冗余的第三次读还是去掉了**（bmi088-rs#1 加一个只调一次就拿样本的 `tofd`）。它值 0.3–0.9 个点，落在噪声里，落地是为了别的理由：公布的 `accel` 变成算四元数所用的那个样本，而不是约 200 µs 后另读的一个。

**速率是剩下的杠杆，而且是线性的**——`--imu-hz 50` 把读的成本减半。它留作命令行开关而非配置键：第一个真正的消费者决定它要多快。**若真需要便宜的 100 Hz，答案是 FIFO**：两颗芯片都有，十个样本一次事务到达而不是二十次，这是唯一能攻击主导项的办法；代价是帧解析、水位配置和最多 100 ms 延迟，所以不为不存在的消费者去建。

## 被设计过、又不再需要的门控

`accept` 在读请求第一个字节前就把连接订阅到**两条**通道（`tof/src/main.rs:612`），于是 `receiver_count()` 数的是连接而不是兴趣：只要 `head_imu.stream` 的客户端也握着深度接收器。把 `subscribe()` 移进匹配的分支本身就该修，也是下面任何方案的前提。

此后 IMU 线程可以“第一个订阅者到达时打开、最后一个离开后关闭”：`open_imu` 只是几个寄存器写，同样省 4% 而不必让运维知道有个开关。**没建，因为开关先到，且只有它十分之一的机械量。** 两个细节：订阅的回答**不能撒谎**——冷启动时 `ImuStatus` 的 `unavailable: "no reading yet"` 会被读成“没装 BMI088”，所以要等 open 有界地给出结果再答；**冷的 `quat` 是正在收敛的 `quat`**（Madgwick 要约一秒才稳，`tof/src/imu.rs:43`）。

**不给测距加门控，也不动单元**——两者都是测量之前的计划。按需测距只省单核的 0.5%，那是 `tof-sensor` 线程开着激光、轮询并以 15 Hz 发布一帧的成本（见[空闲 CPU](./idle-cpu.md)）；停止与启动本身便宜（`start(hz)`/`stop()` 各一次事务，`tof/src/sensor.rs:293`、`:181`），但它要在唯一拥有共享 I²C 总线的进程里加状态机与恢复路径，并依赖一个没人验证过的硬件假设（先停再启不会重传固件）。`robotd` 的特雷门也可以继续在启动时订阅：它连一次就握住不放（`robotd/src/theremin.rs:237`），有门控时这会正好把激光钉在为弹音符的鸭子开着。

## 为什么不启停单元

理由是关于守护进程的持久事实而非测量。**启动要几秒，且是每进程一次**：`Sensor::open` 探测设备 ID 再上传 ULD 固件——约 90 KB 走 I²C，“400 kHz 下几秒”（`tof/src/sensor.rs:226`），`monitor` 因此会先看到几秒空网格。**没有东西拥有“关”**：两个客户端可以同时要深度，退出时停就需要能熬过 `SIGKILL` 的引用计数，而 systemd 对手动启动的单元没有。**它需要客户端没有的特权**：`monitor` 以 `robot` 组身份跑，`systemctl start` 要 root 或 polkit 规则。**一个单元、两颗传感器**：停 `tofd` 也停掉头部 IMU。socket 激活能解决特权与泄漏，但把固件上传挪到每个会话的第一次连接。

## 还剩给板子的

`ps -L` 显示跑着开关的鸭子上根本没有 `head-imu` 线程；以及空载十分钟的 SoC 温度前后对比——约 4% 的一个核在温度上看不出来，这是该写下来的诚实预期。

**beta 板（2026-10-06）** 是另一回事：头部 IMU 是面板自己 I²C 总线上的 LSM6DSV16X，本文发现昂贵的两件事都不存在——芯片自己融合姿态（SFLP），并把陀螺、加速度和四元数批量进 FIFO，一次突发读带约四个样本。它由 `robotd` 读（`robotd/src/head_imu.rs`），因为共用 HAT 总线这个理由在那块板上不存在，而且它**默认开着**。`zero3` 不变：`tofd`、BMI088、关。