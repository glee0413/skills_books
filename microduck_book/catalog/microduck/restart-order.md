---
id: microduck/restart-order
title: 重启顺序
description: 本页给出每条移动 current 的路径上哪个单元在第几步重启、启动时 updaterd 按什么顺序恢复，以及如何据此诊断版本偏斜。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/restart-order.md
snapshotPath: source-snapshots/microduck/docs/design/restart-order.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/restart-order.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 重启顺序

这份文档存在，是因为"哪个守护进程在什么时刻重启"曾被三份文档用三种方式回答，而答案决定一次版本偏斜如何诊断。原文声明：一切从代码读出，每一步点名拥有它的函数；别处的叙述性注释若与此页冲突，注释才是 bug。

## 八个守护进程与重启集合

一个发布携带八个守护进程——`robotd`、`configd`、`btd`、`padd`、`netpadd`、`mediad`、`tofd`、`updaterd`——每个都 `ExecStart` 一个 `current/bin/` 下的路径，链接一移就全部过时。`robot-boot-check.service` 不算其中之一，更新绝不能重启它：它问的正是"这次启动的发布是否起来了"，中途运行等于拿回滚检查去照一群合法重启中的守护进程；它没有 `[Install]` 段，这就足以排除。

| 单元 | 更新中 | 回复后约 5 秒 |
|---|---|---|
| 六个普通守护进程 | 是 | — |
| `updaterd` | **从不**——它正在执行更新 | 是 |
| `btd` | **从不**——它可能是更新链路 | 是 |

两半是同一决定，测试断言 `NEVER_RESTART` 与 `RESTART_AFTER_REPLYING` 是同一集合；**没有东西被留到重启**。

**什么算更新启动的单元**：带 `[Install]` 段的 `systemd/*.service`，判定在 `engine.rs::has_install_section`。用规则而非名单，因为 `hooks/postinstall` 与引擎曾对无 `[Install]` 的单元互相矛盾。集合是 `units_shipped`（发布自带单元并上 `on_apply.units`）减 `{updaterd, btd}`，今天为 `configd, mediad, netpadd, padd, robotd, tofd`。配置名单是**追加**，所以 `padd` 会被重启，尽管配置没提过它。每个单元单独 `systemctl restart`，批量命令在任一单元未知时整体失败。

## `update apply` 的步骤

第 8 步之前没有任何东西碰活动路径：

1. preflight：时钟、机器人已停、无活动会话。
2. 取 manifest、验签、通道/钉住/降级/兼容检查。
3. 再 preflight，查磁盘。
4. 下载到 `releases/.staging-<ver>/dl/`。
5. 验 sha256，再验产物签名。
6. 解压到 `releases/.staging-<ver>/root/`。
7. **`hooks/preinstall`**（cwd 是 staged 树）：装 ONNX Runtime、跑 `setup-gstreamer.sh`。
8. `rename` 到 `releases/<ver>/`。
9. 武装启动计数（`pending.json`），**在交换前**。
10. 交换 `current`。
11. **`hooks/postinstall`**：启动新发布的单元。
12. `on_apply`：逐个 `systemctl restart`。
13. `releases/<ver>/bin/updaterd --self-test`。
14. 健康门禁：每 500 ms 轮询 `robotd`，最多 30 秒。
15. 确认计数，prune。
16. 释放锁，安排延迟重启。
17. 回复。
18. 约 5 秒后：重启 `updaterd`、`btd`。

第 11 步起任何失败都回滚：交换回去、对旧发布重跑 `on_apply`、确认计数、记日志；第 1–10 步失败时旧发布仍在跑。第 2 步也可能结束流程：manifest 指向已装版本时报 `already_current`，不下载不交换，但会把运行着别的东西的单元列进 `stale` 并安排重启——所以对最新机器人的 `apply` 惰性，对守护进程与已装发布不一致的机器人不惰性。

**第 11 步**先装 `sysusers.d` 账号（账号先于单元），再把**所有** `systemd/*.service` 覆盖到 `/etc/systemd/system/`，包括 `updaterd.service` 与 `btd.service`；`daemon-reload`；对带 `[Install]` 的单元 `enable --now`。`--now` 是**启动**，对已运行单元是空操作，所以不重启那两个；但它会启动板子从未有过的单元——这正是钩子的意义，也意味着**新守护进程会启动两次**：这里一次，第 12 步再一次。除单元或 sysusers 安装失败外，钩子错误只是警告；`btd` 在无线电未出现的板子上合法失败。

**第 13 步**：`updaterd` 不重启自己，所以一个起不来的替换二进制本来会在提交后的下次启动才被发现，而恢复逻辑住在失败进程内部。新 `updaterd --self-test` 加载配置、构造引擎、在触碰状态前退出，10 秒上限；失败带 stderr 并回滚。没有 `bin/updaterd` 的组件自动通过，且仅当 `on_apply` 是 restart 时运行。

**第 16–18 步**：

```
systemd-run --on-active=5s --timer-property=AccuracySec=100ms -- systemctl restart <unit>
```

必须是瞬时单元而非子进程，否则它在 `updaterd` 的 cgroup 里，重启父进程时被半途杀掉；锁必须在 spawn 前释放，因为 fork 复制所有 fd；只在 `Applied` 与带 `stale` 的 `already_current` 时欠重启，回滚不欠；所有单元都走定时器。失败只记日志：一次成功的更新不因重启没排上而报失败，代价是守护进程在旧二进制上待到下次启动。

## 其他转换

`select`、`rollback`、`reset-to-golden` 共用 `transition_to`：武装、交换、`on_apply`、门禁、失败回退；不跑钩子、不自检。`select` 与 `apply` 欠延迟重启，两个回退不欠；失败 apply 与计数回退也不欠，因为 `updaterd`/`btd` 从未被重启，仍属于被返回的发布。显式回退会把 `robotd` 等移回去却把两者留在前面，下一次 `updaterd` 启动时由双向对账自愈——`updaterd` 自己除外。跳过钩子也意味着从不删除单元文件：降级会留下指向旧发布没有的二进制，失败的重启让转换失败。

## 启动与恢复

systemd 从 `multi-user.target` 启动，`robot-boot-check.timer` 一秒后检查；守护进程间无排序，除 `padd`/`netpadd` 在 `robotd` 后（建议性）与 `btd` 在 `dbus` 后。这块板 `hci0` 约 73 秒才出现，所以 `btd` 重试适配器。

`updaterd` 启动：以 `warn` 记身份行（含 `exe` 路径，说明实际来自哪个发布）；加载配置与钥匙；构造引擎；`--self-test` 返回；然后 `recover_on_start`，**在 serve socket 前**：`clean_staging`；`record_rescue` 把救援记录抄进日志、**清试验**、删 breadcrumb，**故意在 `record_boot` 前**（救援已比试验走得更远）；`refresh_golden_links`；`record_boot`；对 `boots >= 2` 的试验轮询 `robotd`，只有既非 healthy 也非 degraded 才回退到 `previous`、缺失则 golden，并重跑 `on_apply`（**所以计数回退会重启 `configd`、`padd`、`robotd`**）。之后 `reconcile_running_units`；`--check-only` 在此返回，注意它**执行**恢复与对账。试验只在 apply 被中断于第 9 与第 15 步之间时存在，第二次启动才回退；以上每步都预设一个能启动的 `updaterd`，否则交给[启动恢复网络](./boot-recovery.md)。

## 对账与诊断

`systemd-run` 成功只说明建了定时器。每个守护进程启动时发布 `/run/<service>/identity.json`（含 `exe`，来自 `/proc/self/exe`，穿过 `current`），`RuntimeDirectory=` 在停止时被删除。对账比较发布值与活动发布；`updaterd` 从不在这里重启自己，停掉的单元保持停掉，没发布身份的不算 stale；比较方向无关，所以也覆盖被回滚留在 `current` 前面的发布。

诊断：更新后几秒 `updaterd`/`btd` 落后是预期；其他守护进程持续不一致说明重启没生效且对账没修好；`updaterd` 持续落后用 `apply daemon` 或 `systemctl restart updaterd` 修。`robotctl health` 的 `units` 块打印每个进程来自哪个发布；手工读：

```bash
cat /run/configd/identity.json; readlink /opt/robot/daemon/current
```