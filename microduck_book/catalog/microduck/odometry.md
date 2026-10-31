---
id: microduck/odometry
title: 里程计
description: 用足底接触锚点与 IMU 姿态估计躯干在世界系里的位置和朝向，并在换脚时保持连续。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: odometry/src/lib.rs
snapshotPath: source-snapshots/microduck/odometry/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/odometry/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 里程计：用接触点把躯干钉在地面上

`odometry/src/lib.rs` 回答“机器人在哪”。它移植自原型运行时的接触式里程计，后者又源自 Rhoban 人形机器人的 `model_service`。核心假设只有一句：任意时刻，某只脚底上的某一点是机器人与地面的接触点。把这个点锚定到世界系（平地上它的世界 Z 是 0，X/Y 就取它成为锚点时的位置），用 IMU 定躯干姿态，躯干的世界位置就由正向运动学反推出来。当另一只脚底的某个角点掉到锚点以下——一步落地——锚点搬到那里，带的却是那个角点当前的世界 X/Y，于是估计不会跳变。

朝向完全来自 IMU 积分出的 yaw。没有磁力计，所以世界系是“开机时机器人看的方向”，这对任何只关心相对运动的消费者都够用。像守护进程一样，这一版只支持 alpha 机型，v1/v1.5 的几何留在了原型里。

## 状态与两个时间常数

`Odometry` 持有 `model`、一对 `feet` 的 `SiteId`、锚点集合 `anchors`、`JOINT_NAMES` 到模型关节索引的 `joint_map`（嘴那一位是 `None`，它不带动任何腿）、可复用的 `angles` 暂存、`anchor_foot`、`anchor_local`、`anchor_xy`、`position`、`yaw`，以及换锚时用于确认的 `pending` 与 `pending_ticks`。

两个常量定义了它的时间行为：`SWITCH_MARGIN = -0.010` 表示候选角点必须低于 Z = -10 mm 才有资格竞标，这点余量是给 FK 与 IMU 噪声的，不是物理深度；`SWITCH_CONFIRM_TICKS = 2` 表示候选必须连续两个 tick 保持最低，50 Hz 下是 40 ms——远在一个支撑相之内，也远超过单 tick 的抖动。没有确认，FK 噪声会在支撑期里把锚点拖着走。

## 一次 update 做什么

`update(joints, quat_wxyz)` 的契约是“只喂新鲜样本”，滑行的 tick 没有新信息可说。它先把 `JOINT_NAMES` 顺序的测量角按 `joint_map` 摊进模型顺序，归一化四元数，然后**只算一次**两只脚的 `site_pose`；下面所有角点都通过这个结果变换，而不是每个角点重走一遍腿链（原型每 tick 9 次链求值，这里 2 次）。

首次调用由 `needs_init` 播种：把起始姿态下锚点的世界 X/Y 记下来，于是躯干从 (0,0) 出发，而不是被脚的偏移顶开。接着 `reproject` 用“接触点在世界系 (anchor_xy, 0)”反算躯干位置；`lowest_corner` 扫两只脚的全部候选角点，找出低于阈值的那个；确认成立后换锚、保留角点已有世界 X/Y、再投影一次。最后 `yaw = rot.yaw()`。

## 锚点集合：`ALPHA16`

候选“鞋底角点”是 `AnchorSet`，由 `microduck_rl/scripts/odom_anchor_points.py` 在鞋底网格上采样得到。`Odometry::alpha()` 用 `ALPHA16`——整只鞋底上的 4×4 网格。模块文档给了对比数据：MuJoCo 孪生里走 3.2 m，`ALPHA16` 漂 9 mm，旧 v1.5 的包围盒 `V15` 漂 17 mm 且站立高度偏高 3.7 mm，扁平补丁的四角 `ALPHA4` 漂 16 mm；扫描多花的时间约半微秒。`alpha_with` 可以换集合，测试 `alpha_anchor_sets_lie_on_the_sole` 检查每个点确实落在鞋底 footprint 内、右脚是左脚的镜像。

## 接口与接缝

对外只有 `position()`（米，Z 是离锚点定义的地平面的高度）、`yaw()`、`anchor_xy()`、`anchor_foot()`（0 左 1 右）和 `anchors()`。内部 `reproject` 是唯一写 `position` 的地方，所以“不跳变”这件事只需要在一个函数里成立。

它依赖 [运动学](kinematics.md) 的 `Model`、`Pose`、`Quat`、`SiteId`，几何只有一个来源；`duck_ipc_proto::JOINT_NAMES` 保证关节顺序与线上一致。测试里还有一条参考轨迹 dump，供 Python 复刻版 `PyOdometry` 对齐，以及一份按锚点集合测 `update` 成本的基准。估计值最终由 [robotd main.rs](robotd-main.md) 的回路发布出去。