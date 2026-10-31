# Microduck 是什么：硬件、目标与代码地图

Microduck 是 Pollen Robotics 做的一只小型双足机器人：大约 25 厘米高、800 克重，靠强化学习策略走路，也能装上轮子滚动、低头叼东西、摔倒后自己站起来，还会用属于自己的嗓音叫。这本书记录的不是“怎么训练一个策略”，而是一只这样的机器人怎样被组织成一套能长期维护的软件系统：谁拥有电机，谁负责更新，谁在控制回路挂掉时仍然能应答。读完这一章，你应该知道硬件上有什么、仓库边界在哪里，以及接下来该按什么顺序读。

## 一只 25 厘米、800 克的机器人

整只机器人的计算都在一块 Rockchip RK3566 上。它是一颗带 NPU 的 ARM SoC，跑 Linux，用 systemd 管理一组常驻服务。板子下面挂着一条 Dynamixel 串行总线，十五个舵机和一个 IMU 板共享它：左腿五个、脖子与头与嘴五个、右腿五个。这个顺序不是随手排的，`duck-ipc-proto` 里的 `JOINT_NAMES` 把它固定成协议的一部分，连每个关节的舵机 ID 也一起写死（左腿 20–24，头颈 30–34，右腿 10–14），因为支持人员最终要拿着 ID 去机器上找那颗没应答的舵机。

感知与交互的硬件同样分散：一个摄像头、麦克风和扬声器、头部一块 8×8 的 ToF 深度传感器（VL53L5/8CX），以及 Wi-Fi 和低功耗蓝牙两条无线电。板型之间还有差异：Zero 3W 没有面板上那十二颗状态灯，头部 IMU 由 `tofd` 提供；beta 板的面板灯由 GPIO 扩展器驱动，头部 IMU 挂在面板板上，由 `robotd` 读取。这些差异没有变成运行时开关，而是落到了“哪个 daemon 拥有哪个设备”的划分里。

策略本身是神经网络：输入 61 维观测，输出 14 个关节目标（第十五个舵机是嘴，不归策略管）。真机上由 `robotd` 通过 ONNX Runtime 加载 `.onnx` 文件执行；鸭子检测器则走 Rockchip 的 NPU 运行时。一次控制循环 50 Hz，从读总线、组观测、跑推理到写目标，全在这一个进程里完成。

## 仓库负责“跑”，microduck_rl 负责“训”

这是理解代码边界最重要的一条。本仓库是“鸭子的大脑”：它包含运行时、守护进程、IPC 契约、更新机制和部署脚本，但不包含训练代码。策略在隔壁的 [microduck_rl](https://github.com/pollen-robotics/microduck_rl) 里训练：MuJoCo 物理仿真、PPO、域随机化、sim2real 配方，最后导出成本仓库加载的 ONNX。

两边靠几条明确的契约连接。观测长度 61、动作长度 14、机器人型号名 `microduck` 都写在 `duck-ipc-proto` 里，而不是只写在控制库里，因为它们是“和策略发布者之间的约定”：策略仓库的清单要声明同样的数字，`updaterd` 在下载前拒绝不匹配的策略，`robotd` 在加载时再拒绝一次。官方策略集也不放在本仓库，而是发布在 Hugging Face 上（`pollen-robotics/microduck-policies`，当前最低版本 v8），这样重新训练一次步态不需要发一个 daemon 版本，修一个 daemon 缺陷也不用重发六兆字节没变过的权重。

还有一层历史需要知道：文档里的 `microduck_runtime` 是早期探索性的原型，会被重写；`docs/design/` 描述的是第一个正式发布版本的目标形态，不是原型现状。读书时看到“原型曾经有五个私有通道”这类句子，说的是它留下的教训，不是当前代码。

## 七个 daemon 与一个 CLI

运行时的形状可以先用一张表记住，细节在[下一章](../01-architecture/01-architecture.md)展开：

| 服务 | 拥有什么 | 在哪里应答 |
|---|---|---|
| `robotd` | 电机总线、50 Hz 回路、运动学、里程计、策略、安全 | `/run/robotd.sock` |
| `configd` | Wi-Fi、机器人身份与名字、配对 PIN、手柄绑定、重启 | `/run/configd.sock` |
| `updaterd` | 发布包的验证、安装、切换、健康门禁、回滚 | `/run/updaterd.sock` |
| `btd` | 不拥有状态，只做 BLE GATT 传输 | BLE GATT 服务 |
| `padd` / `netpadd` | 不拥有状态，读手柄并发送意图；`netpadd` 是局域网 UDP 版本 | `/run/padd/pad.sock` / UDP |
| `mediad` | 摄像头与音频管线、WebRTC、远程入口 | `:8080`、`:8443`、`/run/mediad/media.sock` |
| `tofd` | 头部 ToF，只发布深度帧 | `/run/tofd/tof.sock` |

`robotctl` 不在表里，它不是 daemon，而是必须能在一只坏掉的机器人上工作的命令行客户端。所有客户端——手机 App、手柄、你的脚本、`robotctl`——发的是同一套 JSON-RPC 调用，只是走的传输不同。

## 代码地图：一个 workspace，一个 crate 一件事

仓库是一个 Cargo workspace，26 个成员，版本 0.18.3，edition 2024。组织原则很直接：每个服务或工具一个 crate，和架构文档里的服务划分一一对应。初读时值得先认得的几个：

- `duck-ipc-proto`：唯一的协议定义，方法名、参数、结果、错误码、socket 路径、关节表都在这里。它只依赖 serde、serde_json 和 semver，因为恢复路径上的服务也要用它，不能顺带拖进 HTTP、压缩、加密或异步运行时。
- `duck-control`：控制核心，模型、观测、策略执行与安全层，唯一能写电机目标的地方。
- `kinematics`、`odometry`：关节角与末端位姿的映射，以及靠足端接触和 IMU 估计的位姿。
- `robotd-params`：两层配置的加载与合并，`/etc` 的基础层加 `/var/lib` 的用户层。
- `updater`：更新引擎，签名验证、解包、原子切换、健康门禁与回滚。
- `duck-detect`、`pet-detect`：NPU 上的鸭子检测器与宠物检测器；`duck-ble`、`pad-imu`、`uyvy` 一类则是把某一种格式或某一条链路单独拆出来的小 crate。
- `xtask`：打包、交叉编译、生成发布目录的构建工具。

工作区里还钉着几个版本：ONNX Runtime 最低 1.23、安装目标 1.28.0，RKNN 运行时 v2.3.2，GStreamer 插件 v3，策略集 v8，检测器 duck-v1。它们都只写一份，测试会断言那些被 `curl` 单独拉取的安装脚本和 `Cargo.toml` 保持一致——两份版本各自漂移，曾经让一块板子装上了 `ort` 会 panic 的运行时。

## 三条阅读路线

这本书按“先整体、再控制、后交付”组织，你可以按目的选一条：

1. **建立整体图**：本章之后读[七个 daemon 与一个机器人](../01-architecture/01-architecture.md)和 [IPC 契约](../01-architecture/02-ipc.md)，把进程边界和消息形状弄清楚。
2. **理解控制**：从 [robotd 的 50 Hz 回路](../02-control/01-robotd.md)开始，接着读控制核心、运动学与里程计、感知与媒体。这条线回答“一次走路是怎么发生的”。
3. **理解交付**：读更新系统、远程访问、构建与测试。这条线回答“新软件怎么安全地到达一只在别人家里的机器人”。

每一章旁边都有对应的“知识全库”精读页，例如 [系统架构原文](../../catalog/microduck/architecture.md)、[IPC 源码](../../catalog/microduck/ipc.md)、[Cargo workspace](../../catalog/microduck/cargo-workspace.md)。它们是按固定 commit 做的逐段对照，适合在读完一章后核对细节；书稿负责串起因果关系，精读页负责保留原文的措辞与边界条件。

## 版本与约定

全书对应上游仓库 `b2b0d213`，标签 `daemon-v0.18.3`，许可证 Apache-2.0。英文快照保存在 `source-snapshots/`，翻译和写作都以快照为准，不依赖同级的上游 checkout。术语按 `GLOSSARY.md` 统一：daemon 译为“守护进程”，intent 译为“意图”，release 译为“发布”，health gate 译为“健康门禁”；`robotd`、`updaterd` 这类服务名保留英文，因为它们在命令行、日志和代码里就是那个样子。

最后提醒一句：这是一套为“无法接调试器”的设备写的软件。日志、版本、健康检查之所以占了不少篇幅，不是文档啰嗦，而是因为这些是支持人员唯一能拿到的东西。读的时候不妨一直问：这个设计在机器人已经坏掉的情况下还成立吗？架构里的很多选择，答案都在这个问题上。