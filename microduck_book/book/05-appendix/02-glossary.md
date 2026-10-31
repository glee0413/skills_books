# 术语表

这里的词按全书出现频率排，中文写法与 `GLOSSARY.md` 一致。出处列是上游路径，对应 `sources.json` 里的 `sourcePath`；同路径的英文原文都在 `source-snapshots/microduck/` 下，需要原话时直接翻快照，不要凭印象转述。想找中文精读，按条目 id（例如 `microduck/architecture`）查 `catalog/microduck/` 下的同名页面，id 与路径的对应关系以 `sources.json` 为准。

## 服务与更新

| 术语 | 含义 | 出处 |
|---|---|---|
| robotd | 控制守护进程，拥有电机总线、50 Hz 回路和安全层 | `docs/design/robotd-design.md` |
| updaterd | 更新守护进程：验证、切换、健康门禁、回滚 | `docs/design/updater-design.md` |
| release | 一个完整的发布目录 `releases/<version>/`，整体替换而不是打补丁 | `docs/design/updater-design.md` |
| current | 指向当前 release 的符号链接，systemd 只读它 | 同上 §7.1 |
| golden | 有长期保证的黄金版本，救援脚本只认这个链接 | `docs/design/boot-recovery-net.md` |
| 健康门禁（health gate） | 切换后问 `robotd` 是否健康，答否则自动回滚 | `docs/design/updater-design.md` §8 |
| 启动计数（boot counter） | 记录“更新后是否真的起来了”，跨过一次重启才算成功 | 同上 §8 |
| 救援（rescue） | `robot-rescue` 把 `current` 切到 golden 并重启 | `docs/design/boot-recovery-net.md` |
| 通道（channel） | 一组独立版本化的东西：`daemon`，以及每个模型各一条 | `docs/design/updater-design.md` §5.1 |
| 组件（component） | 一次可更新的最小单元，守护进程与每个模型分开 | 同上 §5.5 |
| 安装后钩子（post-install hook） | 更新过程中唯一在每块板、每次更新都跑的脚本 | 同上 §9 |
| 预检（preflight） | 切换前的只读检查，失败不留任何副作用 | 同上 §7.2 |
| 两层配置 | `/etc/robot/robotd.toml` 是镜像基线，`/var/lib/robot/robotd.toml` 只存这台机器改过的键，按键合并 | `docs/design/architecture.md` §1 |
| 生命周期记录（vetbook） | 这台机器人自己的履历，由 `robotd` 持有，更新和回滚都不动它 | 同上 |

## 协议与边界

| 术语 | 含义 | 出处 |
|---|---|---|
| IPC | 守护进程之间的 unix socket 通信 | `duck-ipc-proto/src/lib.rs` |
| JSON-RPC / NDJSON | 请求、响应、通知三种报文；一行一个 JSON 对象 | 同上 |
| intent | 客户端发给 `robotd` 的高层动作请求，例如“走这么快” | `docs/design/robotd-design.md` |
| observation | 策略的输入：关节、IMU、上一条命令等 | 同上 |
| API 版本 | `duck-ipc-proto` 的协议版本，客户端据此判断兼容 | `duck-ipc-proto/src/lib.rs` |
| 意图客户端 | 只说意图、从不碰电机的进程：`padd`、`netpadd`、手机 | `docs/design/architecture.md` §1 |
| 前门（front door） | 只转发 API 子集的传输层：`btd`、`mediad` | 同上 |

## 控制与感知

| 术语 | 含义 | 出处 |
|---|---|---|
| 50 Hz 回路 | `robotd` 的 tick，读总线、算观测、跑策略、下发目标 | `robotd/src/control.rs` |
| 安全层（safety） | 唯一能写电机目标的层，意图在这里被判可执行或拒绝 | `duck-control/src/lib.rs` |
| 策略（policy） | 这里的策略指 ONNX 步态网络，不是“方针” | `docs/recurrent-policies.md` |
| 循环策略（recurrent policy） | 带隐状态的策略，观测必须带上一步的状态 | 同上 |
| 运动学（kinematics） | 关节角与末端位姿之间的映射，模型用 MJCF 描述 | `kinematics/src/lib.rs` |
| 里程计（odometry） | 由足端接触和 IMU 估计机器人走过哪里 | `odometry/src/lib.rs` |
| 身体协议（body protocol） | 仿真里守护进程与 MuJoCo 身体之间的接口 | `docs/design/simulation.md` §3 |
| 假电台（fake radio） | `duck-ether`：让几只仿真鸭互相“听见”，还能故意把链路做坏 | 同上 §4–5 |
| UYVY | 摄像头像素格式；采样与旋转统一在 `uyvy`，避免各画各的 | `uyvy/src/lib.rs` |
| NPU / RKNN | RK3566 上的推理单元，以及 Rockchip 的运行时 | `docs/project/npu-bringup.md` |
| sim2real | 在仿真里训练、在真机上部署 | `README.md` |

## 工程与运维

| 术语 | 含义 | 出处 |
|---|---|---|
| workspace / default-members | 26 个成员；`duckctl` 刻意不在默认成员里 | `Cargo.toml` |
| 交叉编译 | aarch64 目标；`cargo zigbuild`，或 `--docker` 在板的 userland 里构建 | `CONTRIBUTING.md` |
| 开发推送（dev push） | `scripts/dev-push.sh`：把本机构建当成一次受门禁的更新装到板上 | `docs/robot/dev-push.md` |
| board-test | 在 Debian 13 上执行 60 条断言的板级测试，覆盖回滚与拒签 | `CONTRIBUTING.md` |
| 预置（provisioning） | 把镜像配置成一块具体的机器人：配置、信任锚、日志 | `deploy/README.md` |

## 怎么用这张表

读设计文档时先看“服务与更新”，那些词决定你读的是哪条路径；读代码时看“协议与边界”，它解释为什么一个改动要同时动两个 crate；“控制与感知”里的词最容易混淆，尤其是 intent 与 observation 的方向，别写反。译名与 `GLOSSARY.md` 冲突时以那份文件为准，这里只是补充了出处。