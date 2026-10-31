---
id: microduck/sounds
title: 声音与合唱
description: 从 SoC 序列号派生的可播种合成器：一个 tag 一套配方、若干变体，渲染成机器人直接播放的 wav 音库。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: sounds/src/lib.rs
snapshotPath: source-snapshots/microduck/sounds/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/sounds/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 声音与合唱：从一颗种子派生出的嗓子

`sounds/src/lib.rs` 是机器人的声音。一个整数种子确定性地派生出一个 `Personality`——音域、谐波倾斜、鼻音、颤音、quack 程度、语速。两个种子听起来是两只不同的生物，同一个种子永远听起来一样。每个声音 **tag** 有若干 **variant**（同一副嗓子内的小幅重掷），所以鸭子不会听起来像一段卡住的录音。

tag 一共七个：`alarm`、`greet`、`inquire`、`peck`、`chirp`、`coo`、`wheee`。`wheee` 是分段的那一个（start / loop / end），好让 `robotd` 在乘坐持续多久就流多久。

## 配方表

`TAGS: [(&str, Recipe); 7]` 把每个 tag 映射到一个配方，顺序只表示渲染顺序。`Recipe = fn(&Personality, u32) -> Vec<f32>`，输入性格与变体号，输出 `SR` 采样率的单声道浮点缓冲。

`variant_count(tag)` 决定每个 tag 有几个变体：`greet` 与 `chirp` 各 12 个，因为它们最常被听到（唤醒与嘴部触发）；`wheee` 6 个；其余 10 个。变体越多，鸭子越像活的，这条换算关系被直接写进注释。

`render(tag, p, variant)` 查表并调用配方，未知 tag 返回带名字的错误。`to_wav(buffer, path)` 用 `hound` 写 16-bit 单声道，必要时先建父目录。`render_all(p, out_dir)` 渲染全部 (tag, variant) 到 `<out_dir>/<tag>/<tag>_<letter>.wav`——正是 `robotd` 播放所用的布局；分段 tag 写 `<tag>_start_<letter>.wav`、`_loop_`、`_end_` 三连。

## 从 Python 移植改变了什么

这是 `apirrone/microduck_sounds`（numpy 版）的 Rust 重写，目的是让一个 release 自带声音生成器——板上不需要 venv、numpy 或 ffmpeg。配方被忠实地移植，但随机流不是 numpy 的，渲染也是 48 kHz 原生而不是 22.05 kHz 再重采样，所以**每只鸭子的声音在音库重建时重掷一次**。那是一次音库版本升级（`BANK_VERSION`，当前是 5——v4 是最后一个 Python 音库），与上游合成器调音是同类事件，不是数据丢失：声音由 SoC 序列号派生，此后稳定，靠 `rng.rs` 里那条钉住 RNG 的测试守住。没有移植的是 `parrot` 模块（麦克风到学来的短语），那是运行时里从未发布过的实验。

## 身份：种子就是这只鸭子

`hardware_seed()` 取硬件派生的种子：`robotd_params::serial::soc_serial()` 读出烧进芯片、能活过重刷的 efuse 序列号——`configd` 给机器人命名用的也是它；没有它的板子退回 `/etc/machine-id`。`seed_from_id` 做 `sha256(id)` 取前 8 个十六进制字符当 u32，与 Python 安装器的推导完全一致，所以机器人保住了它已有的种子和性格。测试用 `test-serial` 钉到 `0xC96F_1146`。

`DUCK_IDENTITY` 环境变量是唯一的例外，而且理由具体：模拟器一个容器跑一台机器人，或者一台笔记本跑好几台，否则它们会共享序列号，于是共享声音**和合唱 id**——那个 id 是鸭子识别自己信标回声的方式，完全相同的鸭子会把彼此的信标当作自己的丢掉，永远听不见任何人。机器人上没有任何东西设置这个变量。

## 它与别的模块怎么接

`chorale` 子模块把声音接到合唱：`robotd` 通过 `btd` 广播信标，鸭子们在同一段旋律里各唱各的声部。`stream` 负责把分段的 `wheee` 变成可连续播放的流；`synth` 提供 `SR` 与 `to_i16`。播放侧的触发来自 [手柄守护进程](padd.md) 的扳机与 [robotd main.rs](robotd-main.md) 的 `robot.sound`，而音库的存在与否决定了 `robotd` 是否会礼貌地拒绝一次发声请求。