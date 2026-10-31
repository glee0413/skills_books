---
id: microduck/control
title: 控制核心
description: duck-control：读总线与写总线之间的模型、观测、策略和安全。
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

`duck-control` 是 `robotd` 下面那层“从读总线到写总线之间”的全部逻辑。它故意不是 daemon：没有 tokio、没有 socket、没有 systemd，`robotd` 负责进程，`duck-control` 只负责机器人。编译器强制这条边界，防止 daemon 关注点泄漏进控制代码。

## 模块

- `bus`：Dynamixel 总线与 `DynamixelIo`，一个 UART 上 15 个舵机 + IMU。
- `io`：`RobotIo` 是唯一能写电机目标的抽象；`Sensors`、`SlowSensors`、`JointTargets`。
- `model`：关节 id/名称、默认/休息位姿、电池电压换算。
- `imu`：IMU 数据。
- `obs`：`Observation` 与 `Command`，策略的输入/输出维度（`OBS_LEN`、`ACTION_LEN`）。
- `policy`：ONNX 策略加载与 `infer`。
- `safety`：`Safety` 持有 `RobotIo`，拒绝非有限值、限幅到执行器范围，是唯一写口。
- `fall`、`pickup`：跌倒检测与捡起/暂停姿态。
- `sim`：MuJoCo over TCP 的仿真后端。

## 数据流

`Observation` 由关节、IMU、命令和上下文拼成固定长度向量；`Policy::infer` 输出动作；`home pose + scale × action` 得到建议目标；`safety.apply` 做最后检查并写总线。策略没有直接写电机的能力，这点由所有权（borrow checker）保证，而不是靠约定。

## 边界

`duck-control` 只被 `robotd` 驱动。`kinematics`、`odometry`、`sounds`、`pet-detect` 等也是库，不是服务；它们没有自己的 runtime 或 socket。`robotd` 里的 `control.rs` 把这层包进 50 Hz tick、socket、健康检查和 systemd 生命周期。这个分层让控制核心可以独立测试、也可以在运行时迁移时被别的进程复用。