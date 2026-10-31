---
id: microduck/cheatsheet-dev
title: 开发板速查
description: 开发通道、候选版本与更新后重启顺序的实操清单，以及从笔记本推送和借用手柄。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/cheatsheet-dev.md
snapshotPath: source-snapshots/microduck/docs/robot/cheatsheet-dev.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/cheatsheet-dev.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 开发板速查

只在[开发板安装](install-dev.md)装出来的板子上成立的命令。日常运维看 [robotctl 速查](cheatsheet.md)。

## 开发通道：--ref

```
sudo robotctl update apply --ref <branch> daemon
sudo robotctl update apply --ref main daemon
```

`--ref` 装某分支最后一次 CI 构建，`--version` 钉住具体版本。**不带 `--ref` 的 `apply daemon` 装的是最新 stable，在开发板上通常是降级**：分支刚合并时 stable 还更旧，若它早于板上某个已有 unit，`ExecStart` 指向的二进制不存在，重启失败并回滚——这是门禁在工作，但那条命令看起来最像该敲的。标签 `daemon-dev-<branch>` 跟着分支走，里面的版本 `0.1.0-dev.42.c719ec8` 每次构建唯一，同一分支两次构建不会混。`--ref main` 是不离开开发通道回到主线的方式；普通 `apply` 会离开，因为预发布版本排在其正式版之下。合并不会立刻可装，CI 要先构建，用 `gh run list --branch main` 确认。

## 候选版本：--staging

```
sudo robotctl update apply --staging daemon
sudo robotctl update apply --staging --version 0.3.0 daemon
```

`release.yml` 发到 staging、尚未 promote 的候选。它和正式版一样用发布密钥签名，并带着将要发布的版本号；不可达是因为被标成 prerelease，而普通 `apply` 跳过预发布，免得机器人漂到没人验证过的构建上。`--staging` 是这层过滤的唯一入口，只对当次命令有效。

## 更新之后：重启顺序的坑

- `robotd`、`configd`、`padd` 在更新中重启；`updaterd` 与 `btd` 在应答后 5 秒重启——前者不能中途重启自己，后者可能在传应答。所以 `btd` 的修复晚几秒自动生效。
- 这两次重启没发生，下一次 `updaterd` 启动会补上；唯独 `updaterd` 自己只报告不一致，要再跑一次 apply（应答 `already_current` 并在 `stale` 里点名）或 `sudo systemctl restart updaterd`。
- `apply` 对已安装版本返回 `already_current`，但不再无动作：它检查哪些 daemon 没在跑该版本并重启它们。`stale` 为空，才说明修复根本不在此版本里。

症状是“修复明明装了却没生效”。先问每个 daemon 跑的是哪个 release：

```
robotctl health
```

`units` 块逐行给出 release，与已安装不一致时告警并点名要重启的 daemon。`build unknown` 表示进程在跑但没发布身份（多半是旧构建），`restarting` 表示刚退出、systemd 正在拉起。确实落后就重启，并读 journal 找原因：

```
sudo systemctl restart configd
```

## 从笔记本：推送与借用手柄

```bash
scripts/dev-push.sh microduck@<board>
```

本地编译、签名、经 ssh 安装，结果仍是带门禁的普通更新，上面的重启陷阱照样适用；准备与排错见[开发推送](dev-push.md)。

手柄也可以借笔记本：`padd` 只是普通客户端。先停板上的，免得两个进程抢手柄：

```bash
sudo systemctl stop padd
ssh -L /tmp/robotd.sock:/run/robotd.sock microduck@192.168.1.42
cargo run -p padd -- --socket /tmp/robotd.sock
```

`systemctl start padd` 换回板上的。摇杆映射与限速不是命令行参数，而是 `robotd.toml` 里的 `[pad_drive]`、`[pad_axes]`、`[pad_head]`、`[pad_body]`、`[pad_roller]`，用 `sudo robotctl configure` 改，一秒内生效；`--max-head`（弧度，作用于每个头部关节）与 `--deadzone` 仍在，给了就临时压过文件。蓝牙路径的全部命令见 [duckctl 使用](duckctl.md)。