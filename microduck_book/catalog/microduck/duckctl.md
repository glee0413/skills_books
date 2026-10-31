---
id: microduck/duckctl
title: duckctl 使用
description: 没有网络和 ssh 时用 BLE 找到、检查、更新并配置机器人，以及哪些方法被刻意拒绝。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/duckctl.md
snapshotPath: source-snapshots/microduck/docs/robot/duckctl.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/duckctl.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# duckctl 使用

`duckctl` 让笔记本在没有网络、没有 ssh 的情况下和机器人说话，是手机 App 的替身，也是第一次接触从未连过 Wi-Fi 的机器人的办法。今天走 BLE，但名字刻意不提无线电：`mediad` 还会给机器人第二条传输，工具按“跟谁说话”命名。它**永远不装在机器人上**，发布版依赖的是 `robotctl`（见 [robotctl 速查](cheatsheet.md)）。

## 安装与运行

```bash
uvx duckctl --name <robot-name> info
uv tool install duckctl
brew install pierre-rouanet/tools/duckctl
cargo install --path duckctl
cargo run -q -p duckctl -- --name <robot-name> info
```

`uvx` 跑最新发布并缓存，不编译任何东西；`uv tool install` 把它装到 PATH。分支构建用 `curl -fsSL https://raw.githubusercontent.com/pollen-robotics/microduck/main/scripts/install-duckctl.sh | sh`，装 `main` 最后构建的版本到 `~/.local/bin`，末尾加 `sh -s -- udp-pad` 换分支。macOS 浏览器下载的二进制被隔离，用 `xattr -d com.apple.quarantine duckctl` 清掉。编译不需要系统头文件，libdbus 是编进去的。

## 找到机器人

```bash
duckctl scan
duckctl ip
duckctl ssh -- sudo robotctl pad pair
duckctl scp report.md :/tmp/
```

`scan` 只列广播 duck 服务的机器人，其余设备计数而不列出，`--verbose` 才展开。每只机器人广播自己的 IPv4，所以这也是 ssh 地址的来源；过程不建立连接，也不需要 PIN。`duckctl ip` 只打印地址，可直接 `ssh microduck@$(duckctl ip)`。`duckctl ssh` 找到地址后 exec 成 ssh，提示符、终端与退出码都是 ssh 自己的；账号取 `--user`、`DUCK_BOARD_USER`，否则 `microduck`，`--` 之后在机器人上执行。`scp` 里以 `:` 开头的路径在机器人上——就是省掉 host 的 `host:path`，不含 `:` 的复制在扫描前就被拒。

`ssh` 与 `scp` 把上次地址记在 `~/.cache/duckctl/addresses`，先试缓存，22 端口一秒内有应答就跳过扫描；不行再扫并刷新。绑定过的机器人常常不再向本机广播，`ip` 就转而连接并调 `net.status`，更慢、要 PIN，但总有答案。从未改名的机器人叫 `duck-` 加序列号派生的四个字符。

名字可以放进环境，省掉每条命令的 `--name`：

```bash
export DUCK_ROBOT=duck-c51b
export DUCK_PIN=418299
```

`DUCK_PIN` 对应 `--pin`，改过 PIN 的机器人每条命令都需要它。单次命令 `--name` 仍优先；`DUCK_ROBOT= duckctl scan` 可临时清空默认值。完全没有名字时第一只找到的赢；有名字却两只都应答是错误，通常因为引导器留空序列号、板子按 hostname 命名，从机器人上 `robotctl system set-name` 改一只即可。

## 身份、网络与健康

```bash
duckctl info
duckctl quack
duckctl name ducky
duckctl wifi status
duckctl wifi connect <ssid> --psk <passphrase>
duckctl health
duckctl reboot-motors 3 11
duckctl version
duckctl logs robotd -n 200
```

`quack` 用序列号生成的声音回答，静音的机器人会明说拒绝而不是沉默。改名最多 24 字符，几秒生效，但 macOS 会继续用学到的旧名，`scan` 会滞后。`wifi connect` 会断开当前网络，最长 45 秒才应答。`reboot-motors` 是舵机硬件错误（过载、过热、电击）后唯一的出路，否则力矩一直关着；**它先断所有关节的力矩**，之后保持松弛，直到下次写入、按手柄 Start 或 `duckctl call robot.init`。`logs` 读本次启动的 journal，支持 `-n` 与 `--boot -1`，可读单元包括 `updaterd`、`robotd`、`configd`、`btd`、`padd`、`mediad`、`tofd`、`bluetooth`、`NetworkManager`。

## 更新与操作系统

```bash
duckctl update check
duckctl update apply
duckctl update apply --ref my-branch
duckctl update rollback
duckctl update select 0.5.1
duckctl update watch
duckctl os status
duckctl os apply --build 20261028093000
duckctl os switch
```

`update` 与 `robotctl update` 同词，默认 `--component daemon`。apply 打印阶段行，最后以 JSON 给出 `applied`、`from`、`to`；**连接在应答后断开是更新成功**，机器人重启 daemon，`btd` 约五秒后重启。`--dry-run` 验证完停在切换前，`--ref` 与 `--version` 互斥。`os` 把整个根文件系统装进没在跑的 A/B 槽，每次都重启；只有 `microduck_yocto` 镜像有槽位。移动中或有远程会话时会拒绝，`--interrupt-sessions` 解除后者。

## 策略、技能与手柄

```bash
duckctl policy list
duckctl do roulade
duckctl policy load walk /opt/robot/policies/current/alpha_walking.onnx
duckctl policy reset walk
duckctl policy skill polite-bow --path /var/lib/robot/policies/.../policy.onnx --duration 4
duckctl policy unskill polite-bow
duckctl pad bind x polite-bow
duckctl pad reset x
```

技能要机器人处于驱动状态（先按手柄 Start），但不需要手柄输入：deadman 自己把速度归零，没人操纵时它就站着做动作。`policy load` 的路径在**机器人上**且必须绝对，它会把选择写进 `robotd.toml`，重启后仍在；一次只能动一个槽，全部还原是机器人上的 `robotctl policy reset`。`policy skill` 一次调用完成注册与 reload，`--command` 是运行时喂给网络的 twist。`pad bind` 先对照本机技能表，打错会带着真名单拒绝。

## 被拒绝的方法

`btd` 自己拒绝遥操作（`robot.move`、`robot.head`、`robot.look`、`robot.pose`、`robot.mouth`）、急停 `robot.stop`、`robot.relax`、高频 `robot.subscribe`、`update.pin`/`update.resetToGolden` 与配对 PIN 相关方法，返回错误码 14“not available over Bluetooth”。`robot.do`、`robot.init`、`robot.enable`、`robot.rebootMotors` 不在其中：它们都只发一次请求，而遥操作是每秒五十次小更新，20 字节通知预算扛不住；`robot.relax` 被拒的理由是“原本撑着自己的机器人不再撑住”。其余方法用 `duckctl call <method> '<json>'`，等 60 秒；更新命令等的是三分钟静默，所以更新不用 `call update.apply`。