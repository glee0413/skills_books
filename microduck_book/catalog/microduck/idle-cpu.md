---
id: microduck/idle-cpu
title: 空闲 CPU
description: 一只没人理会的鸭子仍在跑五个守护进程：逐项测量它们空闲时在做什么、哪些改动省下了功耗、哪些被证明不值得改。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/idle-cpu.md
snapshotPath: source-snapshots/microduck/docs/project/idle-cpu.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/idle-cpu.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 空闲 CPU

一只放在桌上、没有手柄、没有观众、也没人驱动的鸭子仍跑着五个守护进程。这篇记录它们空闲时在做什么、改了什么，以及两个**没有**改的候选为什么被否掉。这里的数字要么是对代码的算术，要么是在开发机上量的，**只有测试图案在板子上量过**。

## 原来在花钱的地方

| | 空闲前 | 空闲后 |
|---|---|---|
| `mediad` raw 分支 | 每秒拷贝 1.84 MB × 30 | 有读者要才拷，约 2 次/秒 |
| `mediad` 测试图案 | CPU 画 720p30，29.4% 单核 | 256x144@5，像素率的 0.7% |
| `tofd` 帧轮询 | 约 100 次 I²C 读/秒 | 约 45 |
| `padd`，手柄连着、摇杆居中 | 50–100 msg/s | 10 |
| `pet-detect`，启用时 | 约 400 次 FFT/s + 4 次前向/s | 房间没声音就不跑 |

## `mediad` 为没人拷每一帧

appsink 回调把每个 buffer 从 tee 拷进一个“读者取最新”的槽。720p30（`media.source` 默认相机）下 UYVY 一帧是 1280 × 720 × 2 = 1.84 MB；读者只有 2 Hz 的自动曝光和启用时 2 Hz 的检测器，于是三十次拷贝里二十八次是白做的：自启动起 55 MB/s 的 memcpy，加每秒三十次 1.8 MB 分配。现在由读者开口、回调回答**下一帧**。回答“最后一帧”更省，但会把读者自己的轮询周期塞进测量里——一个靠半秒前亮度转向的曝光环会来回打猎而不是收敛。

## 测试图案曾按相机分辨率绘制

`[media] source = "test"` 的板子改推 `videotestsrc`，让没有相机的机器人仍有一个会话：信令、协商、datachannel、控制 API 都骑在视频轨上。它原本跑在 `[media] quality`。差别在像素从哪来：相机的帧从 ISP 出来是硬件，`v4l2src` 转发几乎不花钱；测试图案是**这个进程**一帧一帧画出来的。两块同型号板子空载对比：`Camera`/rkisp 是 6.1%，`Test`/720p30 是 **29.4%**——为它替代的东西付了五倍代价，而且 `camera.json` 上写着 `"frames":23142` 对 `"consumers":0`。现在跑 `TEST_PATTERN_GEOMETRY`，256x144@5、16:9 且 8 对齐，一帧 73 KB，是像素率的 0.7%；这不是妥协，图案**用途**里没有任何东西需要分辨率。`media.video` 报的就是这个小几何，因为那是机器人在产出的东西。

## 轮询与重复帧

`tofd` 曾以 100 次/秒轮询一颗 15 Hz 的传感器：每 10 ms 一次 `data_ready`，横跨两帧之间 66 ms，约七次 I²C 事务才找到一帧，六次答“没有”。现在跳过传感器不可能有帧的那段、只在其余时间轮询，帧龄不变——仍由 10 ms 轮询界定，那本来就是察觉一帧的粒度。这在每只装了 ToF 的鸭子上都跑，与有没有人用特雷门无关：`tofd` 持续测距并发给碰巧订阅的人，没有订阅者是常态。`[theremin] enabled` 默认关，也不改变这个数字，它省的是 `robotd` 那次停着的读。

`padd` 则把同样的三个零每秒重发五十次：摇杆是轮询的，没碰过的手柄每个 tick 产生完全相同的帧——一次编码、一次写、一次 flush，加 `robotd` 侧一次解析，在两种还会发归零 `robot.move` 的模式里翻倍。现在相同帧被扣住，两条意图共写一次。**只扣“不要求任何运动”的帧**，这才避开 `padd` 读不到的 `[safety] deadman_ms`：deadman 只把 twist 归零，在已经命令零的帧上让它触发什么也不改变；在命令运动的帧上它会停住一只摇杆还按着的机器人。宠物分类器同理：1 秒 40 个 log-mel 带是 100 次 512 点 FFT 加一次前向，每秒四遍；旁边的环境声监听本来就在测房间，于是它等到有东西突出于本底再跑，只在抚摸期间例外（结束边必须像开始边一样由推理找出）。它默认关。

## 故意不动的地方

`safety.apply` 每个 tick 写十六个目标位置，包括停着没动的 tick。改成有条件能省：总线上十六个舵机的 Protocol 2.0 同步写是 94 字节，1 Mbaud 下 940 µs；同一 tick 对十七个设备的同步读约 422 字节、4.2 ms，所以写只占一条在 20 ms tick 上已约四分之一利用率的总线的五分之一，它不是瓶颈。CPU 上是一次 94 字节的 `write(2)` 加 tty 层，算上完成中断约 15 µs，50 Hz 是**单核的 0.075%**。代价却是：这次写是回路里唯一保证“舵机被告知该在哪”的语句，改成有条件就要枚举所有能让舵机存储目标失效的路径——力矩开关、掉电、舵机清了 shutdown latch 后自重启、`init` 自己的 `interpolate_to`——错一次就是一只在没人想到的情形下不再保持姿态的机器人。

多线程 tokio 运行时同样不值得动：`robotd`、`configd`、`updaterd` 用裸 `#[tokio::main]`，每个核一个 worker，RK3566 上各四个；空闲 worker 是 park 而不是 poll。用四个 worker/四个 parked task 对 `current_thread` 实测：

```text
multi:   5 threads   0.01 s CPU at start → 0.01 s after 20 s
current: 1 thread    0.00 s CPU at start → 0.00 s after 20 s
```

差别只是四个 parked 线程的栈，是内存不是热。换口味买不到这一页要的 CPU，却要付真代价：在 `current_thread` 上，async 路径里一次同步调用会阻塞整个运行时（含 IPC socket），而 `updaterd` 有好几处（`engine.rs` 读签名、写内嵌清单、内联扫一个单元目录；只有重的验证在 `spawn_blocking`）。

## 还需要一块板子

`mediad`、`tofd`、`padd` 改动前后的 CPU 要用 `dev-push.sh` 加 `top -H` 确认，相机那一项该是可见变化；目前只有 `mediad` 在 0.12.0 上空载的 6.1%（有相机）与 29.4%（720p 测试图案），是 raw 分支的“之后”而没有“之前”并排，`tofd` 与 `padd` 则完全没有。最后是空载十分钟的 SoC 温度，这才是整件事的目的：`videoflip` 那次事故把板子带到 97 °C 并降频到 408 MHz，所以空载余量决定一只鸭子一边走路一边看东西时走得好不好；`robotctl health` 现在把那个上限印在温度旁边，降频这一半不再需要 ssh 才能看见。

头传感器是这里留下的线头：板上 `ps -L` 显示 `tofd` 空载的约 5% 里 4.5% 是头部 IMU、0.5% 是深度，而那颗 IMU 在树里**没有任何消费者**。见[按需 ToF](./tof-on-demand.md)。