# robotd：50 Hz 控制回路

Microduck 的“大脑”由一组守护进程组成，但真正让机器人动起来的只有一个：`robotd`。它独占一条 Dynamixel 总线、一个 50 Hz 的循环，以及“谁可以写电机”的授权。读懂这个进程，其他部分才有参照系：`padd` 只是往它的 socket 里塞意图，`updaterd` 只会问它健不健康，`mediad` 把它的状态转发给手机。设计理由见 [robotd 控制回路设计](../../catalog/microduck/robotd-design.md)，进程外壳见 [robotd main.rs](../../catalog/microduck/robotd-main.md)。

## 一条总线，十六个设备

十五个 XL330 舵机和一块 `imu_to_dxl` 板共享一根 UART：`/dev/ttyS2`，1 Mbps，Dynamixel protocol v2。IMU 不是“另一套抽象”，它就是总线上的 `id 200`，在同一个 `sync_read` 里回答，因为硬件本来就这么接。id 列表把它排在第一位，于是它在舵机应答之前返回。

```text
                 robotd 控制线程
                        │ duck_control::bus::DynamixelIo
                        ▼
      /dev/ttyS2 · 1 Mbps · protocol v2
                        │
   ┌──────────┬─────────┴────────┬──────────────┐
 id 200     20–24              30–34          10–14
 imu_to_dxl 左腿 5 个      颈·头·嘴 5 个     右腿 5 个
```

读取用的是 fast sync read（指令 `0x8A`）：设备把数据块追加到广播 id 的**一个**状态包里，总线每 tick 只翻转一次，而不是十六次。代价是固件门槛——XL330 需要 v46 以上，`imu_to_dxl` 也要支持；否则不是“读得慢”，而是整次读取超时。所以它是参数 `bus.fast_sync_read`（默认开）而不是常量：关掉就退回普通 sync read，行为与从前完全一致。启动时还会校正 EEPROM：`return_delay_time=0` 每个设备省 500 µs，十六个设备就是每 tick 约 8 ms，占掉预算的四成。同一个检查还处理“换上的新舵机”：新 XL330 以 `id 1`、57 600 baud 应答，守护进程会先 ping 十五个期望 id，若恰好缺一个，就找到它、写入 id 与总线波特率、重开端口、跑同一套寄存器检查，再重启它。

## 谁拥有总线

`serialport` 会设 `TIOCEXCL`，第二个**非特权**打开会得到 `EBUSY`。但 `robotd.service` 以 root 运行（电机控制需要字符设备），root 不受这个标志约束。于是真正的互斥是两层：

- 守护进程运行期间，控制线程拥有端口；
- 守护进程和独立的 `robotd init` 共享 `<socket>.lock`（通常是 `/run/robotd.sock.lock`）。`init` 必须先拿到这把锁，并在整段斜坡期间持有；正在运行的守护进程会拒绝 `init`，正在动的 `init` 也会拒绝守护进程启动。

锁文件**永远不要删除**，关机时也不要。内核在文件关闭或进程退出（包括 `SIGKILL`）时释放建议锁，文件本身留在原处；删掉再建，可能让两个竞争者锁住同名但不同 inode 的文件。“文件存在”不等于“锁被持有”。

还有两个常见占用者。Armbian 默认在 UART2 上跑登录控制台，`serial-getty@ttyS2` 的 `agetty` 会让所有舵机对别人不可见；`scripts/setup-board.sh` 负责 mask 它，`fuser -v /dev/ttyS2` 则是回答“谁占着总线”的命令。旧 runtime 也驱动同一条总线，所以两者用 systemd 的 `Conflicts=` 保证一台机器只跑一个。

## 一个 tick 的四个动作

循环是独立的 tokio 任务、独立 runtime，IPC 工作不能排在它前面。每 20 ms：

```text
read()    一次 fast sync_read：IMU 板 + 15 舵机，寄存器 124–136
decide    观测 → 策略 → 目标 → 限幅
write()   一次 sync_write：目标位置
publish   atomics 总是更新；仅在有人订阅时组装 robot.state

每 1 s    slow_sensors()：寄存器 144–146，电压 + 每关节温度
```

`publish` 的两半是分开的：atomics（tick 数、achieved Hz、missed、fallen、moving）每 tick 都写，供 `robot.health` 和 `safeToRestart` 读取；完整状态帧只在 `receiver_count() > 0` 时组装，进入容量 256 的有界广播（约 5 s），慢订阅者拿到的是缺口而不是反压，抽帧也在服务端按订阅者做。

`MissedTickBehavior` 必须是 `Skip`。`Burst` 会把积压的 tick 连着放完，电机指令叠在一起；`Delay` 更隐蔽：它把下一次唤醒排成“现在 + 周期”，每次唤醒延迟都加进周期，循环会永久变慢。实测用 `Delay` 时目标 50 Hz 只跑到 43.1 Hz，而 `missed = 0`——不是算不过来，是每次都被推迟。真实总线读取要 3–8 ms，换成 `Delay` 会更接近 35 Hz，看起来却像硬件故障。

读失败时循环不停：`consecutive_errors` 加一，`sensors = None`，本 tick 照常走完。策略最多在最后一个好样本上滑行 `COAST_TICKS = 3` 个 tick（60 ms），因为 50 Hz 的观测本来就“旧一个 tick”，策略正是在这种数据龄上训练的；超过三拍就诚实地说“看不见”，保持不动。孤立的一次丢包一分钟只记一行，连续丢包每十次记一行——否则 50 Hz 的重复告警会把 journal 里真正有用的历史挤掉。

## 启动与保持

**`robotd` 从不因为自己启动而移动机器人。** 启动时它读当前位置，把它们采纳为 `hold`，不碰 torque。Dynamixel 在进程死亡期间保持最后的目标位置，所以更新重启不会让站立的机器人抽动一下。

`robot.enable` 推进一个显式的上电状态机：

```text
Limp ──enable（策略已加载 + 本 tick 有新样本）──▶
Homing（上 torque，2 s 斜坡）──▶ Ready ──▶ 策略驱动
```

两个条件各有理由：策略没加载就上电，等于让一台坏 release 把机器人立起来再干等；没有新样本就起斜坡，等于从一个没人读过的位置开始，正是斜坡要避免的那一窜。“机器人正躺着”**不是**条件——在地上按 Start 本来就是请它站起来。

`robot.init` 和 `robot.relax` 是同样两个转换的直接请求，但以“每 tick 取一次”的请求到达，而不是循环反复读取的标志：一次 `set_torque` 是每关节一次总线事务，做成电平就会每 tick 写十六次。后到的请求覆盖还没被读走的请求；`relax` 会清掉 `enabled`，否则下一 tick 又会把它立回去。两者都不对 BLE 开放：手机上一个会把机器人摔到地上的按钮不该存在。

## 安全层的唯一写口

`Safety` 持有唯一的 `RobotIo` 写句柄。策略、控制器、客户端都只能**提议**目标，没有任何一条路径能直接发指令——这是借用检查器保证的，不是约定。`apply` 做两件事，无条件：非有限值（`NaN`）直接拒绝而不是限幅；每 tick 把目标夹进执行器行程，无论策略要了什么。它夹的是**执行器**行程，不是解剖学限位，所以能挡住 `NaN`、荒唐的 action scale 和垃圾张量，但挡不住一个“机械上不明智”的角度。

命令上还有 deadman：意图停止到达，速度归零。**Stop 不是 limp**——失联让双足机器人站着不动，因为站立对双足是安全态；失去平衡是另一件事，这一层不回答。

跌倒判定每 tick 都算（躯干系里的投影重力，去抖 0.2 s），发布出去，但**不 gate 任何东西**。倒在地上的机器人照样可以 enable、init、被技能驱动，因为那正是人需要这些调用生效的时候。真正处理跌倒的是控制层：速率型预测器、limp 序列、再交还给站立策略，见[控制核心](./02-control-core.md)。

## 健康是什么

更新系统的自动回滚只有在 `robot.health` 有意义时才成立。它现在的意思是“**循环在赶上自己的截止时间**”，而不是“循环曾经跑过一拍”：一个只有六成速率的循环还活着、还能回答每个请求，但已经严重坏了。

判定由 IPC 侧读取控制循环发布的 atomics 计算，从不反向调用循环。这样即使循环卡死，它也能诚实地报告自己不健康，而不是把调用者挂住。检查顺序大致是：还没跑完第一拍（区分“正在启动”和“总线上没有机器人”）、策略加载失败（unhealthy）、覆盖策略回退（degraded）、连续总线错误、循环停摆、achieved Hz 低于下限、配置层被弃用（degraded）。

只有 **release 能被责怪的事情**才允许进入 `healthy`/`degraded`。电池电压、舵机与板卡温度、CPU 降频、总线计数都是**描述**，自动决策不得读取：一次在低电量下做的更新若因此回滚，替换版本会在同一块低电量电池上被同样判坏，机器人就再也更新不了。`safeToRestart` 则在“策略启用且机器人正在移动”时为 false——迈步中途重启电机控制，就是让它摔倒。

接下来读[控制核心](./02-control-core.md)，看 61 个浮点数怎样变成十五个目标；再读[运动学、里程计与 IMU](./03-kinematics.md)，看那些位姿和足端接触从哪来。