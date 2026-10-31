---
id: microduck/robotd-main
title: robotd main.rs
description: robotd 进程骨架：控制线程、原子发布的 RobotState、健康判定与 robot.* 的 IPC 服务。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: robotd/src/main.rs
snapshotPath: source-snapshots/microduck/robotd/src/main.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/robotd/src/main.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# robotd main.rs：控制回路、状态发布与健康

`robotd/src/main.rs` 是控制守护进程的入口，也是整本书里最长的一个文件。它的模块文档提出了一个设计前提：**健康是守护进程长成这样的原因**。更新器的自动回滚只有在 `robot.health` 有意义时才成立，而它曾经的含义只是“回路跑过一个 tick”，于是每次回滚都是在跟一个占位答案较劲；现在它表示“回路守住了自己的截止时间”。另一条约束同样重要：每个方法都必须能在机器人状态很糟时回答，所以 IPC 侧只读控制回路发布的原子量，从不调用回路本身——卡死的回路会报告自己不健康，而不是把调用方一起挂住。

## 进程骨架

`#[tokio::main] async fn main() -> ExitCode` 先恢复 `SIGPIPE` 的默认行为（Rust 忽略它，会让 `robotd ... | head` 变成 panic），解析 `Args`，再调用 `claim_socket` 独占 `/run/robotd.sock`。`Args` 上有几组开发开关：`--fake`（无物理的空机器人）、`--sim host:port`（MuJoCo 孪生，同一份守护进程、换一个身体）、`--no-policy`（只跑回路并保持姿态）、`--unhealthy` 与 `--busy`（在台架上演练回滚与推迟重启）。`Command::Init { duration }` 是唯一会主动移动到 home 姿态的路径，单独存在是为了让守护进程重启时不会让站立的机器人突然蹿一下。

## RobotState：全部用原子量发布

`RobotState` 是控制线程与 IPC 线程之间唯一的共享面。`started`、`ticks`、`missed`、`last_tick_us`、`achieved_hz`（存 `f64::to_bits`）、`consecutive_errors`、`battery_v`、`motor_max_c`、`cpu_throttle`、`imu_stale_run` 都是原子或 `ArcSwap`；`state_tx` 是 `robot.state` 的有界广播，`STATE_BUFFER = 256` 意味着落后五个世纪的订阅者会丢帧，而不是把背压推回回路。`policies: ArcSwap<PolicyNames>` 一次换整套而不是七个字段，否则读者可能同时看到 roller 的 `walk` 和 walking 的 `stand`，被描述成一台不存在的机器人。

健康判定 `health()` 是一条有序链：`policy_error` 直接不健康；槽位因覆盖文件加载失败而回退是 degraded（这是板子的属性，回滚修不了）；`consecutive_errors` 超限、`control loop stalled` 或实测频率低于 `min_achieved_hz` 都不健康；最后才轮到 `config_error`，免得它盖住上面更严重的判断。`loop_health()` 把 `achieved_hz` 的零值当作“还没有窗口关闭过”的哨兵，而不是零赫兹。`safe_to_restart()` 的规则很短：正在走且没摔倒就拒绝，因为迈步中途重启正是摔倒的方式。

## 控制线程

`spawn_control_thread` 建线程并运行 `control_loop<T: RobotIo>`。回路先构造 `Safety::new`、`adopt_startup_pose` 认领启动姿态、`build_controller` 载入策略，然后进入 `tokio::time::interval(period)`。定时器必须是 `MissedTickBehavior::Skip`：`Delay` 会把每次唤醒延迟累加进周期，实测 50 Hz 目标只跑出 43.1 Hz，却报告 `missed = 0`——看起来像硬件问题，其实是调度问题。

回路里的失败处理同样有分寸：`COAST_TICKS = 3` 允许策略带着上一次好样本继续滑行三个 tick，因为一次 Dynamixel 事务丢失是常态，让它立刻停策略会把“随机小抽动”变成用户能看见的现象。`LimpFall`（`Idle` / `Limp` / `Posing`）与 `Landing` 则负责摔倒：触发器是 `duck_control::fall::FallPredictor` 而不是 `fallen` 判定，因为等判定成立，机器人已经落地了。

## IPC 与关闭

`serve` 接受连接后为每个客户端 `tokio::spawn` 一个 `handle`；`handle` 在同一连接上同时读 NDJSON 请求、写 `robot.state` 帧、向 `btd` 推 `ChoraleAdvertise` 信标，三条流用嵌套 `select!` 复用。`dispatch` 处理请求/响应型调用，`apply_intent` 处理单向型：`RobotMove`、`RobotHead`、`RobotPose`、`RobotMouth` 写进 `Intents`，而 `RobotDo` 作为通知处理——客户端每 tick 重发技能名，正是“按钮还按着”的表示，逐条回复纯属开销。

关闭走 `shutdown()` 信号：先请回路停下并等它跑完当前 tick，避免半个数据包留在总线上；然后依次保存 `vetbook`、限时等 LED 任务、删除 socket。关机序列用 `SHUTDOWN_SIT`、`REST_RAMP`、`REST_HOLD` 三段时间，从座位线性过渡到 `duck_control::REST_POSITION` 再断扭矩，因为直接从策略座位断电会让机器人前塌。`MODEL_API = 2` 声明这个构建实现的模型输入输出契约版本。

控制器的具体决策在 [robotd control.rs](robotd-control.md) 里；`robot.health` 的结果是更新器健康门禁的输入，见 [更新引擎](updater.md)。