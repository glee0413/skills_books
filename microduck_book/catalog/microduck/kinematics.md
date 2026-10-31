---
id: microduck/kinematics
title: 运动学
description: 把训练用的 MJCF 一次性编译成索引化的正向运动学模型，供 50 Hz 回路查询足端、头部与 ToF 位姿。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: kinematics/src/lib.rs
snapshotPath: source-snapshots/microduck/kinematics/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/kinematics/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 运动学：把 MJCF 编译成每 tick 可用的正向运动学

`kinematics/src/lib.rs` 提供了整个系统唯一的几何真源。原型的 `microduck_kinematics` 证明过“解析训练用 MJCF、走树”这条路可行，但它的查询路径是为人手调用设计的：关节角装在 `HashMap<String, f64>` 里，求一个 site 就把机器人每个 body 重算进一个新分配的 `Vec`。台架节奏下无所谓，在每 tick 都要问两只脚的 50 Hz 回路里就是浪费。

## 编译一次，查询是折叠

这里的做法是加载时**编译**：名字解析成索引，每个 site 得到一条压平的 root→site 链路。一次查询就是对这条链做折叠——没有哈希、没有分配、也没有 site 不挂靠的 body。关节角是普通 `&[f64]`，按 `Model` 的关节顺序索引；`joint_index` 只在初始化时调用一次。

`Link` 是链上的一跳：先是进入某个 body 坐标系的固定变换 `rest`，然后（如果该 body 可动）是绕铰链轴的一次旋转。`SiteId` 是个便宜可复制的小句柄，只在产生它的 `Model` 上有意义。

## 公共接口

`Model::parse(xml)` 编译模型；`Model::alpha()` 用 `LazyLock` 解析内嵌的 `assets/alpha/robot_walk.xml`，这份资产正是行走策略训练场景里的同一棵树，换机械结构只需替换文件、重跑夹具生成器，不必改 Rust。查询面包括 `num_joints`、`joint_names`、`joint_index`、`joint_range`（MJCF 声明的 `[lo, hi]` 行程，IK 必须夹在这里）、`trunk_height_m`（`trunk_base` 的世界落高，给地面滤波器当偏移，而不是写死常量）、`site_names`、`site`、`body_names`、`body_parents`。

`site_pose(site, angles)` 返回 site 在躯干坐标系里的位姿；`body_poses(angles)` 按树序一趟算出整个骨架：每个 body 是父 body 的位姿乘上自己的 `rest`，再绕铰链转一下。根节点的世界落点被刻意剥掉，测试 `the_trunk_frame_ignores_where_mujoco_drops_the_robot` 用 `pos="9 9 9"` 钉住这一点。

## 契约：短切片是调用点 bug

两个查询函数都以 `assert_eq!(angles.len(), self.joint_names.len())` 开场，panic 信息是 `angle slice must cover every joint`。源码的理由很直接：短的角切片是调用点的错误，不是机器人的状态，所以宁可炸掉也不要静默读零。`Tree` 解析失败的报错也带名字——缺 `trunk_base` 的模型会被指名拒绝。

## 正确性怎么被钉住

两道锁。`tests/fk_against_mujoco.rs` 在 64 个随机位姿上把每个 site 与 MuJoCo 自己的 `mj_kinematics` 对齐；子模块 `head` 钉住符号约定，因为系统其余部分靠这套符号转向。`hand`、`head`、`tof` 三个子模块把“site 在哪、轴朝哪”这类问题从调用方手里收走。内嵌模型还有一条测试断言 `left_foot`、`right_foot`、`head_camera`、`tof` 这些 site 和 `left_hip_yaw`、`neck_pitch`、`head_roll` 这些关节都还在，资产被改坏时 CI 先炸。

## 谁在用它

里程计每 tick 用 `site_pose` 求两只脚的位置，再把它当作接触点反推躯干，见 [里程计](odometry.md)。头部与地面拾取的动作、`tof` 的几何解释也都建立在这套 site 上——`tof` crate 明确拒绝在没有头部 FK 的情况下做重投影，那个 FK 的供给方就是这里。控制器本身不需要几何，但 `robotd` 的姿态与安全判断需要，见 [robotd main.rs](robotd-main.md)。