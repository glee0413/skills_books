---
id: microduck/robotd-design
title: robotd 控制回路设计
description: 本页拆解 robotd 的总线所有权、50 Hz tick、观测与策略链、安全层的唯一写句柄、跌倒与拾取检测，以及启动与健康判定的边界。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/robotd-design.md
snapshotPath: source-snapshots/microduck/docs/design/robotd-design.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/robotd-design.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# robotd 控制回路设计

一个进程、一条总线、一个 50 Hz 回路。每周期一次事务读回十六个设备，算出十五个关节目标，再写回去；客户端、健康、遥测都挂在旁边，永远不能阻塞它。范围收窄到 alpha 变体、Radxa 与 v2 `imu_to_dxl` 板；轮式只是参数 `policy.mode = "roller"`，选策略集与调参预设，不是硬件变体。

## 一条总线，一个所有者

```text
/dev/ttyS2 · 1 Mbps · Dynamixel protocol v2
id 200 imu_to_dxl · 20–24 左腿 · 30–34 颈/头/嘴 · 10–14 右腿
```

IMU 是 `id 200`，与舵机在**同一个** `sync_read` 里读：v2 板挂在总线上，从舵机应答的同一寄存器块返回 SFLP 四元数。一块板、一条代码路径、没有 IMU 抽象。

**`TIOCEXCL` 单独不够。** `serialport` 会让第二个非特权 open 得到 `EBUSY`，但 `robotd.service` 以 root 运行（电机控制需要字符设备），root 不受该标志阻挡。所以守护进程与独立 `init` 共享一把 advisory lock：回路在守护进程存活期间持有；`robotd init` 必须先拿锁并在整个 ramp 期间持有——运行中的守护进程拒绝 `init`，正在动机器人的 `init` 也拒绝守护进程启动。另一个占用者是 `serial-getty@ttyS2`（Armbian 默认在 UART2 开登录控制台）；`scripts/setup-board.sh` 屏蔽它，`fuser -v /dev/ttyS2` 回答"谁占着总线"。锁文件**永不删除**：内核在进程退出（含 `SIGKILL`）时释放锁，删除重建会让竞争者锁住同名不同 inode。

## tick 与 fast sync read

50 Hz，独立 runtime 上的 `tokio` 任务，IPC 排不到它前面。每周期两次事务，另加每秒一次慢读：

```text
read()     一次 fast sync_read · IMU 板 + 15 舵机 · 寄存器 124–136
decide     observation → policy → targets → clamp
write()    一次 sync_write · 目标位置
publish    atomics 总是；有人订阅时才发状态帧
每 1 s     slow_sensors() · 寄存器 144–146 · 电压 + 温度
```

回路不做实时化；调度上值得注意的是 **`MissedTickBehavior::Skip`**，因为 `Burst` 会叠发电机命令，`Delay` 会让周期越跑越慢。

每次读都是 **fast sync read**（协议 2.0 指令 `0x8A`）：不再收十六个各带十字节头和各自 turnaround 的状态包，而是各设备把块追加到广播 id 的**一个**状态包，总线每周期只转身一次。代价是固件：**XL330 必须 v46 或更新**，`imu_to_dxl` 板也要实现。不实现的设备根本不答，于是**每次**读都超时——失败无歧义，所以 `bus.fast_sync_read` 默认开启；老固件只需有人设一次这个键。

启动时寄存器检查既断言也纠正：`return_delay_time=0`、`baud_rate=3`、`pwm_slope=255`、`shutdown=52`。第一条承重：出厂值 250 意味着每设备 500 µs 周转，十六个设备每 tick 约 8 ms，占预算 40%。`shutdown=52` 清掉输入电压位，让 2S 电池可用；膝盖的 `homing_offset` 是 −512。

**换上的舵机是被收养的**：`open_bus` 若发现恰好一个预期 ID 沉默，会找到默认 ID 1、写入缺失 ID 与总线波特率并重启它。

## 观测与策略

每个 alpha 策略都是 `obs[1,61] → actions[1,14]`，走路、站立、拾取、踢球、坐下全部验证过，所以只有一种布局：

```
[ gyro(3) | projected_gravity(3) | joint_pos(14) | joint_vel(14) | last_action(14) | command(13) ]
```

关节始终不含嘴，动作映射回十五个槽，索引 9 留零。命令块三个易错点：全零 body 是**名义编码**而非占位；头部目标**乘在命令里，不再加到策略输出上**，两处都做会把头弯两次；body 顺序是 `z, roll, pitch`，换成 `z, pitch, roll` 会让前倾变成侧倒。

优先级链保存在 `robotd/src/control.rs`：`roulade > kick > ground pick > sit/rise > stand-by-magnitude (or forced) > walk`，目标为 `home pose + action_scale × action`，头部与腿过一阶低通。两个原型细节：踢球窗口按站立调参运行（命令全零正好触发站立切换）；sitstand 的**起身**用站立增益，**坐下**不用。

## 安全：唯一写句柄

`safety` 持有唯一的 `RobotIo` 写句柄；策略和客户端都没有，所以它们**在结构上不可能**命令电机——这是借用检查器，不是约定。两条无条件规则：**非有限值直接拒绝**（`NaN` 不做 clamp）；**每 tick 把目标夹在执行器行程内**。后者能抓 `NaN`、离谱的 action scale 和垃圾张量，但挡不住把关节驱动到机械上不明智的位置。再加命令死区：意图停止到达，速度归零。**停不是松**——失联让机器人站住。

**跌倒结论只报告、不设门。** 每 tick 用躯干系投影重力算一次，去抖 0.2 s，然后发布；它**不 gate 任何东西**：倒地机器人照样能被 enable、init、驱动、发技能。躺在地上正是需要这些调用工作的时候。

`limp_fall`（默认开）是第二个检测器 `duck_control::fall`，看**变化率**：`ġ = −ω × g` 精确成立，直接来自同一 IMU 块的陀螺，外推约 0.3 s 就知道重力要去哪。它在已倾斜（约 26°）、仍在倾倒、预测越过阈值时触发，去抖三 tick；只在站立时武装（待在倾角门内 `limp_fall_arm_ms` 即 200 ms），触发后解除直到再次站起。收益在落地后的起身：站立策略拿到静止、姿态已知的机器人能干净站起。

`[pickup]`（默认开）是第四个事件：策略不知道脚已离地，被拎起来还在迈步。`duck_control::pickup` 读最后一秒的陀螺、重力、关节状态与上一条命令打分：超过 0.8 持续 100 ms 暂停，低于 0.35 持续 80 ms 且暂停满 300 ms 才交还。暂停目标 ramp 到**暂停姿态**（走路策略自己的平均站姿），而不是 home——home 在走路增益下只有持续平衡它的策略才站得住。

## 启动、健康与测试

**`robotd` 从不因为进程启动而动机器人。** 启动时读当前位置、采纳为目标、不碰 torque；Dynamixel 在进程死后保持最后目标，所以重启不改变姿态，机器人穿过更新而毫无察觉。`robot.enable` 推进 bring-up：

```
Limp ──enable（策略已加载 + 新鲜样本）──▶ Homing（torque on，2 s ramp）──▶ Ready ──▶ 策略驱动
```

两个门：已加载的策略、新鲜样本。**倒地不是门**——在地板上按 Start 正是有人请它站起来。`robot.init` 与 `robot.relax` 是同样两个转换，作为请求每 tick 取一次而非持续标志：一次 `set_torque` 是每关节一次总线事务，两者都不经 BLE。

健康由 IPC 侧根据回路发布的 atomics 计算，**从不询问回路**，所以卡死的回路会报告自己不健康。**只有发布能被指责的条件才能进入 healthy/degraded**：电池、温度、时钟只描述、不判定。

`FakeIo` 提供脚本化样本，所以 `cargo test` 不需要硬件、网络和 Docker；黄金观测向量则防住"错一个索引只会让机器人悄悄摔倒"这类失败。