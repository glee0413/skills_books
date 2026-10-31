---
id: microduck/ipc
title: IPC 契约
description: duck-ipc-proto：Unix socket 上的 JSON-RPC 2.0 / NDJSON，意图与状态。
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

`duck-ipc-proto` 是机器人所有服务与客户端之间的 wire contract。它只依赖 `serde`、`serde_json` 和 `semver`，不引入 HTTP、tar、crypto 或 async runtime，因此连恢复路径上的 `btd`/`updaterd` 也能安全依赖它。

## 传输

每个服务拥有一个 Unix socket，协议是 **JSON-RPC 2.0，一行一个 JSON 对象（NDJSON）**。请求/响应用标准 `id` 关联；进度和事件用没有 `id` 的 notification 推送。一个连接可以持续接收订阅流，例如 `robot.state`、`update.progress`。

```text
→ {"jsonrpc":"2.0","id":1,"method":"update.apply","params":{...}}
← {"jsonrpc":"2.0","method":"update.progress","params":{...}}
← {"jsonrpc":"2.0","id":1,"result":{...}}
```

## 类型

`Call` 枚举把方法与参数绑定在一起，避免“方法 A 配上方法 B 的参数”这种错误。`Request::call` 构造请求，`Request::as_call` 读取请求。`Request`、`Response`、`Error`、`HelloParams`/`HelloResult` 以及各命名空间的 `*Params`/`*Result` 都在这个 crate 里。

命名空间按守护进程划分：`robot.*`（robotd）、`update.*`/`policy.*`/`account.*`（updaterd）、`net.*`/`system.*`/`pad.*`（configd）、`media.*`（mediad）、`tof.*`（tofd）。所有服务说同一套类型，客户端不需要为每个 daemon 写不同协议。

## 版本规则

`API_VERSION` 是整数（当前 47）。版本号变化**不代表任何方向的兼容承诺**，它只说明两个 peer 不是同一个 release 构建的。旧版本不会被握手拒绝；真正拒绝的是缺失的 route（`METHOD_NOT_FOUND`）或未知参数（`INVALID_PARAMS`），而且只拒绝那一个调用。这样一次更新不会因为握手版本不一致而让所有调用都失败。

新增方法/命名空间通常仍会 bump，例如 v5 的 `pad.*`、v9 的 skill intents、v10 的 `robot.sound`、v11 的 `tof.stream`、v14 的 chorale、v15 的 `setMode`、v16 的 `update.show`、v23 的 `account.*`。规则是：bump 记录“这两个 peer 不是一起构建的”，不是“你熟悉的东西没变”。

## 鉴权

Unix socket 的权限就是第一层授权；服务还会用 `SO_PEERCRED` 读取调用方 uid/gid/pid，用于审计和 `allow_uids` 检查。BLE 客户端还需要先通过 `system.authenticate`。