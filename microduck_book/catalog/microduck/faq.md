---
id: microduck/faq
title: 常见问题
description: 模型太重、NAT 打不通、需要更便宜的推流、Space 如何找到机器人，以及没有硬件时怎么测。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/faq.md
snapshotPath: source-snapshots/microduck/docs/faq.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/faq.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 常见问题

想让它做开箱之外的事时会冒出来的问题。设计文档讲机器怎么转，这里讲该伸手去够哪一块。

## 模型太重，放到板子外面

板子是 Radxa Zero 3，NPU 只够跑一个小检测器，更大的模型必须离开机器人。最省事的路径是 Hugging Face Space 的付费硬件：已有 GPU 选项、与机器人共享的账号体系和一个 URL。

**用 WebRTC。** 机器人通过 WebRTC 会话发布 H.264，Space 消费它，rendezvous 介绍双方，谁都不需要知道对方地址。`spaces/vision-demo/` 是现成例子：

```
your Space ──sign in, list robots──►  rendezvous  ◄──registers──  the duck
your Space ◄═══════ H.264 over WebRTC, media and control ═══════►  the duck
```

留在 WebRTC 上白得三样，也是它成为默认的原因：媒体由 DTLS-SRTP 端到端加密；控制通道骑同一会话，所以能看也能开；还有回程——音频或第二路视频——想要时就有。

## NAT 后面怎么办

能。家用路由器后的机器人与数据中心 NAT 后的容器通常打不通洞，于是机器人提供一个**中继候选**：用它自己的账号 token 换来的 Cloudflare 短期凭据，消费端不需要持有任何凭据。

两个要提前知道的坑。中继消耗机器人主人的带宽，按 Hugging Face 账号每月 10 GB（免费档）；持续 720p 大约每小时 1 GB，整天看的 Space 会花光。浏览器消费端在没有自己的 IPv4 时需要自己的中继凭据，Python 端不用。ICE 只在必须时中继，能找到直连就用直连，但“必须”在家用到数据中心之间很常见。

## 更便宜的路：media.stream

有兜底，但它是兜底而不是第二套设计：`media.stream`，机器人主动拨**你的** WebSocket 并把帧推出去。

```
your Space ──media.stream {url: "wss://…/frames"}──►  rendezvous  ──►  the duck
the duck   ══════════ frames, outbound wss, direct ══════════►  your Space
```

它不花任何人的中继，因为机器人外连不需要打洞。三个条件同时成立才用：消费者是**程序**而不是人；流**足够长**，中继计量才值得在意；你只需要**帧**。离开 WebRTC 要放弃的：完全没有回程，什么都到不了机器人；没有控制通道，驱动得另外经 rendezvous 发 JSON-RPC（`spaces/shared/wire.py`）；加密是你的 TLS 而不是 DTLS-SRTP，且在你的服务器终止。

机器人先发一条文本 **hello** 说明后面是什么（`frames.encoding` 为 `h264` 或 `jpeg`），然后每帧一条二进制消息。按 hello 分支而不是嗅探字节；`spaces/vision-demo/receiver.py` 是参考接收端，分支在 `decoder_for`。

## Space 怎么找到这只鸭

靠账号。机器人带着自己的 Hugging Face token 注册到 rendezvous，你的 Space 用 `hf_oauth` 让访客登录，服务只向一个账号展示它拥有的机器人。机器人上什么都不用配，也没有机器人侧的关卡——这正是该设计被认为足够的原因。`spaces/shared/rendezvous.py` 的 `ducks(token)` 就是这个列表调用。

## 没有机器人也能测

`scripts/duck-sim` 用真实 daemon 驱动 MuJoCo 身体，像板子一样注册到 rendezvous 并标记为 simulated，所以 Space 到达它的方式与真机一致。用法见[模拟机器人](simulation.md)，设计边界见[仿真设计](sim-design.md)。