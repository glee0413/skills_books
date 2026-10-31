# IPC 契约：JSON-RPC、意图与状态

七个进程之间没有共享内存，也没有中心总线。手机从 BLE、`robotctl` 从 ssh、浏览器从 WebRTC 数据通道发来的请求，最后都变成同一组 JSON-RPC 调用，落到某个服务的 Unix socket 上。这一章看传输为什么是 Unix socket、消息为什么长这样，以及意图与状态为什么用两种消息表达。类型定义的精读在 [IPC 源码](../../catalog/microduck/ipc.md)。

## 为什么是 Unix socket，而不是本机端口

每个服务拥有一个 Unix socket，客户端直接连接。服务只有个位数，加一个 broker 只会多一个会失败、又会和恢复路径冲突的组件。不用 `127.0.0.1` 上的 HTTP，关键不在性能，而在访问控制和故障方式：

- **文件系统权限就是免费的授权。** socket 设成 0660、归一个专用组，只有组内进程能连；换成 TCP 端口，板上每个用户都能连，得另建一层认证才能回到同等安全。
- **`SO_PEERCRED` 能拿到对端的 uid、gid、pid。** 它同时用于审计（“谁触发了这次回滚”）和强制执行：socket 的组决定谁能*说话*，`allow_uids` / `allow_gids` 决定谁能*改动机器人*，且只管变更类调用。只读调用故意不设门禁，支持人员必须能检查一只他无权修改的机器人。
- **“绑错接口”这一整类 bug 不再存在。** 把服务绑到 `0.0.0.0` 等于把固件更新控制暴露到网络；在 Unix socket 上这个错误无法表达。

没用 D-Bus，是因为同一套消息类型还要走 BLE 和 WebRTC，普通 serde 结构能过去，D-Bus 类型不能；D-Bus 只用在操作系统强制要求的地方，比如 BlueZ 和 NetworkManager。也没选 HTTP/WebSocket：协议需要服务端主动推进度，用 HTTP 就得“POST 调用 + WebSocket/SSE 通知”两套机制，全放 WebSocket 又多了握手且丢掉 `curl`。

## 线上格式：一行一个 JSON 对象

传输是 JSON-RPC 2.0，一行一个对象（NDJSON），framing 用 `tokio_util::codec::LinesCodec`，消息体是普通 serde 结构。一次调用和它的推送长这样：

```text
→ {"jsonrpc":"2.0","id":1,"method":"update.apply","params":{"component":"daemon"}}
← {"jsonrpc":"2.0","method":"update.progress","params":{"component":"daemon","phase":"verifying"}}
← {"jsonrpc":"2.0","method":"update.progress","params":{"component":"daemon","phase":"health_gate"}}
← {"jsonrpc":"2.0","id":1,"result":{...}}
```

没有 `id` 的消息是通知，不期待回复。标准协议带来现成的请求/响应关联、错误对象，以及形状刚好合适的通知——进度和事件流本来就该是通知。

所有跨进程调用都异步、都带超时，没有例外。对端可能已经死了；socket 关闭或沉默是正常答案。只有一处例外：`media.frame` 在本地 socket 上回答一个 JSON 头，紧接着跟原始像素字节。一帧约 1.8 MiB，它故意不进 WebRTC 控制通道，也不进任何路由。

### 一个服务一个 socket

| 服务 | socket |
|---|---|
| `updaterd` | `/run/updaterd.sock` |
| `robotd` | `/run/robotd.sock` |
| `configd` | `/run/configd.sock` |
| `padd` | `/run/padd/pad.sock` |
| `tofd` | `/run/tofd/tof.sock` |
| `mediad` | `/run/mediad/media.sock`（另有 `:8080`、`:8443`） |

这些路径写在 `duck_ipc_proto::socket` 里，因为 `robotctl` 和 `btd` 都要连其中好几个，路径各写一份一定会漂移。`padd` 和 `tofd` 的 socket 放在 `/run/padd/`、`/run/tofd/` 下，因为那是各自 unit 的 `RuntimeDirectory=`——在 `ProtectSystem=strict` 下，这是进程唯一被允许创建文件的地方；unit 停止时 systemd 会删掉目录，残留的 socket 不可能活得更久。每个 daemon 还在 `/run/<service>/identity.json` 发布自己实际在跑的版本。

## 意图：连续与离散

客户端发意图，不发关节命令。意图分两类，JSON-RPC 的两种消息族刚好对上：

- **连续意图**：`robot.move`、`robot.head`、`robot.pose`、`robot.mouth`。以通知发送，20–50 Hz，最后写入者获胜，并且会过期。每次回复都是浪费：20 毫秒后就被覆盖的值没什么可说。以后走 WebRTC 时，它们属于不可靠通道——重传一个 80 毫秒前的摇杆位置比没有更糟。
- **离散意图**：`robot.stop`、`robot.enable`、`robot.init`、`robot.relax`、`robot.do`、`robot.look`。以请求发送并等待回答，因为“被拒绝了，原因是……”是调用方必须知道的事。

单位只声明一次：弧度与弧度每秒，机体坐标系，右手系，x 向前、y 向左、z 向上，正 `vyaw` 左转。原型曾经让每个新消费者靠 `--imu-z-rotation-deg` 一类开关自己试出方向；把约定写进协议，等于删掉了整类参数。

`robot.enable` 的 `toggle` 字段是个小例子：手柄 Start 让机器人自己翻转状态。若由客户端维护“开/关”信念，它会在 `robot.relax`、关机流程或任何一侧重启后漂移，Start 就会每隔一次按不动。

## 状态：一次订阅，之后只有通知

状态走反方向。客户端发 `robot.subscribe`（可带 `hz`），得到确认，然后持续收到 `robot.state` 通知直到断开。确认里放的是**进程生命周期内不变**的东西：走路与站立策略文件名、技能列表、`unavailable` 说明为什么没有策略在驱动；这些每秒重复五十次没有意义。

抽帧在服务端按订阅者做：仪表盘要 10 Hz，数字孪生要 50 Hz，各自付成本，谁也拖不慢控制回路——回路只往有界缓冲发布，从不等待。这一条流取代了原型五个私有通道（二进制帧、JPEG、UDP 命令、maploc、`/state.json`）；过去加字段要改四处，现在是一个结构体，旧客户端忽略不认识的字段。

同一瞬间的相机帧、关节角和深度格点要能对上，所以 `robot.state` 和 `tof.frame` 都带 `t_ns`，同一个 `CLOCK_MONOTONIC`、纳秒。相机与 ToF 在机体坐标系里的位姿由 `robot.state.frames` 给出，完整骨架由 `skeleton` 给出，客户端不必自己背一份运动学。

## 连接会等多久：Lane

每个服务在一条连接上一次只服务一个请求。若每个服务只开一条连接，两个最自然的顺序都会坏：`update.apply` 后问 `update.status`，状态请求排在一条几分钟没人读的 socket 后面，客户端超时而机器人没事；先 `update.subscribe` 再 `update.apply` 更糟，订阅一直占着连接不读请求，apply 被写进没人读的 socket——不执行、不回复、不报错。

解法是按“会占住连接多久”分组，每组一条：`Prompt`（查表即答）、`Slow`（秒级，走网络或扫射频）、`Operation`（要多久就多久，且会改变机器人）、`Stream`（永不回答，只写通知）。每个服务每个会话最多四条连接，有界且便宜。调用归哪个服务、走哪条 lane 是调用的属性，不是传输的属性，所以写在 `Call::destination()` 里。

## 版本：一个整数，但不在握手处拒绝

`API_VERSION` 当前是 47，任何不兼容改动或纯新增都会递增；从 v5 的 `pad.*` 到 v47 的遥测开关，清单一直写在它的文档注释里。规则很直白：**递增不承诺任何方向的兼容**，只说明“这两个对端不是一起构建的”。安装路径保证一块板上的二进制来自同一个发布，这才是兼容性的真正来源。

关键决定是：**没有 daemon 因为版本号不同而拒绝调用**。`updaterd` 曾经在 `hello` 上做精确比较并拒绝，理由（递增不承诺兼容）成立，结论却不成立：真正弄坏对端的是*一条它没有的路由*或*一个挪了位置的参数*，两者都会在具体调用上具名拒绝。握手门禁却对所有调用开火，包括本来能服务的调用，以及用来结束版本不齐的 `update apply`。

现在拒绝的是更窄的东西：这个方法这一版没有，返回 `METHOD_NOT_FOUND` 并点出方法名；`params` 里有这一版不认识的成员，返回 `INVALID_PARAMS` 并点出成员名——所有参数类型都 `deny_unknown_fields`。后者不是洁癖：旧 daemon 静默忽略 v7 的 `ApplyOptions::from_dir`，会让操作者以为在旁加载目录、daemon 却从配置的源安装——沉默比拒绝危险。

代价要说清楚：不同发布的两个对端仍不能互换，形状变过的方法会在那个方法上失败，只是不再在握手上失败。更新后的几秒里这没有成本，因为 `robotctl` 是指进 `current` 的符号链接，会立刻跟到新发布。`hello` 仍返回 `api_version`、`daemon_version` 和编译进去的 `revision`，差异被记录、被报告，但不被拒绝。

## duck-ipc-proto：让错误无法表示

协议 crate 的价值不在“共享结构体”，而在把错误变成写不出来的东西。`Call` 把方法和参数绑成一对，请求只能由 `Request::call` 构造、由 `as_call` 读回，因此不可能把方法 A 和参数 B 拼在一起。`Response::ok` / `err` 负责信封，`code` 把规范错误码和应用错误码分开：`BUSY` 该重试，`NOT_SUPPORTED` 是板子根本做不了，`PERMISSION_DENIED` 是“去找管理员”，对客户端意味着不同的动作。

同一个 crate 里还有那些“属于协议而不是实现”的常量：`JOINT_NAMES` 与 `JOINT_IDS` 决定线上向量第 3 个分量叫什么、`BusHealth::missing` 里那个 ID 对应哪条腿；`POLICY_OBS_LEN = 61`、`POLICY_ACTION_LEN = 14` 是与策略发布者的约定；`ROBOT_MODEL` 用来拒绝为别的机器人发布的策略；`UPDATE_MAX_SILENCE_SECONDS = 600` 由 `updaterd` 执行，客户端按它放大等待预算，两边读同一个数就不会互相矛盾。

依赖只有 serde、serde_json 和 semver。这不是极简主义，而是恢复路径的要求：每个服务都要说这些类型，包括 `robotd` 死掉时仍须应答的那些，所以不能拉进 HTTP、tar、加密库或异步运行时。“v2 加了 revision、v4 加了 BLE 认证、v19 的策略命名空间”这些历史，也全写在 `API_VERSION` 的文档注释里——协议的唯一权威说明，和代码放在同一个文件。