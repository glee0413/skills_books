---
id: microduck/boot-recovery
title: 启动恢复网络
description: 本页讲机器人启动后守护进程起不来时，进程之外的定时器如何判定、把 current 换到 golden 并重启，以及为什么用观察而不是 OnFailure。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/boot-recovery-net.md
snapshotPath: source-snapshots/microduck/docs/design/boot-recovery-net.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/boot-recovery-net.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 启动恢复网络

机器人启动进了一个**守护进程起不来**的发布时，什么把它放回已知良好的版本。本页拥有启动截止时间及其判定、成员规则、`robot-rescue`、`golden` 链接与循环守卫。

## 它补的缺口

`updaterd` 在更新中从不重启自己，因为它是执行更新的进程。三层机制收窄代价，且都只在板子完全起来时运行：提交前 `self_test_updaterd`、回复后五秒延迟重启它和 `btd`、启动对账确认重启真的发生。

但能在运行中板子上启动的二进制，仍可能在**开机**时失败——网络没起、外设没枚举、单元顺序不同；而对账在 `updaterd` 启动时运行，预设一个能启动的 `updaterd`。`BootCounter::record_boot` 数的是 `updaterd` **启动**，所以不启动的 `updaterd` 不计数——永不变砖的保证恰好通过那个可能成为牺牲品的进程闭合。留在那里，板子在磁盘上有好发布、有武装的试验，却没有东西能执行。

## 部件与触发

`robot-boot-check.timer` 在每次启动一秒后触发 oneshot `robot-boot-check.service`，它运行 `scripts/robot-boot-check`（装到 `/usr/local/sbin`）观察，判定失败就交给 `scripts/robot-rescue`：把 `current` 换到 golden、记录、重启。`<install_dir>/golden` 由 `updaterd` 发布，`<state_dir>/rescued` 是 breadcrumb 兼循环守卫。

两个脚本都是 `/bin/sh`，都由 `install.sh` 与 `hooks/postinstall` **复制**到 `/usr/local/sbin`——与它们复制的 unit 同一决定。随发布载荷出厂的救援二进制会被它要救的发布弄坏；经 `current` 读取的救援，会把恢复路由到被恢复的东西上。

**触发是观察，不是 `OnFailure=`。** `OnFailure=` 看起来天然：systemd 在单元耗尽重启进入 `failed` 时精确触发。但它不适合这些单元：`btd`、`padd`、`configd`、`robotd` 都是 `Restart=always`；默认十秒五次限制下，每 5 秒重启的 `btd` 永远接近不了——它无限崩溃循环却从不进入 `failed`。让 `OnFailure=` 触发，等于为了让救援生效而让守护进程**放弃**。

观察改不了任何 unit，且能抓住永远重启者。脚本每 2 秒看成员，直到三者之一：**某个成员没起来**，立即交接；**所有成员连续 10 秒 `active`**，发布起来了——崩溃循环每次重启都重新进入 `active`，停不够久；**截止时间** `boot_deadline_s`，默认 60 秒。

Yocto 板上成员 16 秒内起来，所以普通启动约 25 秒判定。取 60 是因为审判靠重启次数——`updaterd` 每 10 秒重启、约 45 秒越过三次，更低会放过一个 `updaterd` 起不来的发布。脚本把值钳在 20–300 而非拒绝，因为 `Params::load` 拒绝的值会让每个守护进程退出，而 `robotd` 起不来正是要回退的原因。

## 判定与成员

判定只有两个条件，都是 systemd 试图运行却无法让它持续运行的正证据：`ActiveState` 是 `failed`；或 `NRestarts` 至少 3。其余一律不碰：操作者停掉的单元无重启；发布早于某单元时它未加载；等硬件的守护进程是 `active`；一次崩溃后恢复只留一两次重启。**假阴性让操作者多一次诊断，假阳性让好发布被丢掉。**

三种拒绝触发：`Conflicts=shutdown.target`——关机路上被杀掉的守护进程可能被记成 `failed`，否则一次时机不对的 `systemctl poweroff` 会让机器人重启进 golden；**运行时间守卫**——超过十分钟说明不是定时器启动的；oneshot **没有 `[Install]` 段**——两个安装器都读作"不要启用"，否则 postinstall 的 `enable --now` 会在更新中途跑一次回滚检查。

**成员规则**：一个单元只有在硬件缺失时**等待**、而不是退出，才能加入集合。那么成员不在意味着**二进制**坏了——架构错、缺库、panic、配置被拒——那正是回滚能修的。`robotd` 等电机总线；`updaterd` 无论如何都服务；`btd` 每 5 秒重试适配器；`configd` 提供 `system.*` 并报 `net.state=unavailable`；`padd` **不在集合里**，没有 robotd socket 时按设计干净退出。`btd` 入选是因为没有网络时 BLE 是唯一入口；`configd` 同理，`system.pin` 是 `btd` 拿 PIN 的地方。

## 救援与循环守卫

`robot-rescue` 读两个符号链接，**不解析任何东西**。它最可能救的是一个 `updaterd` 拒绝板上 `updater.toml` 的发布——那是操作者的文件，安装时保留，而发布可以改变它期望的内容；解析同一文件的救援，死于它正在治的病。

golden 是 `updater.toml` 里的一个版本（`ComponentConfig::golden`），`refresh_golden_links` 每次 `updaterd` 启动把它发布成 `current` 旁的链接：一次 `readlink`，没有东西可拒绝。**选 golden 不选 previous**：坏的是恢复路径本身时，previous 可能也坏。

`current` 已经是 golden 时它拒绝——守护进程是在承载长期保证的发布上失败，这不是发布故障，交换只会多一次重启，硬件故障就是这样变成重启循环的。交换用临时链接 `rename` 而非 `ln -sfn`（后者先删再建，留下无法 exec 的窗口）；`rename(2)` 不跟随链接但 `mv` 会，所以 GNU 写作 `-T`、BSD 写作 `-h`。`--reboot` 是 opt-in：交换在单元重启前不起作用，而站着的机器人会摔倒，由扶着它的人决定。

**循环守卫**由两件独立的事阻止"交换并重启"自行发生两次：`current` 已是 golden 时的拒绝；以及 breadcrumb，覆盖一次更新把 `current` 移离 golden 又失败。`record_rescue` 在下一次 `updaterd` 启动把它抄进更新日志后清除。

清除**在启动计数之前**运行，顺序承重：武装的试验会回退到 `previous`，而救援已走得更远到 golden；留着试验，`record_boot` 会在一次启动后把 `current` 移**离**救援选择，恢复网与永不变砖互相拆台。breadcrumb 是 `key=value` 而非 JSON，因为写者是在出问题的板子上跑的 shell 脚本；`journal::Breadcrumb` 每个字段可选，因为解析不了的 breadcrumb 是永不打开的守卫。

## 证据与未测试

**systemd 没有**：定时器是否在 `OnBootSec=1` 触发、`Conflicts=shutdown.target` 是否生效、`NRestarts` 是否如脚本所读，全都未验证；观察本身也没有——测试在第一次看时判定。恢复网是其他一切失效时也必须工作的代码，也最难测试；在此之前只能在实验板上验证。

决定是被测的：`xtask/tests/rescue.rs` 用 stub `systemctl` 问两个脚本每个问题；`board-test.sh` 在真实 ARM64 上覆盖安装器那一半。

证据有三：脚本日志；更新日志里的 `Outcome::RolledBack`，原因点名失败单元，`robotctl update log` 可见；以及 `robotctl version`。