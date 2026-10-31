---
id: microduck/updater-design
title: 更新系统设计
description: 本页讲清 Microduck 如何用签名产物、原子符号链接交换、健康门禁与多级回滚，把新软件送到机器人上而不把它变砖。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/updater-design.md
snapshotPath: source-snapshots/microduck/docs/design/updater-design.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/updater-design.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 更新系统设计

现场更新别人家里的机器人：绝不砖机、原子应用、自动回滚、产物签名。原文明确不做的同样重要：不做 OS/内核 OTA、车队管理、灰度与增量更新，模型是"最新版，所有机器人"。

## 通道、产物与信任

两个通道各有 manifest 与版本线：`daemon`（二进制）与 `model`（步态权重加配置），甚至不在同一主机，由可插拔 `source` 处理：`daemon` 来自 GitHub Releases（tag 形如 `daemon-v1.4.2`），`model` 来自 HF Hub；HF 不替我们签名，模型产物仍由 CI 用 minisign 签名。

每个发布是一个压缩 tar，如 `daemon-1.4.2.tar.zst`，含 `bin/`、`model/`、`version.toml` 和可选 `hooks/postinstall`。manifest 是签名过的小 JSON，带 `sha256`、`min_hw_rev`、`schema_version`、`min_supported`。`schema_version` 是**迁移上下文，不是兼容门禁**——判断 manifest 的引擎永远是上一版，若拒绝更高 schema，每次升级都不可投递；`min_supported` 才是强制下限，必须从第一版就在。

信任锚是**一组** minisign 公钥，不是一把：任一可信钥匙验过即可。丢钥匙可救：用现钥签更新来换钥；单把内置钥匙丢失则不可恢复。验证顺序：验 manifest 签名 → 下载 → 验 sha256 → 验产物签名；**未签名字节绝不被执行或解压到活动路径**。

## 状态机与原子交换

```text
preflight → 取 manifest/验签/兼容检查 → 下载 → 验哈希与签名
→ 解压到 staging → orphan 单元检查 → [preinstall hook]
→ rename 到 releases/<ver>/ → 武装启动计数 → 交换 current
→ [postinstall hook] → on_apply 重启 → updaterd --self-test
→ 健康门禁（轮询 robotd，30 s）→ 确认并 prune
```

布局让一次 `rename(2)` 就能原子完成：

```text
/opt/robot/daemon/
├── releases/1.4.1/   ← previous
├── releases/1.4.2/   ← new
├── current → releases/1.4.2
└── golden  → releases/1.4.1   ← 永不 prune，救援脚本读它
```

preflight 的五项都在任何下载或改动之前：**单飞锁**、**时钟合理性**（板子没有电池 RTC，时钟错会让 HTTPS 校验失败）、**机器人已停**（再问 `safeToRestart`）、**无活动远程会话**、**磁盘空间**。

## 两个不能中途重启的进程

`updaterd` 和 `btd` 都装在 daemon 产物里：前者正在执行更新，后者可能是请求进来的那条链路。所以 `on_apply` 重启发布携带的一切**除了这两个**。但"排除在本次重启外"不等于"跳过"——早期读成后者，两者就无限期跑旧二进制。`RESTART_AFTER_REPLYING` 在结果上线 5 秒后用瞬时单元重启：

```
systemd-run --on-active=5s --timer-property=AccuracySec=100ms -- systemctl restart <unit>
```

必须是瞬时单元：子进程在 `updaterd` 的 cgroup 里，会在重启父进程半途被杀；锁也须在 spawn 前释放。

这保护了本次更新，却没回答"新的能不能启动"：它若启动不了，恢复逻辑 `recover_on_start` 正好在失败进程内部，崩几次就放弃。所以提交前跑 `releases/<ver>/bin/updaterd --self-test`：加载 `/etc/robot/updater.toml`、构造引擎、在触碰状态前退出，10 秒上限；失败带 stderr 并回滚。进程外的最后防线见[启动恢复网络](./boot-recovery.md)。

## 健康门禁与回滚

新 `robotd` 须在每组件超时内清掉健康标志；硬挂起另有 systemd `WatchdogSec` 与启动时检查的**启动计数器**（跨两次启动未健康，就先问机器人再决定）。

**预算决定何时问，机器人决定是否回退。** 走到尽头说明没有 apply 确认过这次试验，常见原因是 apply 在门禁运行前被杀——比如发布的 `hooks/postinstall` 重启了 `updaterd`。所以还是三选一：healthy 提交、degraded 提交、其余回退。degraded 也提交，因为没有舵机供电的 `robotd` 在 golden 上同样失败，回退只会把硬件故障藏进软件变更。仍回退的是 `robotd` 不健康、不可达，或应答形状读不懂。

回退目标是 `current → previous → golden`；golden 永不 prune，是"两个都起不来"时的落脚点。

## 钩子：新装做的事，更新也要做

**一个发布只有在板子具备它需要的一切之后才算安装完成。** 文件或脚本放进发布目录都不等于安装；钩子是唯一在每块板、每次更新上都运行的东西，所以"这块板必须先有 X"属于它，而不是只跑过一次的 provisioning。

判断标准被做成机械问题：**`scripts/install.sh` 会不会写这个文件或跑这个命令？** 这是 grep 一个文件就能回答的，而一块不是全新的板子拿到的正好只有钩子做的事。原文记录了四次同形状的错：unit 只在产物里、GStreamer 只由 provisioning 安装、NPU 脚本打包未调用、登录提示只在 `install.sh`。共同点：**工作做完了，让工作到达板子的那一步被漏了**，而 diff 看起来完整。

配套规则：钩子步骤必须**幂等**且无事可做时**便宜**（预装 600 秒、后装 120 秒）；钩子调用的脚本必须被打包，依赖文件必须随它走；可选硬件缺失绝不致命，因为非零退出会回滚。

## 无人值守与冻结

`check_interval` 让常驻 `updaterd` 定时轮询，`auto_apply` 决定没有客户端时能装什么：`off`、`mandatory`（默认，只装被下限标记为强制的）、`all`（金丝雀）。普通发布等待，因为**机器人何时重启是主人的决定**。

无人值守还拒绝这台机器人已回滚过的候选。没有这个 guard，坏发布就是全队陷阱：检查 → 应用 → 门禁失败 → 回滚 → 等一个间隔 → 再来，每轮重新下载、写 eMMC，没有东西收敛。guard 叫 `known_bad`，取日志里每个版本的最新结果，所以将来成功会自清；它只作用于无人值守，显式 `update apply` 仍可重试。

签名只证明产物**来自我们且未被修改**，不证明它是**当前的**。**降级**已关闭：目标为"最新"时拒绝旧候选，`Target::Exact` 允许定向回退。**冻结**仍开放，当前只报告：`update.status` 带 `last_checked`，`robotctl health` 一周无应答就警告；签名 manifest 过期才是真防御，但要 CI 定期重签。

## 晋升与测试

发布**在 CI 里签名**。`release.yml` 在 `daemon-staging-v*` 上构建、打包、签名、用机器人自己的代码路径验证；`promote.yml` 把同一份字节复制到 stable 并重签 manifest，**晋升从不重建**。Tier 1 在 CI 无硬件跑机制：签名、哈希、兼容、降级、回滚目标、按组件的启动预算、状态保留、健康失败回滚、`kill -9`、并发单飞。Tier 1b 启动真的 `robotd` 走真的 socket，因为协议 crate 的往返测试看不见偏斜。Tier 2 是金丝雀真机。**人类决定是否晋升，机器每次都一样地回退、应用、验证。** 平台配置见[部署配置](./deploy.md)。