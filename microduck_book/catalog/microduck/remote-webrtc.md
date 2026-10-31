---
id: microduck/remote-webrtc
title: 远程 WebRTC
description: 一个会话四路流、mediad 自带信令，以及控制通道如何复用现有 API。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/remote-webrtc.md
snapshotPath: source-snapshots/microduck/docs/design/remote-webrtc.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/remote-webrtc.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 远程 WebRTC

WebRTC 是消费机器人摄像头和遥控的默认路径。它把视频、音频、控制通道放在同一个会话里，端到端加密，并且有返回路径；`media.stream` 只是“程序只消费帧、长时间运行、在意中继计费”时的回退。

## 一个会话，四路流

一个 WebRTC 会话承载四类内容：视频、音频、控制通道，以及（后续）遥测。`mediad` 自己运行信令服务器，不依赖外部 signalling 服务；机器人发布 H.264，浏览器/手机通过标准 WebRTC 连接。

## 控制通道是现有 API 的管道

控制通道不定义另一套协议：它把同一套 JSON-RPC/NDJSON 请求转发给 `robotd`/`configd`/`updaterd`。因此 WebRTC 能触达的方法集比 BLE 大，但仍然受 Unix socket 权限和服务路由限制。回复故意不做请求级关联，按顺序流式返回，减少通道状态。

机器人本身**没有** WebRTC 授权层：本地和远程的授权都放在 bridge/账号层。局域网 peer 和远程 peer 能调用的方法一致；远程访问的授权来自 Hugging Face 账号与 rendezvous，而不是机器人上的登录框。

## 远程路径

不在同一局域网时，机器人通过 STUN 发现候选地址，并主动提供 relay candidate；`mediad` 里有一个 listener 在 loopback 上，把 rendezvous 的租约/心跳翻译成 WebRTC 信令。租约需要心跳，失败模式与 Reachy Mini 的 relay 类似。

## 更新与遥测

目前不能通过 WebRTC 更新机器人；更新仍走 `updaterd` 的 release 机制。设计上要求“线上每个事件都带发生时间”，但这是待办，不是已实现。

## 为什么不是 `media.stream`

`media.stream` 让机器人主动拨出 WebSocket 推帧，适合只收帧的长期程序，但没有返回路径和控制通道，且中继计费更敏感。读代码时容易因为它注释多而误以为它是首选；默认应该是 WebRTC。