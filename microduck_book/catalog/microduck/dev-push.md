---
id: microduck/dev-push
title: 开发推送
description: 用一条 scripts/dev-push.sh 在本地编译、签名并经 ssh 装到开发板，跑的是完整门禁的普通更新。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/dev-push.md
snapshotPath: source-snapshots/microduck/docs/robot/dev-push.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/dev-push.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# 开发推送

`scripts/dev-push.sh` 把“改一行、看机器人跑”压成一条命令：从仓库克隆里为板子交叉编译、签名，再经 ssh 安装。增量构建约一分钟，比 push 加一次 CI 快得多。下面都是这条命令的开关。

## 一次性准备

三件事，然后不用再管。第一，板子必须是[开发板](install-dev.md)：产物用团队开发密钥签名，客户机器人会像拒绝 `--ref` 一样拒绝它。第二，开发签名密钥放在 `~/.duck-keys/team.dev.key`（CI 签分支构建所用密钥的私钥一半，`DUCK_DEV_SECRET_KEY` 可改路径）。第三，能交叉编译的工具链：`cargo install cargo-zigbuild --locked` 与 `brew install zig`；或者什么都不装，每次加 `--docker`，只需要运行中的 Docker daemon，代价是启动更慢，适合还没有板子的时候。

## 一次推送做了什么

```bash
scripts/dev-push.sh --name duck-c51b
```

或 `export DUCK_ROBOT=duck-c51b` 后直接 `scripts/dev-push.sh`；也可 `scripts/dev-push.sh microduck@192.168.1.42` 跳过无线电。名字路径先用蓝牙问机器人的 `net.status` 拿地址并缓存，只有缓存不可达才回到无线，所以换 DHCP 租约、重刷或换网络都不用心疼。ssh 用户默认 `microduck`，`DUCK_BOARD_USER` 可改。

脚本交叉编译整个 workspace，打包成与发布相同的产物，用开发密钥签名，复制到板上 `~/duck-sideload`，在板上通过 `robotctl update apply --from` 应用，最后等每个 daemon 报出新版本：

```
==> building 0.5.1-dev.local.1763400000.g7fc1444 for the board (zigbuild)
==> signing with /Users/you/.duck-keys/team.dev.key
==> 0.5.1-dev.local.1763400000.g7fc1444 is live on microduck@192.168.1.42
    [ok] robotd
```

`updaterd` 与 `btd` 在应答五秒后才重启，这两行会晚到。`[--] padd published nothing` 不是失败，停用的 daemon 和无相机的板上的 `mediad` 也这样；`[--] tofd published nothing` 说明版本早于 `tofd` 发布身份，再推一次即可，而不是传感器缺失。版本号带推送时间戳，同一棵脏树连推两次也不会撞。

**这是普通更新**：签名、产物哈希、兼容性、健康门禁、自动回滚全部执行，起不来的构建会被回滚。故意回退也是常规命令 `sudo robotctl update rollback daemon`。想看推送过程，在第二个终端先开 `ssh ... 'journalctl -f -u robotd -u configd -u btd -u padd'`，或只跟 `-u updaterd` 看每个阶段与门禁；二进制没 strip，panic 带完整栈帧。

## 验证与容器构建

```bash
scripts/dev-push.sh --dry-run microduck@192.168.1.42
scripts/dev-push.sh --docker microduck@192.168.1.42
```

`--dry-run` 完成构建、签名、复制，以及除切换外的全部检查：签名、哈希、兼容性、解包、确认没有已装 unit 指向本构建缺失的二进制。`current` 不动，daemon 不重启。`--docker` 不需要 zig、`cargo-zigbuild`，也不需要从板上拷 libudev；Apple Silicon 上容器目标即宿主，x86 上走模拟，脚本会说明。两种模式各有 `target/`，来回切换要全量重编。想看某 daemon 的 `debug!` 行，用 drop-in 覆盖 `RUST_LOG=info`：

```bash
sudo mkdir -p /etc/systemd/system/robotd.service.d
sudo tee /etc/systemd/system/robotd.service.d/log.conf > /dev/null <<'EOF'
[Service]
Environment=RUST_LOG=debug
EOF
sudo systemctl daemon-reload && sudo systemctl restart robotd
```

drop-in 在 `/etc`，能活过之后每次推送，用完记得删。

## 低于 0.5.0 的板子

`apply --from` 需要 API version 7，从 0.5.0 才有。更旧的 `updaterd` 无法被要求使用它，会拒绝，而不是偷偷从配置源安装。用一次无门禁的交付：

```bash
scripts/dev-push.sh --bootstrap microduck@192.168.1.42
```

它停掉 `robotd` 并放弃那一次的健康门禁，之后每次推送都是普通命令。

## 常见失败

- `no dev signing key at ...`：板上会像验证正式版一样验签，必须有 `team.dev.key`。
- `cargo-zigbuild is not installed`：装工具链加 zig，或改用 `--docker`。
- `no libudev.so.1 on <board>`：首次推送要从板上拷库来链接 `padd`；重刷后链接错误就 `rm -rf ~/.cache/duck-cross/aarch64`，下次会重新取。
- `preflight check failed: SideloadDir: ...`：`updaterd.service` 有 `PrivateTmp=yes`，它的 `/tmp`、`/var/tmp` 与你的 shell 不是同一个，别把目录放那儿。
- `verification failed: signature did not verify ...`：通常不是产物坏了，而是板子不是开发板。板上跑 `grep -c 'DEV BOARD' /var/lib/robot/provision.log`，`0` 表示密钥没落地。
- `could not reach <name> over Bluetooth`：先 `duckctl scan`；不在列表里就是关机、超出范围或已连到手机，直接给地址即可。
- `the release is live but not everything is running it`：切换成功且过了门禁，但有 daemon 还在旧二进制；`robotctl health` 的 `units` 块点名，`journalctl -u updaterd -b | tail` 找 `restart scheduled`。

设置项：`DUCK_ROBOT`、`DUCK_BOARD_USER`、`DUCK_PIN`、`DUCK_BOARD_CACHE`、`DUCK_BOARD`、`DUCK_DEV_SECRET_KEY`、`DUCK_SIDELOAD_DIR`、`DUCK_CROSS_SYSROOT`。它故意不做任何溯源：版本带时间戳而非 tag，签名用客户机器人拒绝的密钥，也不发布，所以别人装不到你刚跑的东西。