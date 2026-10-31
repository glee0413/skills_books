---
id: microduck/remote-access
title: 外网访问与账号
description: Hugging Face 设备流、token、bridge 与 rendezvous 如何让机器人从外网可达。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/remote-access-design.md
snapshotPath: source-snapshots/microduck/docs/design/remote-access-design.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/remote-access-design.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 外网访问与账号

机器人要能从外网被访问，需要三件事同时成立：它属于一个账号、它有一个可达的 rendezvous/relay、客户端用同一个账号证明自己。Microduck 选择把账号放在 Hugging Face 上，而不是自建 fleet 后端。

## 账号：OAuth device flow

机器人没有键盘，所以用 RFC 8628 device flow：`account.login` 返回一个短代码，用户在浏览器里登录 Hugging Face 并批准，机器人的 `updaterd` 轮询 token endpoint。token 存在 `/var/lib/robot/hf-token`，由 `updaterd` 写、`mediad` 读；它同时也能访问私有 Hub 仓库。

token 30 天过期，refresh token 会轮换；`account.*` 方法由 `updaterd` 提供，因为它是唯一有网络栈的 daemon，而且这个凭据本来就要访问 Hub。旧版本 `updaterd` 对未知方法返回 `METHOD_NOT_FOUND`，这是设计好的 skew 行为。

## Bridge 与 rendezvous

机器人侧有一个 loopback listener，把 rendezvous 的租约/心跳翻译成 WebRTC 信令；它不是把 signalling server 塞进 `webrtcsink`。bridge 是 `mediad` 里的一个 task，放在一个不依赖 GStreamer 的模块里。租约必须心跳，失败模式与 Reachy Mini 的 relay 相同，这是选择同一套 relay 的主要原因。

client 是一个 Docker Space，用 Hugging Face 登录；它只展示当前账号自己的机器人。授权不是机器人上的门，而是“账号 → rendezvous → bridge”这条链：bridge 证明机器人属于账号，rendezvous 只把该账号的 client 路由到该机器人。

## NAT

两端都跑 STUN；机器人主动提供 relay candidate，所以从数据中心也能连上。局域网 peer 和远程 peer 能调用的方法一致；远程不是“另一套 API”。

## 已知开放项

- token scope 不是项目能单方面决定的，需要在发布前确认。
- `updater.toml` 的 `allow_dev_keys` / `auto_apply` 在 A/B OS 更新时仍会被镜像值覆盖。
- 通过 WebRTC 更新机器人尚未实现。