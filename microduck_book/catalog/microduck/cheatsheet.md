---
id: microduck/cheatsheet
title: robotctl 速查
description: 机器人在手边时的 robotctl 命令地图：从 version 与 health 到 monitor、configure、策略、整机实验与更新。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/cheatsheet.md
snapshotPath: source-snapshots/microduck/docs/robot/cheatsheet.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/cheatsheet.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# robotctl 速查

`robotctl` 跑在机器人上，本文命令都取自随附分支的 `--help`。只读命令不需要权限；任何改变机器人的操作都要 `sudo`（或在 `configd` 的 `--allow-user`/`--allow-group`、`updater.toml` 的 `allow_uids`/`allow_gids` 里授权）。分支构建、候选版本和更新后的重启陷阱见[开发板速查](cheatsheet-dev.md)，纯蓝牙路径见 [duckctl 使用](duckctl.md)。

## 先跑 version 与 health

```
robotctl version
robotctl health
```

`version` 对比每个 daemon 正在跑的与已安装的版本，不一致就告警——更新后 daemon 仍在跑旧代码，看起来和被修的 bug 一模一样。`health` 一份报告覆盖软硬件，不健康或不可达时退出码非零，可直接当脚本门禁；`--json` 出支持包，`--check` 先检查更新源。`monitor` 帧首最后一行来自每两秒轮询的 `robot.health`：电量电压与百分比、最热舵机、板温，以及 `unhealthy: control loop at 43.9 Hz`、`orientation frozen — 25 stale reads` 这类结论。

## monitor：一条流看全部

```
robotctl monitor
```

显示客户端请求的量与实际施加的量，不同时点名原因（如 `deadman — no intent arrived recently, velocity zeroed`）。帧上还有逐关节命令与实测、IMU 投影重力与跌倒判定、回路速率轨迹。右侧按实测关节角与重力向量画出机器人，`d` 开关、`[`/`]` 或左右方向键旋转；ToF 有帧时点云叠加进同一场景，绿为地面、黄为命中，并做深度遮挡，所以“它在看我的手还是看自己”有答案。再下面是里程计轨迹，面板不长大、世界缩小，`+` 是起点、`●` 是机器人。按键：`q` 退出、`u` 切换角度单位、`t` 开 ToF 矩阵、`c` 开相机、`p` 打开手柄原始输入。重定向时每 tick 打印一行，完整状态用：

```
robotctl monitor --json --hz 50 > run.jsonl
```

## configure：该改的配置文件

```
sudo robotctl configure
robotctl configure --list
```

编辑器叠加在镜像的 `/etc/robot/robotd.toml` 之上，写入 `/var/lib/robot/robotd.toml`；schema、默认值与校验和 `robotd` 同源，保存前用 daemon 自己的 loader 验证并原子写，注释与其他版本的键原样保留。SPACE 切换、ENTER 输入、`u` 还原、`ctrl+f` 模糊搜索；黄色带 `•` 的键是本机偏离默认之处。保存会提示所需动作：多数键要重启，`[policy]` 只需 `robotd` reload，`[pad]` 与 `pad_` 各段一秒内由 `padd` 自己拾取。`media.quality` 可设 `1080p30`、`720p30`、`720p15`、`360p30`；`media.source = test` 推测试图（256x144@5），因为 WebRTC 控制通道骑在视频轨上，管线起不来的板子两样都丢。

## 策略、技能与手柄

```
robotctl policy list
robotctl policy check
sudo robotctl policy update
sudo robotctl policy load walk /home/microduck/my_walking.onnx
sudo robotctl policy reset walk
robotctl policy search microduck
sudo robotctl policy add polite-bow fffiloni/microduck-polite-bow-b1d864
robotctl robot do polite-bow
```

槽位（slot）是默认跑的网络，技能（skill）是被点名才跑的一次性策略；两者都是 Hub 上的文件，换文件不用发版、不用重启。`policy load` 只接受 `obs[1,61] -> actions[1,14]` 形状，加载失败保留原策略。社区策略要先把 `policy.allow_community` 设为 `true`，且没有任何人验证过——第一次把机器人放在支架上。技能要在驱动状态下才会执行（先按手柄 **Start**）。绑定按钮：

```
robotctl pad bindings
sudo robotctl pad bind x polite-bow
sudo robotctl pad reset
```

可绑 `a`、`b`、`x`、`y`、`lb`、`rb`（`lb`/`rb` 是肩键，模拟扳机是嘴和叫声），`padd` 一秒内生效，名字不对会带着真名单拒绝。

## 电机、电量与整机实验

```
sudo robotctl robot init
sudo robotctl robot relax --yes
sudo robotctl robot reboot-motors
robotctl vetbook
sudo robotctl endurance
```

`init` 给关节上电并在约两秒内爬到 home 姿态，**会动每一个关节**；`relax` 断电，没人扶着就会塌，所以要 `--yes`；`reboot-motors` 可带关节号，先断力矩。`vetbook` 是鸭子的一生账本：记录、逐关节寿命与日记，`--json` 给 `robot.vetbook` 的答案。`endurance` 在起点半米内随机走、站、坐直到电池耗尽，作为 `robotctl-endurance` 单元在后台跑，数据写到 `/var/lib/endurance/<hostname>-<time>/` 的 `samples.csv`、`events.csv`、`meta.json`。

## 声音、合唱、网络与更新

```
robotctl quack
robotctl chorale
robotctl theremin
robotctl net status
sudo robotctl net connect <ssid> --psk-stdin
sudo robotctl account login
robotctl update status
sudo robotctl update apply daemon
sudo robotctl update rollback daemon
robotctl update log
```

`quack` 是最快的“我连对了鸭吗”：每只鸭的声音由 SoC 序列号生成，没声音就是找错了。合唱与 theremin 都默认关闭（`[chorale] accept`、`[theremin] enabled`）；合唱没有共享时钟，指挥的节拍计数就是时基。`net connect` 会断开当前网络，ssh 会掉，那是成功；`--psk-stdin` 让口令不出现在 `ps` 里。`account login` 走 RFC 8628 设备码，令牌 30 天并自动续期。更新历史与 journal 分开存放，掉电也在；`update log` 一行一次尝试，`update show 42` 打印那一轮的完整时序。