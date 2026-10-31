---
id: microduck/deploy
title: 部署配置
description: 机器人镜像层面的配置与安装路径：三个脚本的分工、信任链、首次安装怎样走普通引擎，以及日志与版本的可恢复性。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: deploy/README.md
snapshotPath: source-snapshots/microduck/deploy/README.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/deploy/README.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 部署配置

`deploy/` 放属于**机器人镜像**而不是某个服务的配置：`updater.toml`（装到 `/etc/robot/updater.toml`）、`trusted_keys/`（发布公钥，信任锚）、`journald.conf.d/10-robot.conf`；服务单元留在各自服务旁边。

最后那条已由假设变成**实测**：`/var/log` 在这个镜像上是 zram，所以 `Storage=persistent` 拿到的确实是一个内存目录——熬过干净 `reboot`，断电就丢最近日志，而断电正是机器人被关掉的方式。因此 `/var/lib` 下的更新历史是唯一持久记录。

## 三种进场方式

开发板、仓库仍私有：从克隆一条命令，脚本会等板子、流式输出日志、以健康报告收尾（需要 `DUCK_TOKEN`）。

```bash
./scripts/provision-board.sh microduck@192.168.1.42
```

`--no-dev-key` 给只收发布版的板子，`--ref BRANCH` 从分支 provision，`--local` 发送本克隆的脚本以测试未推送的改动。`team.dev.pub` 提交在 `dev-key/` 而**不在** `trusted_keys/`：把它带上板子**就是**选择加入，绝不能随每台机器人出厂。它先把 dev key 从 `/tmp` 拷走，因为 `/tmp` 熬不过 provision 的中间重启；留在那里会产出一块“provision 干净、却悄悄不是开发板”的板子。仓库公开后普通用户无 token、无 dev key；仍下载而非管道执行，因为后半段在重启后跑。

## 三个脚本的分工

`setup-board.sh` 是 OS 级 bring-up（设备树 overlay、ONNX Runtime），很少变、需要重启；`install.sh` 安装签名 release，每次更新都跑——混在一起等于每次更新都重新讨论启动配置；`migrate-network.sh` 是唯一不会长久的：原厂镜像装 netplan 与 `systemd-networkd`，而 `configd` 经 D-Bus 驱动 NetworkManager，不迁移之前 `robotctl net status` 报 `Unavailable`，蓝牙也配不了 wifi。

`provision.sh` 只是编排者，持有跨重启的状态（token、dev key 路径、判断是否真重启过的 boot id）。无人值守的后半段可能坏成**循环**，所以两道保险：resume 单元在干活**之前**先禁用自己，最多一次自动尝试；`migrate-network.sh` 只在 NetworkManager 已接管 wifi 时才重跑（第一遍装的启动期兜底——`wlan0` 拿不到 IPv4 就恢复 netplan——由第二遍退役）。

## 首次安装与信任链

更新需要 updater，而 updater 随更新到达。出路是一个裸 `updaterd` 二进制，作为 `updaterd-bootstrap-aarch64` 资产发布（新板没有 `zstd` 去开 `.tar.zst`）。它随后跑**普通引擎**——同样的验证、解包、原子切换、写 journal——于是存储状态正好是常驻守护进程期待的，不存在会漂移的“只用于引导”的代码路径。期间 `on_apply` 与 `health` 强制关闭（单元在正在安装的 release 里），而 `updaterd install` 在 release 已 live 之后拒绝运行，所以不会在正常工作的机器人上关掉自动回滚。`--from <dir>` 从本地文件安装：离线与出厂路径。

开发板靠两件独立的事：`allow_dev_keys` 为假，且受信任的 key 只有文件名以 `.dev.pub` 结尾才算 dev key。只做一半会留下仍然拒绝分支构建的板子，报的却是像损坏 release 的签名错误。`DUCK_DEV_KEY` 两件一起做且先校验：文件必须存在、像 minisign 公钥、`updater.toml` 必须已有 `allow_dev_keys` 行可翻（该键是顶层的，追加会落进最后一个 `[table]`）。它无论源文件名都装成 `team.dev.pub`，因为 `.dev.` 中缀才是分类依据。

信任链四步：TLS 取脚本、配置与公钥（没拿到 key 之前什么都验不了）；TLS 取 bootstrap `updaterd`，**尚未验证**；该二进制用第一步的 key 验清单与产物；安装器再拿 bootstrap 的 `sha256` 与出自已验证产物的 `current/bin/updaterd` 比，摘要相等即证明第二步那个二进制是真的。其余东西——单元文件、journald drop-in、`robot.conf`——都取自**已安装**的 release。

## 更新策略与产物落点

`updaterd` 本来就是带定时器的常驻进程，不必加 cron。`auto_apply` 出厂设为 `mandatory`——只装 `min_supported` 说当前版本不可再用的；`all` 则每个可用 release 都装，启动时以 `warn` 记录。不要用 cron 或 systemd timer 驱动 `robotctl update apply`：它有意绕过 known-bad 守卫（运维重试可能已修好原因），定时器会继承这个绕过，于是一个坏 release 变成无尽的 apply/rollback 循环。也不需要维护窗口：preflight 在联网**之前**问 `robotd` 能否安全重启、是否有远程会话，正在走路的机器人会拒绝并在下个间隔重试。

```text
/etc/robot/updater.toml                 config; never touched by an update
/etc/robot/trusted_keys/release-*.pub   trust anchor
/opt/robot/daemon/releases/<version>/   the release tree
/opt/robot/daemon/current -> releases/<version>
/etc/systemd/system/*.service           every unit the release ships, copied out of it
/usr/lib/sysusers.d/robot.conf          creates the `robot` group
/var/lib/robot/updater/                 lock, update log, boot counter
/usr/local/bin/robotctl -> current/bin/robotctl
```

单元文件是**拷**出来而不是经 `current` 符号链接：经链接读，它们会在每次更新时在 systemd 脚下改变，回滚后 systemd 看到的还取决于最后一次 `daemon-reload` 时哪个 release 是 live。`robotctl` **是**符号链接，因为它是运维调用的工具，不是 systemd 缓存的文件。改动类操作仅 root：`allow_uids`/`allow_gids` 有意为空，`robot` 组成员只够**对话**。

## 日志与版本

每个守护进程往 **stderr** 记，systemd 收进 journal，级别由各单元的 `RUST_LOG`（`info`）定。服务日志只在配置持久化后熬过重启、断电必丢，由 `SystemMaxUse=200M` 封顶；**更新历史**在 `/var/lib/robot/updater/update-log.jsonl`，熬过重启也熬过断电，限 200 条——它住在引擎的 `state_dir`，每条追加都 `fsync`，重写走临时文件加 rename 并对父目录 `fsync`（`updater/src/journal.rs`），所以“装过什么、结果如何”在 journal 易失的机器人上也活着。要持久服务日志就装这里的 drop-in 再 `sudo systemctl restart systemd-journald`，用 `journalctl --list-boots` 验收——代价是日志落到 eMMC。

版本永远有**两个答案**：`updaterd` 不能在更新中途重启自己，所以更新后几秒内运行中的二进制合法地落后于已安装的 release，只报一个版本的工具有必然误导；滞后超过那几秒就是故障（`restart-order.md` §7）。`robotctl version` 同报两者并标出不一致，且在 `updaterd` **下线**时也工作，`--json` 给支持包同样内容。版本有四个可恢复处：启动时以 `warn` 写的第一行（版本、revision、`exe` 路径、pid——`exe` 告诉你进程来自哪个 release 目录）、`robotctl version`、每个二进制的 `--version`、各 release 里的 `version.toml`。`revision` 由 `DUCK_REVISION` 在构建时编入（笔记本构建诚实报 `rev unknown, not a CI build`），绝不运行时读 git——出厂机器人没有仓库。

从零开始的短流程见[开发板安装](./install-dev.md)，引擎本身见[更新系统设计](./updater-design.md)，装不进产物与钩子的 bug 见[安装路径故障](./install-path-gap.md)。