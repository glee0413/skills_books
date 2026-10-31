---
id: microduck/roadmap
title: 路线图
description: 以 M1–M9 记录 Microduck 已完成的能力、仍在进行的工作和判断顺序，并明确编号只是标识而不是排期。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/roadmap.md
snapshotPath: source-snapshots/microduck/docs/project/roadmap.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/roadmap.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 路线图

这份文档写于 2026-08-26（初稿 2026-08-05），只负责**顺序与取舍**；`architecture.md` 说建什么，`updater-design.md` 说怎么交付。原文特意声明它会变，而设计文档不应该变——两者混在一起是它想避免的失败。

## 当前位置：能走、能更新，但还缺三大块

`updater/` 的引擎、验证、存储、日志、钩子、预检、三种源、IPC 与 systemd 单元已完成；`duck-control/` 是库而不是守护进程；`duck-ipc-proto/` 是 API v14 的线缆契约，只依赖 serde 与 semver，免得恢复路径拖入引擎的依赖树；`robotd/` 是 50 Hz 回路，经安全层驱动 walk/stand/roll，并挂上运动学、里程计、注视 IK、声音、特雷门与合唱；`padd/`、`configd/`、`btd/`、`mediad/`、`tof/`、`xtask/` 与四个流水线都已在真机跑过。测试 **942 passing**，包含对真实 `robotd` 进程的健康门禁与策略/安全路径。

恢复网（`robot-boot-check.timer`、`robot-rescue`、`golden` 符号链接）已发布并启用，但**从未在板子上真正触发过**。进行中的是 `maploc`（#127）、NPU 鸭子检测器和合唱选举修复（#151）；缺的是手机 App、SDK、策略通道、自主大脑，以及从 LAN 之外访问机器人。

## 第一个路线图已经到达终点

M1 到 M4 是一条链，终点是“会走路、能无线更新、且不会把自己变砖”的机器人，`0.2.0` 之后的每个 release 都经这套机器到达板子，`0.9.x` 是能走、能滚、能看、能说的鸭子。原文后来承认把工作量估错了：`0.5` 之后几乎全是能力建设，而最大的那块仍未移植。

**M1 闭合回路**（done）：`robotd` 用原子量而非互斥锁保存状态，因为回路卡死时仍必须能回答“我不健康”；抽出 `duck-ipc-proto` 免得恢复路径链接引擎的 http/tar/crypto；健康门禁是真 socket 探测；首次安装走**普通引擎**，没有只存在于引导阶段的代码路径。验收是 `robotd/tests/updater_gate.rs` 对真实进程过真实 socket 提交，`robotd --unhealthy` 能回退 `current`。

**M2 开发通道**（done）：`--ref my-branch` 安装分支构建，`scripts/dev-push.sh` 经 ssh 安装笔记本构建且完全不跑 CI。两条性质让每次推送安全：dev 构建**不能变成 `latest`**（版本是 semver 预发布），也**不能装到客户机器人上**（`allow_dev_keys` 为假，且 key 文件名须以 `.dev.pub` 结尾）。

**M3 真正的 `robotd`**（done，两片）：不是重写而是把 `microduck_runtime` 的控制核心抽成 `duck-control`，对等性于是成为抽取的结果。第一片是真实的 50 Hz Dynamixel 回路保持姿态，这才让 `robot.health` 意味着“回路在满足截止时间”；第二片是 61 维观测、main-plus-standing 策略、意图表面和手柄客户端。安全权威也在这里落地：唯一的总线写句柄、关节夹紧、跌倒转软、意图 deadman。**先硬件后仿真**，而板子给出了测试给不出的 bug：`ort` 在低于下限的运行时上 **panic** 而非报错，杀死控制线程并让健康检查怪错了对象。

**M4 硬件启动**（closing）是测量里程碑：回路在非 RT 内核上保持 50.0 Hz（15022 tick 中 `missed=3`），总线与 `imu_to_dxl` 在 `/dev/ttyS2` 应答。日志保留靠**决定**解决——`/var/log` 是 zram，`Storage=persistent` 拿到的目录本身在内存里，能熬过干净 `reboot`，断电就丢；持久记录是 `/var/lib` 下逐条 `fsync` 的更新历史，因此“日志熬过断电”这条验收标准被撤销。仅剩 `journalctl --list-boots` 要在板子上跑。

## 进行中与待办

**M5 `mediad`、WebRTC、SDK**（in progress）已在硬件落地：相机经 VPU（`mpph264enc` → `webrtcsink`，constrained baseline）到 LAN 浏览器，`control` datachannel 说同样的 JSON-RPC，控制台由机器人自己托管。三件事让它保持打开：LAN 之外（OAuth device flow 的账号已完成，桥接是下一步，且 token 要收窄到 `openid profile read-repos`）；SDK（控制走 rendezvous 控制通道，即 HTTP 上的 JSON-RPC，视频是可选的 WebRTC 加分项，`spaces/shared/` 已有 `rendezvous.py`、`wire.py`、`control.py`）；隐私（**同意**是 `mediad` 会话层改动且无阻塞，**可见指示灯**需要软件可控 LED，这代硬件没有，应作为硬件问题去问）。

**M6 出货准备**按**交付周期**而非难度排序：配对 PIN（出厂默认 `000000` 且公开，必须由工厂流程生成、打印并记录，不能从已广播的身份派生）、标定、恢复网在板上演练、同意、App 的手机 spike。**M7 了解板子状态**是开放调查：支持包、非开发者可跑的硬件自检、间歇故障需要的历史，以及和 #52 IPC 监视器的重叠。**M8 策略通道**把策略从守护进程产物里拿出来：官方集合、“越过 pin”和社区库都已完成，缺的是按槽位按需重载、发布 bundle、`model_api` 两侧实现和训练闭环。**M9 自主大脑**是最大的未跟踪缺口：`autonomous.rs` 在守护进程里不存在，也没有设计文档拥有它；原文强调**形状比状态重要**——存在感、心情、节拍是一个大脑的输入，而不是它旁边的模式。

## 工作顺序与已成形的决定

编号是标识，顺序另说：先 M8（它解锁“训练、发布、安装、试、回滚”这个产生实际行为的环），再 M5 的传输调查，然后随出货临近按交付周期做 M6，M7 无日期，M9 有意放最后。

几个值得记住的决定：签名密钥托管已完成——三把加密发布密钥加一把 dev key 在 `~/.duck-keys`，只有 `release-1` 进 secrets，CI 在 `environment: release` 下签名，范围限定但不构成门禁；客户机下载源已决定**公开本仓库**，匿名 GitHub API 每小时 60 次对一只鸭子无感、对一屋二十只不是；策略是否离开守护进程产物“倾向于是”但未定，模型缺失应报 `degraded` 而非 unhealthy，好让门禁提交。明确**不做**的有 A/B 镜像更新、OS/内核 OTA、机群仪表盘、增量更新、分批发布、能力矩阵、每槽竞争模型、外设固件 OTA；匿名遥测已移出名单并完成。

安装路径上四次连续漏到板子的 bug，以及它教出的规则，见[安装路径故障](./install-path-gap.md)；BLE 更新的实测结论见 [BLE 更新](./update-over-ble.md)。