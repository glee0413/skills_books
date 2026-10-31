---
id: microduck/update-over-ble
title: BLE 更新
description: 从手机经 BLE 触发机器人更新的实测记录：路由早已具备，真正的缺陷在连接复用、进度分片和客户端超时语义。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/update-over-ble.md
snapshotPath: source-snapshots/microduck/docs/project/update-over-ble.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/update-over-ble.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# BLE 更新

蓝牙更新路径大部分早就铺好，只是没人真正开过。开一遍后找到一个让“启动更新、看着它”变成“机器人静默地从未执行”的缺陷、`updaterd` 里两个小问题，以及一层值得打出来的客户端表面。状态是 **shipped, not yet run on a board**：下面全由测试覆盖。

## 已经能用、没有重造的部分

路由子集早已覆盖读与触发：`hello`、`update.*` 的 check/apply/status/subscribe/log/listInstalled，以及 `robot.health` 到 `robotd`，没有新增方法。

**apply 本来就推自己的进度。** `updaterd` 的 `run_mutating` 在回复前就往收到 apply 的连接写 `update.progress`；`btd` 把上游每一行泵进会话而不读它；`duck-btctl` 打印无 id 的行并继续等。所以进度在没有订阅时也到达了 BLE 客户端，`duck-btctl.md` 那句“apply 在自己的连接上到结束前是静默的”已被更正。**中途重连也没丢**：`updaterd` 按组件保留最新 `Progress` 向新订阅者重放，`update.status` 从缓存快照回答并补上活的阶段。

## 三个缺陷

**一条长调用让整个会话失声（`btd`，已修）。** `Pool` 原本每个服务每会话一条连接，而两个守护进程都是一条连接一次只服务一个请求。于是 `update.subscribe` 之后的 `update.apply` 被写进 `stream_progress` 已停止读取的 socket：从未运行、从未回复、也从未报错。主人点了“更新”，机器人什么都不做，也找不到错误。`update.apply` 接 `update.status` 是温和版——机器人在更新，轮询却超时。现在调用按“占用连接多久”分组；这是手机 App 无法绕开的改动。

**进度是拿消防水管对着 20 字节的管子（`updaterd`，已修）。** 源报告它写出的每个 HTTP chunk（一个产物有几千个），每个订阅者都为全部付费。一行进度约一百字节，在 `btd` 的 20 字节帧底线下一行要五六条通知，客户端落后时 `btd` 又丢行，于是手机看到的百分比是任意子集，进度条从 12 跳到 61 再跳回 34。现在整百分点最多一条、每秒最多四条，在产生数字的引擎里合并（`robotctl update watch` 拿到同一条流），被压掉的百分比在下载结束时补发。

`update.check` 曾阻塞在引擎锁上（`updaterd`，已修）：`ipc.rs` 的头注释写着只读请求用 `try_lock`，好让 `status` 与 `subscribe` 在更新中仍可回答，而 `check` 没遵守；在 apply 期间问它要等几分钟，在手机上与“机器人不回了”无法区分。现在它立刻答 `BUSY`，`update.pin` 同样。

## 回退从手机可达

`update.rollback` 与 `update.select` 原本被拒，现在都路由；`update.pin` 与 `update.resetToGolden` 仍拒。`apply` 本来就路由且后果更重——从网络安装从未在这块板上跑过的代码；rollback 与 select 移向昨天跑过的 release、不下载任何东西，并同样受门禁与自动回退约束。引擎的自动回退只覆盖过不了健康门禁的 release，而主人拿手机要处理另一种：装得上、过门禁、然后**表现更差**——走起来不稳的步态、不再重连的手柄；除了人没有东西会回退它，而人手里只有手机、没有 ssh。两个都开而不只 `rollback`，因为 `update.listInstalled` 已经路由：能列出每个 release 却不能选，是奇怪的那一半。`pin` 是最有意思的拒绝：错的 `select` 距撤销只差一个 release，且机器人会说自己当前在哪个；被误触 pin 住的机器人会拒绝之后每一次更新并自报“已是最新”。

## 客户端必须遵守的约定

**超时是“静默多久”而不是总时长（`duck-btctl`，已修）。** 固定预算要么切断正在工作的更新，要么陪一台死机器人等到天亮；而有用的信号已经在到达——每条进度通知都是“机器人还在干”的证明。现在更新的静默预算三分钟，那是一次合法的最长间隔（post-install 钩子），不是一次更新的最长耗时。App 继承原则而非代码。

**守护进程 apply 回复后约五秒链路会断。** 这不是缺陷而是顺序在工作，但每个客户端都必须预期它，且机器人**预告过**的断线不能被读成更新失败。顺序是：`update.apply` 回复结果（那就是答案）；约五秒后 `btd` 重启、连接断开（[重启顺序](./restart-order.md) §1）；重连后读 `update.status`，`last_attempt` 带着结果，所以错过第一步回复的客户端仍能报告。

**`from_dir` 经蓝牙保持开放，是有意的。** 它指机器人上的目录，对手机无意义、对台架有用；过滤它意味着 `route.rs` 按参数而不是按方法决策，而检查参数正是 `btd` 不做的事。preflight 已拒绝真正会咬人的情况，写在这里让下一个人找到的是一个决定而不是疏漏。

## 工具与未完成

`duck-btctl` 现在有 `version` 与 `update` 的 `check`、`apply`、`status`、`versions`、`log`、`rollback`、`select`、`watch`——和 `robotctl update` 同一批词。参数从 `duck_ipc_proto` 的类型构造而不是手写 JSON：`update.apply` 的目标是外部标记枚举，`--ref` 与 `--version` 是**不同的 JSON 形状**，错的形状只得到一个无从下手的解析错误。进度按事件一行打到 stderr。

**这些都还没在板子上跑过。** 测试看不见手机上看到的东西：进度在真实链路上是否平滑、apply 的回复是否在 `btd` 重启前到达、每个服务第四条 socket 在 Zero 3W 上是否有代价。**没有取消**：半途中断的更新比慢的更糟。**手机没有自动更新开关**：`deploy/updater.toml` 有意不把客户机器人纳入无人值守重启。**没有加密**：`app-path-design.md` §8.1 拥有它，而本页关于“射频范围内的对端能做什么”的每个结论都假设它仍关着。

命令细节见 [duckctl 使用](./duckctl.md)，设备端路由见[手机 BLE 配置路径](./app-path.md)，部署配置见[部署配置](./deploy.md)。