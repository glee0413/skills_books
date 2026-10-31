---
id: microduck/telemetry
title: 遥测与隐私
description: Microduck 默认开启的匿名遥测发什么、发给谁、如何关闭，以及关闭后 robot id 的处理。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/telemetry.md
snapshotPath: source-snapshots/microduck/docs/robot/telemetry.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/telemetry.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 遥测与隐私

Microduck 会向官方发送匿名使用数据，用来了解鸭子怎么被使用、在哪里坏。它**默认开启**，随时可关；设计与 Reachy Mini 的 daemon 相同。

## 发送什么

每个事件都带：开启遥测时创建、关闭时删除的随机 robot id；板型（`zero3`、`beta` 或 `unknown`）与 CPU 架构；daemon 版本；OS 镜像的 `ID VERSION_ID` 与 `BUILD_ID`，取自 `/etc/os-release`。

| 事件 | 时机 | 额外数据 |
|---|---|---|
| `daemon_started` | `updaterd` 启动：每次开机与每次 daemon 更新 | — |
| `update_result` | 新 daemon 版本第一次启动 | 旧版本与新版本 |
| `daily_heartbeat` | 每天一次 | `updaterd` 的 uptime |
| `policies` | 每次运行一次，`robotd` 首次应答时 | 模式，以及每个已填槽位的 `policy_<slot>` |
| `policy_loaded` | 某槽位策略变化（每分钟检查） | 槽位、模式、来源、策略 |

策略若来自 Hugging Face Hub（官方集合或 `policy.fetch`，两者都不带 token 下载，说明机器人拿到时仓库是公开的），记作 `org/name@revision/file`；手工放上机器的文件只记 `local`，路径不外发。

## 绝不发送什么

IP 地址、位置、Wi-Fi 名称、机器人名字、Hugging Face 账号或 token、SoC 序列号或任何硬件 id、日志、相机图像与音频。

## 发到哪里、什么时候

PostHog EU Cloud，服务器在欧盟，基于 IP 的定位已关闭，也不建个人档案。事件自身不带时间戳：板子的 RTC 没有电池，硬断电后复位，NTP 同步前时钟是错的，所以由 PostHog 在到达时打戳。离线或尚未同步时事件留在内存，最多 500 条——在此之前 TLS 也无法验证证书。

## 关掉它

控制台抽屉里的 **share anonymous usage data** 开关。同一个开关也在 API 上，所以手机经 BLE、`duckctl`、经 WebRTC 的控制台都能改，写法是两条 JSON-RPC：

```json
{"jsonrpc":"2.0","id":1,"method":"telemetry.set","params":{"enabled":false}}
{"jsonrpc":"2.0","id":2,"method":"telemetry.status"}
```

立即生效，并跨重启与更新保留。关闭会丢弃队列并删除 robot id；再打开会生成新 id，与旧 id 无任何关联，这是“关掉”真正的含义。

`telemetry.status` 回答两个不同的字段：`enabled` 是存下的选择，`active` 是此刻是否真的在发。`updaterd` 环境里的 `MICRODUCK_TELEMETRY=0` 或 `DO_NOT_TRACK=1` 会强制关闭，不论用户选了什么；`scripts/duck-sim` 与 `scripts/systemd-test.sh` 都设了前者，所以模拟或容器里的鸭子什么都不发。

## 状态文件与排障

选择存在 `/var/lib/robot/updater/telemetry.json`；文件读不出来按关闭处理，这样损坏的配置只会少发数据，不会误发。实现见 `updater/src/telemetry.rs`。

排查时先分清三件事：`enabled` 是用户的选择，`active` 是此刻真的在发，而 `MICRODUCK_TELEMETRY=0` 或 `DO_NOT_TRACK=1` 会在读取选择之后把 `active` 压成假。所以“开关是开的但没数据”可能只是环境变量在起作用，也可能是机器人还没连上网、队列还停在内存里（上限 500 条）。反过来，从“`updaterd` 进程在跑”推断“正在上报”是不成立的：这个 daemon 负责更新、账号和遥测，前两件事与是否上报无关。要一份可核对的答案，直接问 `telemetry.status`，不要从日志里猜。