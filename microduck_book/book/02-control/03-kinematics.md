# 运动学、里程计与头部 IMU

控制回路每 tick 都拿到一串关节角和一块 IMU 四元数。要把它们变成“相机在哪、脚踩在哪、机器人走到哪”，需要三样东西：一份从训练场景里拿来的运动学模型、一个把足端接触钉在世界里的里程计，以及头部那颗独立 IMU。它们都不是守护进程，而是 `robotd` 驱动的库——没有自己的 tokio、socket 或 systemd。精读见 [运动学](../../catalog/microduck/kinematics.md) 与 [里程计](../../catalog/microduck/odometry.md)。

## 把 MJCF 编译成一次折叠

`kinematics` 直接解析训练用的 MJCF（`assets/alpha/robot_walk.xml`，从 `mjlab_microduck` 场景裁出来），但不在每次查询时走树。加载时做一次“编译”：名字解析成索引，每个 site 预生成一条从根到自己的扁平链：

```rust
struct Link {
    rest: Pose,                       // 进入该 body 坐标系的固定变换
    joint: Option<(usize, [f64; 3])>, // 铰链在角度切片里的下标 + 轴
}
```

查询 `site_pose(site, &angles)` 就是沿这条链折叠：乘固定变换，遇到铰链就乘一个绕轴旋转。没有 hash、没有分配，也不会算与该 site 无关的 body。原型用 `HashMap<String, f64>` 传关节角、每次查询重算整棵树并新分配一个 `Vec`；bench 节奏下没问题，50 Hz 每 tick 问两只脚就浪费了。角度切片按模型关节顺序索引，`joint_index` 只在 setup 时解析一次。模型用 `LazyLock` 解析一次，嵌入资源由 MuJoCo 对拍测试兜底，所以运行时不会失败。正确性钉在两处：对 64 个随机姿态逐 site 与 MuJoCo 的 `mj_kinematics` 比较；以及头部符号约定的 pin 测试。

同一份编译结果还给出整副骨架：`body_poses` 按树序一趟算出每个 body 在躯干系的位姿，父节点总在子节点之前；`body_parents` 给出骨架的边。它还给出每个关节的 MJCF 行程 `joint_range`（IK 必须夹住它，舵机机械上就只到那里），以及训练场景里躯干的站立高度 `trunk_height_m`——地板滤波器的偏移来自资产，而不是另一个常量。

## 头部链：相机、ToF 与头部 IMU 的位姿

`head::HeadFk` 把四个头关节（`neck_pitch`、`head_pitch`、`head_yaw`、`head_roll`）解析成索引，然后提供三种查询：`camera_in_trunk_cv2` 给视觉栈的 cv2 轴（+x 右、+y 下、+z 前），`tof_in_trunk` 给传感器自己的轴（+x 前、+y 左、+z 上），`head_imu_in_trunk` 给 HAT 上 BMI088 的安装姿态。两个常量四元数是“翻译层”，从原型带过来并在真机图像上校过；pin 测试防止一次 MJCF 更新让机器人点头点反。ToF 优先用 MJCF 自己的 `tof` site，没有才退回相机位置——两者只差几厘米，但“几厘米”正是重投影误差的来源。

链上还有一个真实的耦合：`head_pitch` 在 `head_yaw` **上游**，所以俯仰会倾斜偏航所扫过的平面；偏航接近 ±90° 时，俯仰轴与相机前向对齐，单轴更新会卡住。因此 `look_at` 解的是 2×2 系统：对真实 FK 做阻尼高斯-牛顿，雅可比用有限差分，FK 约 50 ns，整个解算几微秒。每步都把关节夹进 MJCF 行程，返回值里的 `clamped` 表示“这已经是它能看向的最近方向”，而不是锁定。

## hand 模块不是一条手链

`CONTRIBUTING.md` 把 `kinematics` 描述成“头部与手部链”，但在这个 commit 里，`kinematics::hand` 并不是机械臂的正运动学，而是 **ToF 特雷门琴的“手”检测器**：它在 8×8 深度帧里找最近的可演奏回波，判断哪些状态字节可信，用低分位数抵抗飞点，并用 250 ms 的 hold 桥接闪烁。放在 `kinematics` 是因为它和 `tof` 的网格常量同处一个 crate，不是因为它是一条运动链。

所以本章按实际代码讲：真正的链是头、ToF 和腿；`hand` 是感知启发式。若后续版本真的加入手部链，这一节应改名重写。

## 里程计：把一只脚钉在地上

`odometry` 的想法只有一句：任何时刻，某只脚的一个角是机器人与地面的接触点。把这个点锚在世界里（平地上 z = 0，x/y 取它成为锚点时的值），躯干朝向由 IMU 给出，躯干的世界位置就由正运动学反推出来。当另一只脚的某个角落到锚点以下——一步落地——锚点移过去，并且**保留该角当前的世界 x/y**，所以估计不会跳。

```text
anchor_xy 固定 ──► contact_in_trunk = FK(脚, 锚点局部坐标)
                ──► contact_world = R_imu · contact_in_trunk
                ──► trunk = anchor_xy − contact_world.xy
                    trunk.z = −contact_world.z
```

候选点是脚底网格上的采样，`ALPHA16` 是覆盖整只鞋底的 4×4 网格。切换要满足两个条件：角落低于 `−0.010 m`，并连续保持 2 个 tick（40 ms）——一次 FK 抖动不能偷走锚点，一次真实的落地必须能。`ALPHA16` 在 MuJoCo 双胞胎上走 3.2 m 漂移 9 mm，旧的 v1.5 包围盒漂 17 mm、平底四角漂 16 mm，而且站高更准，代价只是多约半微秒。

朝向是 IMU 积分出来的偏航，没有磁力计，所以世界系就是“开机时机器人看向的方向”，没有任何东西修正漂移。这是**相对运动**，每个消费者都必须这样对待它。它每 tick 只多算两次链（原型每个角重走整条腿，9 次），不增加总线流量，所以直接跑在 50 Hz 循环里，而不是原型单独的 100 Hz。

## 头部 IMU：板子不同，读者不同

头部 IMU 不是“一个传感器”，而是两块板上的两颗芯片，读者也不同：

| 板子 | 芯片 | 谁读 | 为什么 |
|---|---|---|---|
| `beta` | LSM6DSV16X | `robotd` | ToF 在 SPI，IMU 有独立 I²C，芯片自己做 SFLP 融合 |
| `zero3` | BMI088 | `tofd` | 与 ToF 共用 HAT 的 I²C 总线 |

`beta` 上，芯片以 60 Hz 把陀螺、加速度和 game rotation 四元数批量塞进 FIFO，读线程每秒只醒 15 次，一次 burst 读走约四个 7 字节记录——两次事务换四个样本。相比 BMI088 每样本两次 I²C 事务加每秒 100 次唤醒（约占 4% 一个核），这就是它能默认开着的原因。帧走 `head_imu.stream` 的独立广播（缓冲 128，约 2 s），落后就丢帧、不反压；`seq` 里的缺口就是答案。

它不经过控制回路，所以不在 `robot.state` 的 `imu` 字段里；它的位姿由 `HeadFk::head_imu_in_trunk` 给出，出现在 `robot.state.frames.head_imu` 和 `robot.model` 的零位几何里。消费方拿到的是“芯片自身轴下的样本 + 它在躯干系里的安装姿态”，拼接由客户端完成。

## pad-map：手柄怎样变成意图

`pad-map` 是纯函数库：一帧手柄状态进，意图出。它被抽出来，是因为 `padd`（蓝牙）和 `netpadd`（UDP）必须用**同一份**映射，而不是各抄一份然后漂移。它没有 socket、没有自己的时钟、不背着你读配置。

映射是模态的，因为两个摇杆表达不了九个自由度：D-pad 左=行走，上=只动头，右=边走边看，下=身体+头。每个模式对 `drive`、`head`、`head_drive`、`body_pose` 分别选逻辑轴（`left_x`、`left_y`、`right_x`、`right_y`、`none`），每个绑定有 `source`、`invert` 和非负 `gain`；低于 `deadzone` 的值归零但**不重新缩放剩余行程**，然后反相、乘增益、夹到 ±1，再按物理上限缩放。上限在 `[pad_drive]`、`[pad_roller]`、`[pad_head]`、`[pad_body]` 里，是“请求的命令”，不是执行器限位，也不保证策略能到。

`[pad_imu_head_control]` 打开且手柄有 IMU 时，`head_drive` 模式用**手柄的倾角**驱动头部，摇杆保留完整的行走映射。姿态来自 `pad-imu` 的互补滤波：陀螺积分，加速度计只在读数接近 1 g 时把结果拉回重力——手在晃的时候加速度计测的是手，不是重力。符号是在真机上校出来的：手柄抬头是正 `head_pitch`，向左偏航是正 `head_yaw`，向右滚是负 `head_roll`。

`pad-map` 在 `robotd` 之外，所以它的输出不是关节目标，而是 `robot.move` / `robot.head` 意图，经 socket 进入 intent 槽。它是普通客户端，没有特权；手柄掉了，deadman 自己会让机器人停下，而不是由 `padd` 发一个零命令，把“断线”伪装成“决定停”。

## 它们怎样汇入 robotd

```text
        MJCF ──► kinematics::Model（编译一次）
                    │                    │
        足端 site ──┘                    └── HeadFk ──► frames / robot.model
             │
 关节角 + IMU 四元数 ──► Odometry ──► robot.state.odom
             │
 同一份 fresh 样本 ──► Safety / Observation ──► 策略 ──► targets

 头部 IMU（beta）──► head_imu.stream        （旁路，不进回路）
 手柄 ──► pad-map ──► padd / netpadd ──► 意图 ──► robotd intent 槽
```

两条纪律值得记住。第一，里程计只在**新鲜**样本上更新：滑行 tick 重放旧样本等于告诉估计器“机器人停住了”，而它没有；IMU 还没收敛时也不喂，否则世界原点会被种在一个从未到过的位置。第二，所有几何只有一份来源：`robot.state` 里的相机/ToF/头部 IMU 位姿、`robot.model` 的静态几何、里程计的腿链，全部来自同一个 `kinematics` 模型。客户端**问**机器人，而不是自己抄一份常量——抄的那份迟早会漂移。

回到 [robotd](./01-robotd.md) 看这些数字怎样进入 50 Hz 的 tick，或去 [控制核心](./02-control-core.md) 看它们怎样变成策略输入。