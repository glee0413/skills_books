# 远程访问：WebRTC、账号与中继

Microduck 的远程访问不是另造一套协议，而是把局域网里已经跑通的 WebRTC 会话，原样接到一个会合服务后面。手机、浏览器或服务器端程序看到的仍然是一条 WebRTC 会话、一个 `control` 数据通道和同一套 JSON-RPC；变化只发生在信令怎么到达机器人。这一章按“会话—信令—控制通道—账号—中继—客户端”的顺序拆开，设计原文见 [远程 WebRTC 精读](../../catalog/microduck/remote-webrtc.md)、[外网访问与账号](../../catalog/microduck/remote-access.md) 和 [手机 BLE 配置路径](../../catalog/microduck/app-path.md)。

## 一条会话，一个信令服务器

`mediad` 用的是 `gst-plugins-rs` 的 `webrtcsink`，不是 `webrtcbin`。差别不在编码器，而在后者要自己实现信令协议、会话模型和每个消费者的编码器管理；`webrtcsink` 把这三样一起带来，剩下的工作才是设计控制面。目标形态是一条会话承载四条流：

```text
peer（浏览器 / 手机 / 服务端程序）
   ├── video      摄像头，硬件 H.264（mpph264enc，constrained-baseline）
   ├── audio      麦克风；telepresence 时双向
   ├── datachannel "control"  可靠、有序 → 机器人既有 API
   └── datachannel "teleop"   不可靠、无序 → 输入与高频遥测
```

第一版只打开 `control`，这不算妥协。`intents.rs` 把每个意图放在 `ArcSwap` 里、后写者获胜，这个假设成立的前提是写入按顺序到达；可靠有序的 SCTP 恰好保住了它。反过来，等 `teleop` 落地时，`maxRetransmits: 0` 会重排，80 毫秒前的摇杆值可能后到并覆盖新值，所以那一层必须自带单调序号，由 `mediad` 丢弃旧帧。

信令服务器就跑在 `mediad` 自己的进程里：`webrtcsink` 自带 `run-signalling-server`，不需要再构建、分发、守护第二个二进制。它监听所有网卡，局域网客户端直连 `ws://<robot>:8443`；机器人自己做的那张控制台页面 `mediad/webclient/index.html` 就是这样一个客户端，单文件、无构建步骤，手写协议而不依赖 JS 库。绑所有网卡是个决定：只绑回环会让每个局域网会话都被迫绕中继，等于取消了本地模式。它带来的后果是“谁能驱动机器人”，下节说。

## 控制通道是既有 API 的管道

`control` 上跑的是 JSON-RPC 2.0、一行一个对象，和 `duck-ipc-proto`、`robotctl`、`btd` 说的是同一种话。`mediad` 不解释方法，只把调用转发到拥有它的守护进程的 Unix socket，再把回复原样泵回来。这继承了 `btd` 的一条重要性质：`route.rs` 对 `Call` 的匹配是穷尽的，协议新增一个方法就会编译失败，逼迫有人决定它能不能走这条传输；写成 `_ => None` 则会静默拒绝，最后表现为“App 里少了一个功能，没人记得为什么”。

WebRTC 允许的方法比 BLE 多，但不是全部。`system.pairingPin` 和 `system.setPairingPin` 被排除，因为它们授权的是另一条传输——能改 PIN 的局域网 peer 可以把手机锁在 BLE 恢复路径之外。`update.*` 的写操作暂时排除，因为执行更新会重启 `mediad`、掐断正在看进度的会话；只读的版本与历史从一开始就允许。反过来，`account.*` 被加了进来：它把机器人绑定到 Hugging Face 账号，是这条通道上第一个效果超出会话本身的写调用。

回复刻意不做请求关联。订阅是一条打开连接上的通知流，每一条都必须到达客户端；一旦把回复和请求配对，这条流就会被破坏。代价是队头阻塞：可靠通道上丢一个包，后面的控制 RPC 一起停，所以“链路差时机器人整体发木”的正确答案是补 `teleop`，不是调参。

## 机器人不设门，门在中继上

第一版在机器人侧没有任何鉴权：能连上信令服务器的人就能开会话、驱动机器人、看摄像头。出厂配对 PIN 是所有人共享的 `000000`，它证明不了身份，加上去只会给每次首次连接多一步。代价是同一个网络里的任何人都能拿到机器人和摄像头，实验台上可以，家庭里不行。

远程路径也不需要机器人自己设门，因为两端在到达前都已认证：客户端用 OAuth 登录会合服务，服务只展示它账号名下的机器人；机器人侧的中继持账号令牌向外连接。服务匹配的是两个已经认证的参与方。信任没有消失，只是搬到了服务里：机器人与账号的绑定必须正确，而只有服务知道答案。

唯一没被覆盖的是把信令端口直接端口转发到公网。那时既没有中继做过认证，局域网推理也不成立，因为能访问它的人不再是大楼里的人。这是部署错误，但机器人自身不会察觉。

## 账号：Hugging Face 设备码

机器人没有浏览器，所以用 OAuth 设备码，而不是重定向。流程很短：

```text
POST https://huggingface.co/oauth/device   → user_code + verification_uri
用户在 hf.co/oauth/device 输入八位码
POST https://huggingface.co/oauth/token    → authorization_pending，直到批准
GET  https://huggingface.co/oauth/userinfo → preferred_username
```

设备码省掉了每台主机一个重定向 URI、mDNS 解析和“授权设备必须能访问机器人”这三个负担，也是两种流程里唯一会给刷新令牌的那个。令牌有效期三十天，刷新时轮换；它落在 `/var/lib/robot/hf-token`，`root:robot`、`0640`，不在 `robotd.toml` 里，因为那个文件会被 `robotctl configure`、全屏编辑器和“这台机器人改过什么”的报告打印出来。`account.login`、`account.status`、`account.logout` 由 `updaterd` 提供——它本来就有 HTTP 客户端、以 root 运行、也已经在写系统状态。

登录一次只允许一个：控制台和手机同时发起是常态，第二个调用返回 `BUSY`。设备码五分钟过期，`force` 用来替换一次卡住的尝试，而不是逼人先 `logout` 掉一个还能用的凭证。

## 中继：把本地信令接到公网

远程路径是一座桥，不是第二套设计：

```text
  rendezvous  ──SSE──►  relay task  ──ws──►  127.0.0.1:8443  ◄──ws──  webrtcsink
  (HTTP)      ◄─POST──  (in mediad)  ◄──ws──  signalling server      (producer)
```

中继在会合服务那边注册成 `producer`，在本地信令服务器这边注册成 `listener`；角色相反，因为对服务它就是机器人，对管线它只是一个来要会话的 peer。SDP 和 ICE 载荷保持不透明，但信封要翻译：一边是 WebSocket，另一边是 SSE 入、`POST /send` 出，还要维护双向的 peer/session id 表。所以准确说法是“带不透明载荷的翻译器”，不是纯中继。

租约是这套东西的命门。三十秒内没收到入站 `POST /send`，服务就驱逐这个 producer，因为半开的 TCP 连接可以安静地吞掉服务端推送好几分钟；中继按欢迎消息建议的十秒重发 `setPeerStatus`，并把值钳在 1 到 60 秒。`POST` 必须发生在 `GET /events` 之后，peer 是由流建立的，顺序不是偏好。重连退避 5 秒起、60 秒封顶、加约 10% 抖动，避免服务重启后整批机器人同时回来。

注册的 `meta` 里，`hardware_id` 是稳定身份键：同一账号下同值的旧 producer 会被驱逐，否则重刷的守护进程、复制的 SD 卡会永远多出一台机器人。鸭子用 SoC 序列号，退化时用 `/etc/machine-id`；仿真鸭用 `configd --simulated <serial>` 给出的 `sim-duck-a`。`kind = microduck` 让客户端不必开会话就能区分鸭子和 mini。

## 控制台与 App 是两条入口

局域网里，控制台由机器人自己提供：页面被 `include_str!` 进 `mediad`，`web.rs` 把信令端口替换进去。远程客户端取不到一个它连不上的机器人上的页面，所以远程版是 `pollen-robotics/microduck-console` 这个 Docker Space：README 里的 `hf_oauth: true` 创建 OAuth 应用并把 `OAUTH_CLIENT_ID` 放进容器环境，入口脚本把它替换进同一张页面。页面源码仍在本仓库，因为它要追信令协议和本项目的方法名；`scripts/publish-console.sh` 负责发布并检查占位符。

App 路径则是另一条互补的路。新拆箱的机器人没有 Wi-Fi，也就没有控制台可开，BLE 是唯一能到达它的传输，所以 `account.login/status/logout` 同时路由到本地、BLE 和 WebRTC；手机上装好网络之前，登录与配置都走蓝牙。需要像素时还有第三条路：`media.stream {url}` 让机器人主动向外开一条 `wss://` 推 H.264，不经过中继、不需要 ICE，会合服务只传指令不传画面。这样，“看”和“控”可以各自选传输，而不是被迫绑在同一条链路上。

## 还没做的部分

`teleop` 数据通道、多 peer 视频、TURN、逐包时间戳、会话同意与可见指示灯都还在清单上。TURN 是过 NAT 的必需品，但它消耗真实带宽，决定权属于会合服务而不是机器人。时间戳则是另一个容易被忽略的缺口：没有捕获时间，单目 SLAM 还能跑，视觉惯性一旦要跟 50 Hz 的 IMU 对齐就只能猜；RTP 时间戳只排序、不带绝对时间，需要 `abs-capture-time` 头扩展。最后是权限仲裁：手柄和远程 peer 同时驱动时，两个写者会以 50 Hz 交错进同一个槽，机器人谁的指令都不听。这是已知缺口，不是谜团；最便宜的答案是单写者令牌，先消除交错，再谈优先级。