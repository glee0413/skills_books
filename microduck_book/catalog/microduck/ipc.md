---
id: microduck/ipc
title: IPC 契约
description: duck-ipc-proto 把方法、参数、服务归属与连接车道收进一个 crate，让每个守护进程与客户端说同一种 JSON-RPC。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: duck-ipc-proto/src/lib.rs
snapshotPath: source-snapshots/microduck/duck-ipc-proto/src/lib.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/duck-ipc-proto/src/lib.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# IPC 契约

`duck-ipc-proto` 是机器人服务与客户端之间的线缆契约。它有两个命名空间：`update.*` 是 `updaterd` 的 API，由 `robotctl`（以及后来的 `btd`）说；`robot.*` 是 `robotd` 的 API，**故意很小**——它就是 `updaterd` 判断一次更新是否安全、是否成功所需要的东西。

线上格式是 **JSON-RPC 2.0、一行一个对象（NDJSON）、走 unix socket**，分帧就是一个换行。进度以**没有 `id` 的通知**推送，所以中途重连的客户端重新订阅就能继续收到：

```text
→ {"jsonrpc":"2.0","id":1,"method":"update.apply","params":{...}}
← {"jsonrpc":"2.0","method":"update.progress","params":{...}}   (no id)
← {"jsonrpc":"2.0","method":"update.progress","params":{...}}
← {"jsonrpc":"2.0","id":1,"result":{...}}
```

依赖封在 serde、serde_json 与 semver：恢复路径上的每个服务都说这些类型，所以这里不能拉进 http、tar、crypto 或异步运行时。

## Call 把方法与参数焊在一起

方法与参数**永远**成对出现在 `Call` 里：用 `Request::call` 构造，用 `Request::as_call` 读回，因此不存在把某方法配上另一方法参数的可能——这正是这个 crate 要防的漂移。`Request` 在线上保留原始的 `method` 与 `params`，让服务端能区分“未知方法”和“参数解析不了”，再各自具名拒绝。

`API_VERSION` 现在是 47，任何不兼容改动都加一。规则写在常量旁边，而且只有一处：**加一不承诺任何方向的兼容**——v5 是加法、v4 不是，常量本身不区分；**没有任何守护进程因为版本号不同而拒绝调用**，真正让不匹配对端出问题的是达不到的路由或移了位的参数形状，它们各自在唯一服务不了的那次调用上具名拒绝；版本差异只被**报告**（`updaterd` 的 journal 与 `HelloResult::api_version`）。所以每次加一都有一段说明：v4 让 `system.authenticate` 成为 BLE 客户端的前置条件，v8 加了 `pad.input`，v40 是面板的 RGB 手电，v46 是 RAUC 的 A/B 系统更新，v47 是匿名使用数据的开关。

## socket 与身份

默认 socket 就是出厂单元的默认值，但每个守护进程都接受 `--socket` 覆盖（`updaterd` 另有 `robot_socket`）：`/run/updaterd.sock`、`/run/robotd.sock`、`/run/configd.sock`，以及各自独占一条流的 `/run/padd/pad.sock`、`/run/tofd/tof.sock`，和本地专用的 `/run/mediad/media.sock`。这些路径住在这里，是因为不止一个客户端要连，各抄一份迟早会各走各的。

每个守护进程把自己在跑什么写到 `/run/<service>/identity.json`。一个服务一个目录而不是共用一个，是两条理由逼出来的：`btd`、`padd` 跑在 `ProtectSystem=strict` 下，文件系统对它们只读，`RuntimeDirectory=` 是 systemd 给的那份授权；而 systemd 在单元停止时删掉该目录，所以停掉的守护进程不可能留下一份自称在跑的陈旧身份。`DUCK_RUNTIME_DIR` 只为一件事存在：让测试和笔记本上手工运行的守护进程能发布身份（那里 `/run` 属于 root，macOS 上根本没有）。

## Service 与 Lane

`Call::destination()` 回答“谁拥有这个调用的答案、占用连接多久”，`Service` 是 `Updater`、`Robot`、`Config`、`Pad`、`Tof`，**一个服务一条 socket 直连、没有 broker**。`Lane` 分四档：`Prompt`（守护进程查一下就好）、`Slow`（秒级，要联网或扫射频）、`Operation`（要多久都行，而且它改变机器人：更新、入网、配对）、`Stream`（从不回答，一直写通知）。

分档不是洁癖，是因为**每个服务一条连接一次只服务一个请求**。一条连接每服务，就会让所有调用排在最慢的东西后面，而客户端最先想到的两种顺序都会坏：`update.apply` 后接 `update.status`，状态行会等在守护进程几分钟内不会读的 socket 里；`update.subscribe` 后接 `update.apply` 更糟——订阅一直占着连接且不再读请求，apply 被写进没人读的 socket，从不运行、从不回复、也从不报错。按“占用多久”分组、每组一条连接同时解决两者；每服务每会话最多四条 socket，代价为零。反过来“每次调用一条连接”要求适配器知道调用何时结束，也就是要解析回复，而它**故意从不解析**。

## 授权、错误码与意图

`Call::is_mutating()` 就是 `updaterd` 授权的那一组：更新、入网、改名、重启、关机、配对手柄、装策略/检测器、装 OS、登录与登出账号。只读调用一律不设门，支持人员因此能检查一台无权改的机器人。`vetbook.share` 不在其中：它不改机器人上的任何东西，用 `robot` 组就能读的 token 去挡它只会在分享按钮前加一道 `sudo`。

错误码区分得让客户端能行动：`BUSY` 表示重试，`METHOD_NOT_FOUND` 与 `INVALID_PARAMS` 由解码器具名给出，`ROLLBACK_FAILED` 是更新失败**且**回滚失败（最严重的结局要立刻被看到），`NOT_SUPPORTED` 是“这块板子根本做不了这件事（比如没有 A/B 槽位的 `os.*`）”，与“没有这条路由”不同。`PROTOCOL_MISMATCH` 已退役但常量留着、编号不复用，因为跑着 0.5.1 及更早 `updaterd` 的板子还会用它回答 `hello`。

意图分两类，而 JSON-RPC 的两种消息族正好对上：**连续**意图（`robot.move`、`robot.head`）以**通知**发送，20–50 Hz、后写者胜、会过期，因此速率上没有回复流量，将来走 WebRTC 时也该走不可靠通道（重传一个 80 ms 前的摇杆位置比没有更糟）；**离散**意图（`robot.stop`、`robot.enable`）以**请求**发送并得到回答，因为调用者需要知道是否被接受、以及为什么没有。`robot.state` 是唯一的观测流，取代了原型里五条各自为政的通道——加一个字段从“改四处、还可能悄悄不一致”变成“改一个结构体，旧客户端忽略它不认识的东西”。

关节顺序也是协议：`JOINT_NAMES` 是左腿 5、颈/头/嘴 5、右腿 5，`JOINT_IDS` 对应 20–24、30–34、10–14；`RobotState::joints` 与 `targets` 是裸数字数组，叫不出 3 号位的客户端显示不了它，而 `BusHealth::missing` 带的是舵机上印着的 ID。`duck-control` 重导出这两张表，于是线上顺序与驱动顺序是同一份列表。

控制核心如何使用这些类型见[控制核心](./control.md)，服务切分见[系统架构](./architecture.md)，BLE 侧的路由子集见 [BLE 守护进程](./btd.md)。