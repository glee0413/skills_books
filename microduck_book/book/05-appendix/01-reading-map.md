# 代码地图与阅读路线

这本书讲的代码是一个 Cargo workspace：26 个 crate，一个 crate 一个服务或一个工具，和 `docs/design/architecture.md` 里的服务拆分一一对应。翻开代码前先记住三件事：只有 `robotd` 能写电机目标；`duck-ipc-proto` 是所有人共用的契约，加一个依赖等于加给所有客户端；`duckctl`、`xtask`、`test-support` 永远不会上机器人。

## 三类 crate

| 层 | crate | 是什么 |
|---|---|---|
| 守护进程 | `robotd` | 50 Hz 控制回路、策略、安全层，拥有电机总线 |
| | `updater` | 更新引擎，二进制即 `updaterd` |
| | `configd` | Wi-Fi、机器人身份、配对 PIN、手柄绑定、重启 |
| | `btd` | BLE GATT 前门，转发 API 的一个子集 |
| | `padd` / `netpadd` | 手柄输入转意图，一个读 USB/蓝牙，一个走 UDP |
| | `mediad` | 摄像头、音频、WebRTC、控制台页面 |
| | `tof` | 头部 8×8 深度矩阵，只发布不读取 |
| | `nfc` | NFC 读卡器，刷标签即配对某一支手柄 |
| 库 | `duck-ipc-proto` | 线上契约：JSON-RPC 方法、意图、状态 |
| | `duck-control` | 控制核心：模型、总线、IMU、观测、策略、安全 |
| | `kinematics` / `odometry` | 正运动学与足端里程计 |
| | `robotd-params` | `robotd` 的启动参数、默认值与校验 |
| | `pad-map` / `pad-imu` | 手柄状态到意图的映射，以及手柄姿态滤波 |
| | `duck-ble` / `uyvy` | BLE 线格式与分块，摄像头像素格式 |
| | `duck-detect` / `sounds` / `pet-detect` | NPU 检测器、声音合成、摸头检测 |
| | `duck-ether` | 仿真的假电台 |
| 工具 | `robotctl` | 机器人上的 CLI，故障时也要能用 |
| | `duckctl` | 笔记本侧客户端，从不交叉编译、从不随版本发布 |
| | `xtask` | package · sign · promote 构建工具 |
| | `test-support` | 签名发布夹具，仅测试使用 |

`default-members` 里特意没有 `duckctl`。`cargo board --bins` 会把默认成员全部交叉编译到 aarch64，这对守护进程正确，对一个要在开发者本机运行、还必须避免为一块永远不会见到蓝牙的板子编蓝牙栈的客户端则完全错误。

## 路线一：用机器人

目标是不写 Rust 也能把机器人跑起来。先读 `docs/robot/cheatsheet.md` 记住 `robotctl` 的命名空间，再按需要挑：配手柄读 `pair-a-gamepad.md`，局域网手柄读 `udp-pad.md`，从笔记本遥控读 `duckctl.md`，在意隐私读 `telemetry.md`，卡住了读 `faq.md`。对应章节是「手柄、BLE、duckctl 与声音」和「感知与媒体」。

想在代码里改行为，只需要看 `robotctl`（板上的恢复路径工具，只依赖 `duck-ipc-proto`）和 `duckctl`。要自己写一个 UDP 发送端，读 `netpadd` 的线格式说明，再对照 `pad-map` 看手柄状态怎样变成意图。手上没有机器人时，`scripts/duck-sim` 用同一个 `mediad` 和同一套守护进程接 MuJoCo 身体。

## 路线二：改守护进程

顺序是固定的：先 `architecture.md` 的服务表，弄清谁拥有什么状态；再 `duck-ipc-proto`，因为所有调用都从这里经过；然后才是具体进程。改 `robotd` 从 `main.rs` 的启动顺序读起，再到 `control.rs` 的 tick，最后进 `duck-control` 看策略与安全层的边界；涉及腿就从 `kinematics`、`odometry` 往下钻，涉及摄像头就横跳到 `mediad` 和 `duck-detect`。

`docs/README.md` 有一条值得先记住的规则：一页文档只拥有一个机制，其它页只写一句话指过去。所以当行为与设计文档冲突时，负责该机制的那一页是对的写法，别的页才是 bug。日常验证是 `cargo test --workspace`（不需要硬件和网络），但 `configd` 的 NetworkManager 客户端和 `btd` 的 BlueZ 客户端只在 Linux 上有意义，必须用 `--target aarch64-unknown-linux-gnu` 跑 clippy 才能暴露问题；`scripts/board-test.sh` 则在 CI 里真的执行回滚、拒绝篡改、启动计数恢复这些断言。

## 路线三：做更新

这条路线的主线是 `updater-design.md`，代码只有 `updater/src/lib.rs` 一个引擎加一个薄薄的 `updaterd`。读的时候按流水线走：通道与清单 → minisign 验证 → 解包到 `releases/<version>/` → 原子切换 `current` → 重启单元 → 问 `robotd` 健康与否 → 失败自动回滚。周边三块不能漏：`xtask` 负责 package/sign/promote，`hooks/` 是唯一在每块板的每次更新里都跑的东西，`deploy/README.md` 说明镜像预置了什么。

判断“它到底保证了什么”，别看设计文档，看 `updater/tests/apply.rs`：坏签名、健康门禁失败、安装后钩子失败、切换与门禁之间掉电，每条故障都是注入真实引擎而不是打桩。想理解这套东西为什么长成这样，再读 `docs/project/install-path-gap.md`（四个安装路径 bug 怎样上板）与 `boot-recovery-net.md`（守护进程起不来时回黄金版本）。

## 章节落点

| 章节 | 主要代码与文档 |
|---|---|
| Microduck 是什么 | `README.md`、`Cargo.toml` |
| 七个 daemon 与一个机器人 | `docs/design/architecture.md` |
| IPC 契约 | `duck-ipc-proto/src/lib.rs` |
| robotd：50 Hz 控制回路 | `robotd/src/main.rs`、`control.rs` |
| 控制核心 | `duck-control/src/lib.rs` |
| 运动学、里程计与 IMU | `kinematics`、`odometry`、`pad-imu` |
| 感知与媒体 | `mediad`、`tof`、`duck-detect` |
| 手柄、BLE、duckctl 与声音 | `padd`、`btd`、`duck-ble`、`duckctl`、`sounds` |
| 更新系统 | `updater`、`xtask`、`hooks/` |
| 远程访问 | `remote-access-design.md`、`remote-webrtc.md` |
| 构建、测试与 CI | `CONTRIBUTING.md`、`xtask`、`scripts/` |
| 开发板、开发推送与仿真 | `scripts/dev-push.sh`、`simulation.md`、`duck-ether` |
| 设计决策与故障史 | `docs/project/` |

章节之外还有两层材料：`catalog/microduck/` 是按条目整理的中文精读，`source-snapshots/` 是同一 commit 的英文原文。两者的对应关系写在 `sources.json` 的 `id`、`sourcePath` 和 `sourceSha256` 里，引用代码前先在那里确认版本，别凭记忆。