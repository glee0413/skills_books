---
id: microduck/padd
title: 手柄守护进程
description: padd 把一个游戏手柄翻译成普通意图客户端：gilrs 事件、模式选择、掉线自救，以及只读的原始输入 tap。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: padd/src/main.rs
snapshotPath: source-snapshots/microduck/padd/src/main.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/padd/src/main.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 手柄守护进程：把手柄变成普通的意图客户端

`padd/src/main.rs` 的全部设计可以压成一句话：它对手柄没有任何特权。它读手柄，把摇杆和按键变成意图，然后像其他客户端一样通过 `robotd` 的 socket 发出去。之所以是独立进程而不是 `robotd` 里的线程，理由写在模块文档里——意图 API 是 App、SDK 和远程客户端将来都要走的路，让它每天被在机器人上干活的人踩一遍，它就不会像只有手机 App 用的接口那样悄悄烂掉。代价是一次 socket 跳，几十微秒，对 20 ms 的 tick 无关紧要。

## 手柄上的语义

映射按“手柄每个部分只干一件事”排布：面键和肩键跑技能，D-pad 选摇杆的含义，中间两个小键是长按——任何会断扭矩或关机的动作都不该被拇指擦一下触发。六个一次性技能按钮来自 `robotd.toml` 的 `[pad]`，所以学会了新技能的机器人可以把它绑到键上而不用发版；只有这六个，`Start`、D-pad 和长按 `Select` 都不是 `robot.do` 调用，其中关机那个绑定是最不该被配置改动弄丢的。

D-pad 是**选择**模式而不是切换模式，所以按下哪个方向就落在哪个模式，与机器人之前在哪无关。`head` 和 `body + head` 模式都会把速度清零——因为你在摆头而机器人继续往前走，是个糟糕的意外；离开模式时把它动过的东西放回去：躯干回标称，头部回中。平滑放在 `robotd`（`[control] cmd_alpha` / `head_alpha`）而不是这里，所以每个客户端拿到的手感一致。

这个进程仍然不知道技能“是什么”：它只读哪个键按下、查旁边的名字、把名字发出去；`robotd` 决定机器人有没有这个东西，没有就把现有的列表回给它。

## gilrs 那一层

`GILRS: [(Button, Buttons); 13]` 是线上位与 gilrs 名字的对照表，注释专门提醒 gilrs 把**肩键**叫 `LeftTrigger`/`RightTrigger`、把模拟扳机叫 `LeftTrigger2`/`RightTrigger2`，弄反了就是把技能绑到一个没人按的控件上。`bit()` 做反查，未知键返回 `Buttons::NONE`。

主循环每 tick 排空事件队列以捕获**边沿**：按住的 D-pad 只能选一次，不能每秒选五十次；`pressed` 与 `released` 都是位集，因为按下和松开落在同一 tick 内时状态两边都不变。驱动手柄是“第一个”，而且只允许它的事件生效——插着两个手柄时，另一个的 `Start` 不该去操纵一台摇杆属于别人的机器人。排空之后再按 id 重新取一次手柄，因为刚出队的 `Disconnected` 可能已经把它拿走了。

## 主循环与 CLI

`Args` 里有 `--socket`（默认 `/run/robotd.sock`）、`--config`（与其它守护进程同一个文件）、`--should_run`（给 systemd 的 `ExecCondition=` 用：`[netpad] enabled` 时返回 1，让 `netpadd` 接管）、`--hz`（1–1000，越界直接拒绝而不是夹紧，因为 0 会撞上 `Duration::from_secs_f64` 的无穷大 panic）、`--deadzone`、`--max_head`、`--tap_socket`。

每秒（`BINDINGS_POLL`）重读一次配置文件并再问一次 `robot.mode`：改绑定、用 `robot.setMode` 切成 roller，都在一秒内生效，不必重启。roller 机器人会换成原型的滚轮预设——前后不对称的 0.6 / 0.5、不横移、±0.3 rad/s 转向——B 触发地面拾取槽里的蹲伏。

发送分两类：`Out::Notify` 是连续意图，没有 id 也没有回复；`Out::Request` 等回答，因为“被拒绝，原因是……”是真实结果。`Continuous::next` 会把与上一帧相同且不要求运动的帧压到心跳频率，所以稳态不重复发包。没有手柄时**什么都不发**（`IDLE_POLL = 500ms` 一轮），让 `robotd` 的 deadman 自己停下——伪造一个零命令会把“手柄掉了”伪装成“有人决定停下”。真的在驱动时掉线是另一回事：`PadLoss` 先让机器人 `Inquire` 一声，一秒后坐下，再失败就放弃，手柄回来则 `Greet`。

## 只读的 raw tap

`tap::Tap` 提供一个只读 socket，只讲 `pad.input`，不因此获得任何特权。它存在的理由很具体：摇杆是**轮询**的，所以最后一个已知值会被一直发送——只要不是回中就一直全速发——无论手柄还在不在说话，于是下游每个界面都显示一台有活人驾驶的机器人。低一层的事件流里有证据，所以它原样转出而不做摘要；`robotctl monitor` 画它。配对不在这里：绑定设备要 root 和 BlueZ，放在 `configd` 里，与 wifi 相邻。

它发出去的就是 [BLE 守护进程](btd.md) 与 [duckctl 客户端](duckctl.md) 也在说的那套 JSON-RPC；机器人对手柄缺失的回应是 [声音](sounds.md) 标签。