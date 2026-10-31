---
id: microduck/udp-pad
title: UDP 手柄
description: netpadd 的开关、28 字节手柄数据报与回包格式、机器人的锁与静默语义及其信任边界。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/udp-pad.md
snapshotPath: source-snapshots/microduck/docs/robot/udp-pad.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/udp-pad.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# UDP 手柄

同网段的程序把游戏手柄状态（摇杆、扳机、按键）当 UDP 数据报发出去，机器人处理它的方式与蓝牙手柄完全一致：同样的映射、同样的 D-pad 模式、Start 与 Select 同样的长按。它适用于手柄不在机器人旁边、或根本不是蓝牙的情况——笔记本 USB 口上的手柄、手机、脚本。`netpadd` 负责监听，`padd` 负责蓝牙，两者同时只跑一个。

**它是快速、无认证的 LAN 工具**，只为一个场景设计：在可信网络里用手柄以最低延迟驱动机器人。能碰到端口的任何人都能驱动、站起、坐下和关机。通用远程控制请用 WebRTC，它认证、加密、有回程且能跨 LAN。蓝牙配对是另一件事，见[配对手柄](pair-gamepad.md)。

## 打开它：一个键，两个 daemon

默认关闭，一旦打开就**一直开着**，跨重启与更新，直到你关掉——它是配置键而不是会话。开着时端口开放，蓝牙手柄不能工作。

```bash
sudo robotctl configure      # netpad.enabled = true
sudo systemctl restart padd netpadd
```

两个都要重启：`padd` 在 `[netpad] enabled` 为真时让位，`netpadd` 反之；只重启一个，另一个会留在旧答案上片刻。`systemctl is-active padd netpadd` 判断谁在跑：`inactive` 加 `active` 是 UDP 手柄，反之是蓝牙；两个都 active 说明有一个按旧答案启动了；都不 active 说明该跑的那个失败了，看 `journalctl -u netpadd -b`。配置读不出来按关闭处理，坏文件不会让人没手柄用。

其余四个键也在启动时读：`port`（默认 `4210`，绑 IPv4 `0.0.0.0`）、`max_hz`（默认 `30`，10–100，越界拒绝）、`stale_ms`（默认 `300`，超过没有新数据就原地停下，也是数据报允许迟到多久；必须小于 `[safety] deadman_ms`，否则配置被拒并点名两个键）、`timeout_ms`（默认 `1000`，超过就把客户端算作离开，且不得小于 `stale_ms`）。

## 从笔记本驱动

```bash
duckctl udp-pad
duckctl udp-pad 192.168.1.42
```

不给地址就按 `duckctl ip` 的方式经蓝牙找，`--name` 与 `DUCK_ROBOT` 选鸭；给地址则完全不碰蓝牙。按下想用的手柄上的任意键，那只手柄就成为发送源，直到被拔掉；这次按下本身不会作为按键发出。`--hz`（10–100，默认 30）是每秒上限；有变化立刻发，否则每 `1/hz` 发一次保活，机器人才能区分“手柄静止”和“手柄没了”。Ctrl-C 结束：`stale_ms` 后停下，`timeout_ms` 后一秒坐下。

RT 的叫声与 LT 的 wheee 从笔记本扬声器出，鸭子只张嘴；`--robot-sound-on` 让鸭子也出声，那是 `flags` 的 bit 0。笔记本有自己的声音（随机种子存在 `duckctl/voice-seed`），`--voice N` 换，`--mute` 静音。多只鸭子就每只插一个手柄、开一个终端、依次启动 `udp-pad`，已在驱动某只鸭的手柄会被跳过；`--pad 2` 直接用第 N 个手柄，不等按键。

## 28 字节的 pad 数据报

小端，整份状态一个包：

| 偏移 | 长度 | 字段 |
|---|---|---|
| 0 | 4 | magic `b"DKPD"` |
| 4 | 1 | version `1` |
| 5 | 1 | flags：bit 0 表示发送端自己放扳机音效 |
| 6 | 4 | seq，u32，每包 +1，会回绕 |
| 10 | 4 | t_ms，发送端单调时钟毫秒，`0` 表示不检查 |
| 14 | 12 | axes，i16×6：`lx ly rx ry`（±32767 映射 ±1）、`lt rt`（0..32767 映射 0..1） |
| 26 | 2 | buttons，u16：0 A、1 B、2 X、3 Y、4 LB、5 RB、6 Start、7 Select、8–11 方向、12 Home |

发送原始摇杆值，死区由机器人加，发送端自己加就会做两次。版本 1 的包长于 28 字节可以接受，尾部忽略，所以以后加字段不必升版本。`seq` 要随机起点、每包 +1：机器人丢弃不比上一个新的包，所以乱序不会让机器人倒着走；超过 1000 的跳跃也丢，发送端不能跳号。

## 机器人怎么处理

只有最新状态算数：迟到的丢弃，中间状态并入下一个。`max_hz` 限制发给机器人的意图频率，落在间隔内的变化等下一个槽而不是被丢；按下与松开都落在两个槽之间也仍会触发，因为按键按包比较。迟到超过 `stale_ms`（相对同一流见过的最快投递）的包被丢并计为 stale，里面的按键不触发——它说的是手柄当时做了什么，不是现在。

第一个发送者锁住机器人，直到它静默 `timeout_ms`，所以两个人不能抢一只鸭；但这不是防护。短静默立刻停走、保持头与身体姿态，客户端仍持有机器人，长按与按键都还在，回来时按下即生效。长静默重置长按、释放锁，一秒后鸭子发出“手柄去哪了”的声音并在站立时坐下；客户端回来再给一声，只有真的问过才响。客户端消失后或 `netpadd` 启动后的第一包，按键按已按住处理，所以带着 Start 连接不会立刻站起或坐下。

## 回包：DKST 与 DKRB

`netpadd` 对持有机器人的客户端每个包都应答，包括 stale 包，回 24 字节 `b"DKST"`：version、verdict（`1` driving、`2` busy）、被应答的 seq，以及 `accepted`、`stale`、`malformed` 三个计数。计数从启动起累加并回绕，读变化而非绝对值；往返时间就是 seq 到回包的时间，发送速率与 `accepted` 的增量给出丢包率。回包不等待，缓冲区满或客户端不可达就丢，接收循环不会因此变慢。

每秒一次（客户端刚拿到机器人时立刻），还会发 `b"DKRB"` 加 JSON 的 `robot.health` 与姿态给驱动中的客户端。字段缺失意味着“不知道”，绝不是零；`health_error` 说明 `robotd` 没应答，`refused` 是过去 30 秒里机器人没执行的最后一次请求及原因。`netpadd` 用自己的连接去问 `robotd`，慢答案不会拖住手柄。

## 信任边界

没有信任。LAN 上能到 UDP 4210 的任何人，在当前客户端静默 `timeout_ms` 后都能驱动机器人，包括按住 Select 关机。客户端说话期间只有源地址挡着别人，而 LAN 上的源地址可以伪造；1000 的序号上限只挡住单次盲伪造，挡不住看得见流量的人。把它用在你会让人进房间的那种网络上，其余场合用 WebRTC。