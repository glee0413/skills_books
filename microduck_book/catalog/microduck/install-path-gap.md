---
id: microduck/install-path-gap
title: 安装路径故障
description: 四个连续漏到板子的安装路径 bug 暴露了钩子与产物检查的盲区，并引出真实产物安装测试、真实 systemd 演练和版本偏差对账。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/install-path-gap.md
snapshotPath: source-snapshots/microduck/docs/project/install-path-gap.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/install-path-gap.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 安装路径故障

四天内四个 bug 连续到达板子，全在安装路径上，418 个测试和 `board-test.sh` 一个都没抓到。由此得到的规则——**新装到板子上做的任何事都必须同时进钩子**，钩子是每次更新在每块板上唯一会跑的东西——已移居 `updater-design.md` §9.1，此后又被搞错过两次。

## 四次穿透

1. **`on_apply` 用一条命令重启多个单元。** `systemctl restart robotd configd` 只要任一单元未知就整体失败，且不会重启那个存在的单元。引入新守护进程的 release 于是什么都重启不了：单元随 release 到达，却没有东西安装它。真修法是让 **`hooks/postinstall` 安装 release 自带的单元**：引擎的 `[post_install]` 钩子在 `current` 移动后、重启前运行，此前只有 `scripts/install.sh` 复制过单元。
2. **产物里没有新单元。** 打包工作流用显式 `--include` 点名文件，单元加进了 `install.sh` 却没加进那里。
3. **产物里没有新二进制。** `cargo board --bins` 构建了 `btd` 和 `configd`，Package 步骤却没有暂存，`btd.service` 以 `203/EXEC` 失败——看起来像守护进程坏了，而不是产物不完整。它与 bug 2 同类同文件，还发生在为防 bug 2 而加的测试之后两个提交。
4. **重启列表存在板子上。** `[component.daemon.on_apply].units` 读自 `/etc/robot/updater.toml`，这是运维文件、`install.sh` 有意保留；在 `configd` 之前配置好的板子永远保留 `units = ["robotd"]`。它贵在两小时：更新报**成功**，`robotctl update apply` 报 `already_current` 什么都不做，旧代码继续应答。

## 重启集合必须来自 release

`engine.rs::units_to_restart` 从 release 的 `systemd/*.service` 派生集合，与配置里的名字取并集，再减去 `updaterd` 与 `btd`——两者成了 `NEVER_RESTART` 常量，因为那是守护进程的性质而非运维选择。

单元还比安装它的 release 活得更久。`postinstall` 有意不在回滚时撤销，这对回滚成立，对**降级到早于某守护进程的 release** 不成立：`ExecStart` 指向旧 release 没有的二进制，`203/EXEC` 失败，而它在重启集合里就让更新失败。`updater/src/orphan.rs` 现在拒绝这类候选，并点名单元、缺失二进制与绕行办法 `systemctl disable --now configd.service && rm /etc/systemd/system/configd.service`。它不在 preflight（看不到候选文件列表），而在解包后、swap 前；也不在 rollback 或 `select` 上运行——那些是有意后退，能拒绝的检查不能待在恢复路径里。

## 版本偏差是另一类问题

产物完整正确，错的是**同一时刻运行的那一对版本**。`main` 给 IMU 段加了 `consecutive_stale_blocks` 并据此发了 0.2.0，某个更早合并 `main` 的分支不发送该字段。`robotd` 起来得完美，驻留的 `updaterd` 却因缺字段拒绝它的回复；`RobotIo::health` 把无法解析的答复映射成 `Health::Unreachable`，门禁便对健康机器人报不可达并回滚好版本。修法是给新字段加 `#[serde(default)]`（毛病出在嵌套层，`ImuHealth` 与 `BusHealth` 现在在容器层携带它），并新增 `Health::Incompatible`。`LoopHealth`、`Battery`、`MotorThermal` 故意不加：这些是**测量值**，默认的零是旧发送方从未说过的谎。

其二：`robotctl` 是指进 `current` 的符号链接，`updaterd` 不是，release 一改 `API_VERSION` 两者必然不一致，失效的偏偏是 `robotctl update apply`。提议过的“只在客户端更新时拒绝 `hello`”被否决，因为版本递增并非都是加法。最终**把门禁整个去掉**：让不匹配对端出问题的是达不到的路由或移了位的参数形状，它们各自具名拒绝（`METHOD_NOT_FOUND`、`INVALID_PARAMS`）；前提是所有 params 类型拒绝未知字段，否则 v7 的 `ApplyOptions::from_dir` 会被 v6 忽略，运维以为在旁载目录而实际从配置源安装。

## 补上测试的四件事

CI 是最慢的一环，所以测试放在等待最便宜的地方：默认 `cargo test` 只跑进程内测试，解产物或驱服务的按需运行，需要产物的检查挂在 `check` 的 `xtask package` 步骤上，不新增 job。

1. **两个进程内测试**：`systemd-run` 改成与 `SYSTEMCTL` 一样可替换的常量，断言 `--on-active=5s`、每单元一次、两个单元都被点名；`reconcile::check` 用 `DUCK_RUNTIME_DIR` 这个接缝断言四种结局。
2. **真实产物安装**（PR #47）：`scripts/board-test.sh` 按 `_build-release.yml` 的 `--include` 列表打包解包，对着打桩的 `systemctl` 跑 `scripts/install.sh` 与 `hooks/postinstall`，十一条断言覆盖权限 644、`daemon-reload` 先于 `enable`、二次运行幂等。bug 3 现在由三行断言直接问：单元 `ExecStart` 的二进制是否在随它发布的产物里。
3. **`dev-push.sh` 里的板级检查**：比对每个守护进程发布的身份、该板 `current` 和本次构建的版本，`updaterd` 与 `btd` 轮询最多 30 秒。这是唯一端到端观察整条重启机制的东西。
4. **真实 systemd**：`scripts/systemd-test.sh` 让 systemd 作 pid 1，观测 `on_apply` 真的按主 PID 变化重启、延迟瞬态定时器真的替换 `updaterd`（子进程会待在将被杀的 cgroup 里，这正是用 `systemd-run` 的理由）、起不来的单元让更新失败并点名自己。它第一次运行就找到代码里的 bug：`self_test_updaterd` 没带 `--config`。

## 回滚失败的谎报与自愈

一个把机器人成功放回去的更新报告回滚失败，而 `RollbackFailed` 是设计里最严重的结局。原因不在回滚：`postinstall` 覆盖单元且有意不还原，当该单元又在“被回滚**到**的那个 release”的重启集合里，回退会重跑同一个重启并继承同一个失败。修法是**把交换与 apply 动作分开**；`Error::RollbackFailed` 保持原义，失败的 apply 动作被带进结果并以 `error` 记录：

```text
not healthy within 30s: …; the release was reverted, but restarting robotd failed: …
`Restart=` may have brought it back since — `robotctl health` says whether it did.
```

后一句原写作“所以这台机器人有东西停了”，错得足够频繁：每个守护进程都是 `Restart=always`，回退的重启常被 `Start request repeated too quickly` 拒绝；`restart_one` 现在用 `reset-failed` 清计数再试一次。

版本偏差本身也由代码关闭：每个守护进程发布自己在跑什么（`duck_ipc_proto::publish_identity`），`updaterd` 每次启动比对单元与活动 release 并重启陈旧者（`updater/src/reconcile.rs`）。唯一不修的是 `updaterd` 自己的偏差，空隙由 `engine.rs::restarts_owed` 补上；`btd` 的排除在结果上线那刻失效，两者都经 `systemd-run --on-active=5s`（`RESTART_AFTER_REPLYING`）重启。机制见[重启顺序](./restart-order.md)，进度见[路线图](./roadmap.md)。