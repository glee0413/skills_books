---
id: microduck/tof
title: ToF 守护进程
description: 头部 ToF 的驱动与帧格式：运行时区分两代传感器，用三种 zone 语义保住“空”与“测不出”的区别。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: tof/src/lib.rs
snapshotPath: source-snapshots/microduck/tof/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/tof/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# ToF 守护进程：8×8 的距离矩阵与三种语义

`tof/src/lib.rs` 是头部深度传感器的驱动与帧形状；真正拥有传感器、在 socket 上发布帧的守护进程是 `tofd`（`src/main.rs`）。硬件是一颗 VL53L5CX 或 VL53L8CX，挂在 HAT 的 I²C 总线上——与音频编解码器同一条 `i2c3`——或者，在 beta 板上，是一颗走 SPI 的 VL53L8CX（`link` 模块）。无论哪种，它都朝头部朝的方向看。

## 两代传感器在运行时决定

两代在板上可以互换，差别只在固件和驱动前缀，所以装的是哪一颗不是编译期选择：先读 ID，再在**上传任何固件之前**选定驱动，这个判定就是 `Generation`。现场的两代鸭子都有。`Sensor::open` 与 `Link` 一起把这个选择藏起来，调用方只看到一颗能出帧的传感器。

## 为什么把 C 代码 vendored 进来

ST 的每个 Ultra Lite Driver 是 40 KB 寄存器序列加 550 KB 固件块，而固件在**每次启动**时都要上传进传感器。用 Rust 重写等于转写一个二进制块和一个没人文档化过的状态机；依赖第三方 crate 则把机器人必需的一颗传感器押在别人的维护意愿上。所以两个 ULD 原样 vendored（BSD-3-Clause，`vendor/LICENSE.txt`），Linux i2c-dev 的平台钩子来自 `microduck_runtime` 里被实测过的那一份，一次实现、按代各编译一次，再用一层扁平 shim 把所有结构体留在 C 侧边界。`build.rs` 编译它们，并解释这里唯一的小把戏；没有系统库，也没有 Python——原型是用 pip 包加 ctypes 加载 `.so` 摸到老那颗的。

这让驱动**仅限 Linux**，而且刻意做得显眼：在其他目标上 `build.rs` 什么都不编译，`Sensor` 成为不可构造类型，于是 `open` 拒绝，而不是构建失败。`tofd --fake` 是这块板之外运行它的方式，不受影响；`cargo test --workspace` 也不受影响，这正是重点。

## 一帧是什么，不是什么

分辨率被钉死：`ROWS = 8`、`COLS = 8`、`ZONES = 64`，`start` 配的就是 8×8，线上格式承载的也是它。`Frame` 里 `distance_mm` 与 `status` 是并行的、行主序的、长 `ZONES` 的向量。

`Zone` 把 ST 的状态字节解释成三种情况，其中最关键的是后两种的区分：`Range(f32)` 对应状态 5（有效）或 9（有效，大脉冲）；`NoTarget` 对应 255——传感器看了，范围内什么都没有，那是**空的空间**，是信息；其他任何状态都是 `Unusable(u8)`，测量失败，携带原始码，因为它对读 ST 表的人有具体含义。把“没有东西”和“我测不出”压成同一个值，是地图最不能接受的损失。

`Frame::zone(index)` 是唯一的解释入口：状态码不在 `STATUS_VALID` 里就看是不是 `STATUS_NO_TARGET`；距离为负（偶发的收敛失败）即使状态说有效也判为 `Unusable`。`zones()` 遍历全部，`valid_count()` 给出“传感器到底看见东西没有”的那一个数字。越界的索引读作 `NoTarget`，因为线上传的是向量，来自另一个 release 的对等端可能给得少，消费者的 panic 不是可接受的失败模式。

## 没有重投影

帧里是传感器自身坐标系下的原始 zone 距离和 ST 的逐 zone 状态，**没有重投影**：把 zone 变成机器人坐标系里的方向需要头部的正向运动学，而这个守护进程没有它，也不伪造它。想要几何的消费者（建图、避障）会把 `tof.frame` 与关节状态一起用，那套几何的提供方是 [运动学](kinematics.md)；只想**看**传感器的消费者——`robotctl monitor`——什么都不需要。这些帧进入机器人的感知面，与 [媒体守护进程](mediad.md) 的摄像头数据相邻。