---
id: microduck/simulation
title: 模拟机器人
description: scripts/duck-sim 的用法：up 与 boot 的差别、多鸭与容器、相机、远程注册和实时性约束。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/simulation.md
snapshotPath: source-snapshots/microduck/docs/robot/simulation.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/simulation.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# 模拟机器人

MuJoCo 里的鸭子，由真实 daemon 驱动。开发和对着桌上的机器人完全一样：同一个 `robotd`、同一批策略、同一个 50 Hz 回路、同一个 `robotctl`、同一个控制台，只有身体不同。为什么这样造、孪生覆盖到哪里，见[仿真设计](sim-design.md)。

## 一条命令得到一只鸭

```sh
scripts/duck-sim
scripts/duck-sim status
scripts/duck-sim drive
scripts/duck-sim monitor
scripts/duck-sim log
scripts/duck-sim down
```

不带参数时脚本从当前分支构建 daemon，写一份指向本仓库策略的 params，在 `~/.cache/duck-sim` 下启动 `duck-body`、`tofd --sim` 与 `robotd --sim`，并启用站立策略。`drive` 前进 8 秒（参数 `vx vyaw`，默认 `0.15 0`），`monitor` 是 `robotctl monitor`。`ctl` 就是把 `robotctl` 指向这只鸭的 socket——与真机唯一的不同是 socket 在状态目录而非 `/run`。自己的工具可直连 `~/.cache/duck-sim/duck-a.sock`、`duck-a-tof.sock` 与 TCP 7801；`duck.sock` 是指向当前 `ctl` 目标的链接。

## up 与 boot 的差别

| | `scripts/duck-sim` | `scripts/duck-sim boot N` |
|---|---|---|
| daemon 以什么运行 | 普通进程、你的用户、各自 pidfile | 每只鸭一个 `systemd-nspawn` 容器里的 systemd 服务，用真实 unit |
| 需要 | 仓库与 `microduck_rl` | `sudo`、一次性 Debian rootfs |
| 身份 | 笔记本的；多鸭共一个进程树 | 每鸭独立 machine-id、声音与 socket，之间有 `duck-ether` |
| 覆盖 | 控制回路、策略、IPC、`robotctl`、控制台 | 再加 `User=`/组/`RuntimeDirectory=`/加固、updater 的 apply、健康门禁、回滚、重启顺序、`journalctl` |

经验法则：改控制回路、策略、IPC 或客户端用 `up`；碰 systemd、updater、provisioning，或要让多只鸭互相说话用 `boot`。`up` 看不到“unit 的用户不存在所以服务起不来”这类 bug，而它已经抓到过两次。

## 多鸭、房间与相机

```sh
scripts/duck-sim boot 4
scripts/duck-sim shell duck-c
duck-a # journalctl -u robotd -f
DUCK_SIM_SCENE=apartment DUCK_SIM_CAMERAS=a scripts/duck-sim boot 2
```

`boot` 给每只鸭一个容器，共用一个 Debian 13 rootfs（首次约三分钟，建在状态目录）加每鸭 overlay；鸭子叫 `duck-a`、`duck-b`……各有 machine-id 与声音，因为它的话音由序列号生成。多于一只时脚本还会起 `duck-ether`，一只**故意很坏**的假电台，在容器间传合唱的 BLE 信标：完美链路会掩盖真链路的 bug。每只鸭都是 systemd 单元，所以 `down` 是 `systemctl stop`，从不是某个组合键。

默认世界是裸地板，`apartment` 是 7×6 m 的六房间，门洞故意偏心，好在 45° 前视里认出位姿；带斜杠的值是自定义场景路径。相机按鸭开启（`a`、`a,c`、`all`）：渲染一帧约 12 ms，而四只鸭的物理只要 0.3 ms，一台相机就是三分之一核。带相机的鸭各有一个 `mediad`，控制台按序号在 `http://127.0.0.1:8080` 起。

## 从任意网络访问

```bash
DUCK_SIM_CAMERAS=a scripts/duck-sim
scripts/duck-sim ctl account login
```

模拟鸭用真实账号登录 Hugging Face，出现在该账号的机器人列表里，控制台、App 或 Space 可经 WebRTC 从外网到达。打开 `hf.co/oauth/device` 输入它打印的码，几秒内就列出；`ctl account status` 显示归属，`ctl system info` 打印序列号与 `body MuJoCo`。列表里带 `simulated` 标记，名字由序列号派生（如 `duck-eb55`），不会读成架子上那只。两条规则来自 rendezvous 按 token 索引：**一个账号同时只列一只鸭**，第二只想被列出就用第二个账号；消费它的 Space 需要自己的 token。

## 旋钮与实时性

全部可选环境变量：`DUCK_SIM_RL`（`duck-body`、场景与 ONNX Runtime 的位置）、`DUCK_SIM_STATE`（socket、日志、rootfs，路径故意短，因为 unix socket 上限约 108 字节）、`DUCK_SIM_DUCKS`、`DUCK_SIM_SCENE`、`DUCK_SIM_CAMERAS`、`DUCK_SIM_DUCK`、`DUCK_SIM_KEYFRAME`（默认 `SIT`，站立策略从折叠姿态起身）、`DUCK_SIM_VIEWER`、`DUCK_SIM_PORT`（7801 起，每鸭 +1）、`DUCK_SIM_FRAME_PORT`（7901 起）。

**实时性很重要**：daemon 的回路按墙上时钟，低于 1.0× 时策略驱动的机器人比它以为的走得少，于是站不住。`scripts/duck-sim realtime` 报倍率。鸭子太多或相机太多不会变慢，而是在 45 Hz 门禁上变 *unhealthy*，容器形态下 updater 还会开始回滚；依次减少鸭子、减少相机、`DUCK_SIM_VIEWER=0` 无头运行。鸭子不能热加入：MuJoCo 编译模型，改数量就重启模拟器；`RemoteIo` 在下一 tick 重连，身体短暂消失的鸭报不健康而不是死掉。

**`--sim` 不是 `--fake`**：`robotd --fake` 是没有物理的空机器人，位置完美回显、什么都不会倒，用于单测；`--sim` 是孪生，两个标志互斥。脚本还会给每只鸭设 `DUCK_IDENTITY`，否则同机多鸭共享硬件序列号，声音和合唱身份会撞。

## 手工起两半

```sh
duck-body --ducks 1 --port 7801 --keyframe SIT
target/debug/tofd --sim 127.0.0.1:7801 --socket /tmp/d/duck-a-tof.sock
target/debug/configd --socket /tmp/d/duck-a-config.sock --state-dir /tmp/d/duck-a \
    --simulated sim-duck-a --fake-net --fake-pads
target/debug/mediad --sim-camera 127.0.0.1:7901 --config /tmp/d/mediad.toml \
    --robot-socket /tmp/d/duck-a.sock --tof-socket /tmp/d/duck-a-tof.sock
```

`updaterd` 与 `mediad` 的 `--token` 必须指向同一个文件，否则鸭子登录了却永不注册；相机几何两边要一致（`[media] quality` 的 `360p30` 是 640×360），帧是裸的、没有握手，尺寸不对会被拒。非 Linux 上 `mediad` 要用 `cargo build -p mediad --features gstreamer` 构建，否则启动后说明并退出。`scripts/duck-sim` 是其余参数的记录，改之前先读。