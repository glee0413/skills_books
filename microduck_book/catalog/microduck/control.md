---
id: microduck/control
title: 控制核心
description: duck-control 是读总线与写总线之间的一切，被编译器挡在进程之外，只暴露模型、IO、观测、策略与安全这几样东西。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: duck-control/src/lib.rs
snapshotPath: source-snapshots/microduck/duck-control/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/duck-control/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 控制核心

`duck-control` 的模块文档把它一句话说清楚：**读总线与写总线之间的一切**。它刻意**不是**一个守护进程——这里没有 tokio、没有 socket、没有 systemd，那些全归 `robotd`。边界由**编译器**而不是纪律来保证，这正是阻止进程级关切漏进驱动电机那部分代码的办法。它持有的控制路径（模型、总线、`io::RobotIo`、观测、策略、安全）设计在 `docs/design/robotd-design.md` §2。

## 十个模块就是一条控制路径

`bus`（Dynamixel 总线）、`fall`（跌倒判定与软让步态）、`imu`（`imu_to_dxl` 板）、`io`（`RobotIo` 及其假实现）、`model`（关节表、零位与电压）、`obs`（观测向量与命令）、`pickup`（被抱起）、`policy`（ONNX 会话与推理）、`safety`（唯一能写电机目标的那一层）、`sim`（`robotd-design.md` §9 当初推迟的 MuJoCo over TCP 后端）。

顺序即依赖方向：模型与总线给出传感器读数，`io` 把它们拼成一次 tick 的输入，观测构造器把 `Sensors` 与命令变成策略要的向量，策略给出十四个关节目标，安全层夹紧、判跌、执行 deadman，最后才写回总线。安全之所以单独成层，是因为“谁能写电机目标”必须是可数的，`pub mod` 里也只该有这一条写路径。

## 导出了什么

重导出清单就是给 `robotd` 与测试用的门面。`ImuData` 是 IMU 样本；`FakeIo`、`IoError`、`JointTargets`、`RobotIo`、`Sensors`、`SlowSensors` 是 IO 抽象——`FakeIo` 让控制逻辑在无硬件、无仿真的进程内被测；`model` 侧给出 `BATTERY_EMPTY_V`、`BATTERY_FULL_V`、`battery_percent`（电压到百分比的唯一换算）、`DEFAULT_POSITION`、`REST_POSITION`、`JOINT_IDS`、`JOINT_NAMES`、`NUM_JOINTS`；`obs` 侧给出 `OBS_LEN`、`ACTION_LEN`、`Command`、`Observation`。

这些常量在这里是**实现**，但它们同时是契约：`duck-ipc-proto` 里的 `POLICY_OBS_LEN = 61`、`POLICY_ACTION_LEN = 14` 和 `ROBOT_MODEL` 是给发布策略的人看的，而 `duck_control::obs` 是真正构造观测的地方，那边有测试断言两者一致。换句话说，策略清单里写的 `obs_len` 与 `action_len` 会被 `updaterd` 在下载前、`robotd` 在加载时各拒一次，依据就是这个宽度。

## 为什么仿真在库里

`sim` 放在这里而不是单独的守护进程，是同一个边界论证的推论：MuJoCo 后端要替换的正是 `RobotIo` 与时钟，而这两者都在库内；把它做成服务就得把整条控制路径搬出去或跨进程传 61 维观测，两者都比一个模块贵。库外的人只看见 `RobotIo` 的两种实现：真的总线，或一张 TCP 连到仿真器的表。

同一条理由解释了为什么这里没有日志初始化、没有配置解析、没有信号处理：它们是 `robotd` 的关切，混进库就会让“驱动电机”这件事依赖 systemd 的存在，而安全层与被 `FakeIo` 驱动的单元测试都该能在任何地方跑。

协议侧的授权、车道与错误码见[IPC 契约](./ipc.md)，控制回路本身的时序见[robotd 控制回路设计](./robotd-design.md)，`robotd` 的进程装配见 [robotd main.rs](./robotd-main.md)。