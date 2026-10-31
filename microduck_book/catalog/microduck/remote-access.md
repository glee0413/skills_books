---
id: microduck/remote-access
title: 外网访问与账号
description: 本页讲鸭子如何用 Hugging Face 设备码登录、以 relay 注册到 rendezvous，并让远程客户端经桥接拿到视频与控制通道；同时记录令牌、租约与 TURN 的实际约束。
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

鸭子如何从局域网外被到达。[远程 WebRTC](./remote-webrtc.md) §7 给形状——从 rendezvous 到机器人信令服务器的桥——本页补上它需要而没有的两样：一个**命名账号的凭据**，和一个**能出示它的服务**。

要可达，机器人需要：凭据；一个它**向外**连接、只把机器人展示给其主人的服务；到 `ws://127.0.0.1:8443` 的桥；说该服务线协议的客户端。外加 NAT 穿透。一条不变量约束全部：**本地模式绝不能依赖其中任何一项**。

## 账号：Hugging Face 设备码

流程住在独立仓库 `hf-robot-account`，因为其中没有一件关于鸭子；留在 `updater/src/account.rs` 的是这台机器人的事实——令牌路径、`robot` 组、到 `proto` 的映射、每种拒绝的 JSON-RPC 码。

为什么是设备码而非授权码加 PKCE：重定向流要为每个主机名注册 redirect URI，浏览器必须能解析并到达机器人，而且它是在没有浏览器的设备上跑浏览器流程。设备码反过来：机器人向 HF 要码，说"打开 hf.co/oauth/device 输入 M8HJ-FMGN"，轮询到有人批准；没有 redirect、没有主机名。它也是唯一给出**刷新令牌**的，而 HF 自带第一方公共客户端（`DEVICE_CODE_OAUTH_CLIENT_ID`），不需要注册应用。三个不变量：**先给码**（`robotctl` 只打印等待，`duckctl` 打印后开页面）；**客户端中途离开是预期**，守护进程仍在轮询；**出现在 rendezvous 上才是真正的成功**，存下令牌只说明登录成功。

令牌在 `/var/lib/robot/hf-token`，`root:robot`，`0640`，JSON 含 access、refresh、绝对 `expires_at` 和用户名，所以 `status` 不用网络。放 `/var/lib/robot` 而非 `/etc/robot`：A/B 槽更新会替换 `/etc`，令牌在那里会每次 OS 更新把机器人登出。**写得 `0600`，设组后再放宽到 `0640`**，不走 `write_atomic`：那个 helper 不设模式，先落成 `0644` 再 chmod 的令牌有一瞬间全世界可读。**不放进 `robotd.toml`**：`configure --list` 会打印、编辑器会显示、变更报告会生成。**`updaterd` 拥有它**（已有 HTTP 客户端、已代表机器人访问网络、已是 root）；`mediad` 只**读**它。

`account.login`、`status`、`logout` 都在 `updaterd`，路由到本地、BLE、WebRTC。BLE 最重要：它是唯一能到达刚开箱、没有网络的机器人的传输。WebRTC 是唯一效果**以账号的方式比会话活得更久**的调用，三件事让它可接受：**已属于某人的机器人会拒绝**（不带 `force` 时 `INVALID_PARAMS` 并点名账号）；**它可见**（`status` 无需授权就回答属于谁）；**它可撤销**。但 `logout` 删除机器人的副本，**不告诉 Hugging Face 任何事**，令牌直到过期仍有效。令牌三十天、刷新会轮换，`maintain` 每六小时刷新剩余不足一周的；它无条件启动，因为关掉更新检查的机器人账号仍会过期。

## relay：租约、心跳与失败模式

`webrtcsink` 允许自定义 signaller，但一个 `webrtcsink` 只有一个：指向服务会让本地会话也走服务，破坏不变量；保留两者意味着编码两遍。所以桥是 `mediad` 里的 relay 任务，以 **`producer`** 向服务注册、以 **`listener`** 向本地服务器注册。它**不是纯 relay**：服务侧是 SSE 入、`POST /send` 出、`Bearer` 头、逐跳不同的 id，而且 **`sessionStarted` 与 `list` 在 `POST` 的响应体里**，其余在流上；丢掉响应体的页面会拿到一份它不知道 id 的会话的 offer。所以桥双向维护会话表、逐条重写 `sessionId`——**载荷不透明的翻译器**。

服务会驱逐 `LEASE_SECONDS` 内没发过东西的 producer：半开 TCP 会静默吸收 keepalive。租约 **30 秒**，welcome 广告 `recommended_heartbeat_interval_seconds: 10.0`，租约**只**看入站 `POST /send`，所以 relay 按广告节奏重发 `setPeerStatus`，缺省 5 秒、钳在 [1, 60]。**`POST /send` 在 `GET /events` 之前是 400**：peer 在流存在前不存在。SSE 侧 30 秒无内容发 `event: ping`，所以读超时取 60 秒。

已知失败：**脑裂**（SSE 健康而服务不再列出我们）靠每 30 秒轮询 `/api/robot-status`；退避 5 到 60 秒并加抖动；令牌在心跳 tick 重读，`logout` 最多滞后一个节奏；**401 不退避**，它等令牌文件。只有带 `meta.hardware_id` 的 producer 会被清扫，所以那必须是 **SoC serial**，放名字则改名就分裂身份。**peer 按 token 索引**，用机器人 token 认证的云后端会把机器人从列表拿掉。

## 控制通道、帧与 NAT

桥承载协商，`control` 是 SCTP 跑在 ICE 选出的候选对上。服务已带得动调用：`handle_peer_message` 把 `peer` 信封里除 `type` 与 `sessionId` 外的键原样转给对端，所以带 `rpc` 键的信封就是控制调用。两个限制来自服务：**没有像素**（视频走这里就是 base64）；**不是遥操作 lane**——1200 请求/分钟的限额，超了整个 peer 吃 `429`。

**画面走机器人主动外拨**：`media.stream {url}` 告诉机器人一个 `wss://`，它向外连接并推帧；出站 WebSocket 是永远能工作的那件事，没有 relay、没有 ICE。用 H.264 而非 JPEG：板子有硬件编码器，编码花 VPU 而不是核，合成内容上每访问单元 0.5 KB 对 JPEG 每帧 6.5 KB。两件事让它安全且都是无声失败型：接收方中途加入在关键帧前解不出任何东西，所以 `h264parse config-interval=-1` 在每个关键帧前重复 SPS/PPS，开阀时发上游 `force-key-unit`；丢掉最旧保留最新对 JPEG 对、对这里错，有缺口就放弃到下一个关键帧。

NAT 上，`stun.l.google.com:19302` 是 `webrtcsink` 的默认，也是控制台远程时该要的。**TURN 不是可选，也不对称**：srflx 到 srflx 需要两边都放行打洞。**一个 relay 候选就够，而且不总是机器人的**：`aiortc` 的 STUN 客户端能用而 TURN 客户端不能，所以机器人必须是转发侧。iPhone 那次测量不能承重——`relays=5` 数的是接受的 TURN URI，不是收集到的候选；`relay=0` 配非零 `servers` 才是没有其他症状的失败。

## 客户端与授权

控制台被 `include_str!` 进 `mediad`、由机器人服务；**远程客户端无法从它到不了的机器人取页面**。**决定：`pollen-robotics` 组织里一个 `hf_oauth: true` 的 Space**——`microduck-console`。决定性论据不是托管，是**令牌**：远程消费者向 rendezvous 认证的方式与机器人相同，服务用 `whoami-v2` 解析，不检查类型与 scope。`hf_oauth: true` 创建 OAuth 应用并注册 redirect URI，`@huggingface/hub` 的 `oauthLoginUrl` / `oauthHandleRedirectIfPresent` 在客户端完成 PKCE。

scope 宽度是出货前该修的：第一方客户端令牌带 HF 授予的一切——`write-repos`、`manage-repos`、`jobs`、`read-billing`——而鸭子只需要证明身份。**窄版本是 Pollen 拥有的公共设备码客户端，带 `openid profile read-repos`**。`logout` 不撤销仍开放：HF 是否接受第一方客户端的撤销要查而不是假定。