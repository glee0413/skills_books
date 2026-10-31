---
id: microduck/app-path
title: 手机 BLE 配置路径
description: btd 与 configd：手机如何发现、配对、配网并触发更新。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/app-path-design.md
snapshotPath: source-snapshots/microduck/docs/design/app-path-design.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/app-path-design.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 手机 BLE 配置路径

手机配置机器人时，`btd` 是 BLE GATT 前端，`configd` 是真正拥有 Wi-Fi、身份、配对 PIN 和重启的服务。两者是一个功能：`btd` 不拥有任何状态，所以必须有 `configd`；`configd` 提供 PIN，`btd` 才能完成配对；`btd` 路由表里的方法，`configd` 必须能回答。

## 路径

```text
phone ──BLE──▸ btd ──┐
robotctl ──unix socket──┼──▸ configd ──D-Bus──▸ NetworkManager (wifi)
mediad ──WebSocket────┘                    └──▸ logind (reboot)
                         └──▸ updaterd (update.*)
                         └──▸ robotd (robot.health)
```

`btd` 只转发一个受限的方法子集，自己不执行。这个子集就是安全边界：BLE 不能直接调 `robot.move`，也不能读 ToF 流。`configd` 负责 `net.*`、`system.*`、`pad.*`，并通过 D-Bus 驱动 NetworkManager 和 logind。

## Wi-Fi 为什么用 NetworkManager

Armbian 默认是 netplan + systemd-networkd + wpa_supplicant；`wpa_supplicant` 的 D-Bus 接口没有拿到 `wlan0`，而 netplan 既不能扫描也不能报告关联失败。手机配网最需要“列出网络”和“密码错了”这两个答案，netplan 都给不了。`scripts/migrate-network.sh` 把已有凭据迁到 NM profile，并设置 90 秒的启动回退，避免无头板子迁移后失联。

`BadKey` 是重点：NM 的失败原因要映射成 `BadKey`、`NotFound`、`Timeout`、`Unsupported`、`Other`，未映射的原因绝不能变成 `BadKey`，否则用户会反复重输正确密码。`configd` 轮询 `AddAndActivateConnection` 返回的 active connection，而不是 device 状态；否则设备还停在旧网络时会误报“连接成功”。

## 配对与安全

BLE 走 just-works 配对加一个 transport 层 PIN；PIN 不能靠 BLE 打印，所以手机先读 API 版本，再通过 `system.authenticate` 提交 PIN。当前链路没有 link-layer encryption（文档明确标注未定），所以安全边界主要靠“只路由一个子集”和 socket 权限，而不是把 BLE 当成可信网络。

## 实测坑

- 扫描要等 `LastScan` 前进，不能 `RequestScan` 后立刻读缓存；否则第一次只看到 1 个网络，第二次才看到 8 个。
- 带 service filter 扫描在 iOS 上不可靠；机器人要广播得足够频繁。
- 一个 daemon 一次只服务一个请求，所以每个 lane 一条连接；大回复要分片，MTU 不能由 notify 侧协商。
- 一台机器人只服务一个 central 时仍然要可被发现，Linux 笔记本通过扩展广播连接。