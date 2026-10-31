---
id: microduck/install-dev
title: 开发板安装
description: 从刷机、provisioning 到让板子信任开发密钥并装下第一条分支构建的完整流程。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/install-dev.md
snapshotPath: source-snapshots/microduck/docs/robot/install-dev.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/install-dev.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# 开发板安装

把一块裸板变成能推分支的机器人。开发板信任团队开发密钥，所以谁构建的都装；客户机器人故意拒绝这些构建。开发构建没有任何放松：同样的签名与哈希校验、健康门禁、自动回滚，区别只在签名密钥——客户机器人双重拒绝它们，`allow_dev_keys = false`，且只有文件名以 `.dev.pub` 结尾的受信密钥才算开发密钥。

## 刷机与前置条件

用 Armbian imager 选 **Radxa Zero 3** 与 **Armbian 26.2.1 Minimal**。写入前在镜像工具里填 Wi-Fi、用户名和密码，省掉串口控制台；之后 `ssh-copy-id microduck@192.168.1.42`，因为 provisioning 会重启板子并自行重连，密码提示撑不过去。

还需要：板的 IP（镜像上的 mDNS 不可靠，`duckctl ip` 可经蓝牙问，路由器租约表是后备）、ssh 密钥登录、GitHub token（仓库私有期间发布产物拿不到）、本仓库克隆（开发公钥已提交在 `deploy/dev-key/team.dev.pub`，不用向人要）。

## 一条命令完成 provisioning

```bash
export DUCK_TOKEN=github_pat_replace_with_your_token
./scripts/provision-board.sh --pause-btd-on-pair --name <MY_COOL_ROBOT_NAME> microduck@192.168.1.42
```

它送上开发密钥、开始 provisioning、等过重启、流式打印日志，最后跑 `robotctl health`。`--pause-btd-on-pair` 在这里是默认：aic8800 射频在 `btd` 广播时无法建立**新** bond，该标记让 `robotctl pad pair` 在配对窗口停掉 `btd` 并给适配器断电重启，随后再启动；已有 bond 不受影响。

它是观察者而不是工人：provisioning 装了 systemd 单元，开机接着跑，Ctrl-C 不损失什么，日志可 `ssh -t microduck@192.168.1.42 'sudo tail -f /var/lib/robot/provision.log'` 接回。`--ref BRANCH` 用分支脚本做 bring-up 并在其上装该分支的 daemon；`golden` 仍是稳定版，因为它是启动恢复网络的兜底，用分支当 golden 会让坏分支拥有坏兜底。分支装不上或被健康门禁回滚，provisioning 即失败——开发板悄悄跑着稳定版是最难查的故障。`--local` 发送本克隆的 `provision.sh`，`--no-dev-key` 造一块只收正式版的板子。

## 配对的三种配置

先配一次手柄、读失败，再选：

| 现象 | 板子要什么 |
|---|---|
| 能 bond 也能驱动 | 不加参数 |
| 无法 bond；最后一步 SMP 不完成 | `--pause-btd-on-pair` |
| 暂停 `btd` 也无法 bond | `--weird-ble`（隐含暂停，并设 `Privacy = device`） |
| 能 bond 但反复 `PIN or Key Missing (0x06)` | 用错了：去掉 `--weird-ble`，只留暂停 |

最后一行最要紧：只需要暂停的板子加上 `Privacy = device`，bond 会立刻失效，比干脆配不上更难诊断；实测某地址下 `off` 加暂停稳定，`device` 在 45 秒里抖 46 次。改回只用暂停：`sudo sed -i 's/^Privacy = device/Privacy = off/' /etc/bluetooth/main.conf && sudo reboot`。任何 `Privacy` 改动后都要重新配对，因为存储密钥依赖地址。细节见[配对手柄](pair-gamepad.md)。

## 验证与首条分支

```bash
robotctl health
grep -c 'DEV BOARD' /var/lib/robot/provision.log
sudo robotctl update apply --ref main daemon
```

`1` 表示密钥真的落地；`0` 表示没落地，之后 `--ref` 会被拒绝，错误读起来像产物损坏——这个检查就是为了尽早抓到它。重刷后 ssh 拒绝连接，是因为主机密钥重新生成，`StrictHostKeyChecking=accept-new` 不覆盖“主机不新、密钥新”，用 `./scripts/provision-board.sh microduck@192.168.1.42 --forget-host-key`。provisioning 中的 Wi-Fi 切换可能换租约，脚本会同时用蓝牙问出最终地址并采用，前提是 `cargo` 与克隆都在、`btd` 已起来（首次约在第 2 阶段几分钟后），且它报的是 Wi-Fi 地址。

## 让已有板子接受开发构建

两半都要，只做一半仍然拒绝分支构建。省事做法是带密钥重跑安装器：

```bash
sudo DUCK_TOKEN="$DUCK_TOKEN" DUCK_DEV_KEY=/tmp/team.dev.pub sh /tmp/install.sh
```

它无论源文件名是什么都装成 `team.dev.pub`——`.dev.` 这一段才是开发密钥的分类依据，装成别的名字会被当作**发布**密钥。手工版：

```bash
sudo cp team.dev.pub /etc/robot/trusted_keys/team.dev.pub
sudo sed -i 's/^allow_dev_keys.*/allow_dev_keys        = true/' /etc/robot/updater.toml
sudo systemctl restart updaterd
```

token 要进 `updaterd` 自己的环境（shell 里 export 到不了 daemon）：写 `/etc/systemd/system/updaterd.service.d/token.conf` 里的 `Environment=GITHUB_TOKEN=...`，`chmod 600`，再 `daemon-reload` 与重启。客户机器人不该带 token——镜像里的全舰队凭据无法轮换——这也正是答案应该是公开仓库的原因。

## 无网络安装

板上已有发布时，走 daemon，带门禁与回滚：

```bash
sudo robotctl update apply daemon --from /media/usb/release
```

裸板（出厂或离线、还没有 daemon 可问）用 `updaterd`：

```bash
sudo /opt/robot/daemon/current/bin/updaterd install --from /media/usb/release
```

目录里要有 `<version>.manifest.json`、其 `.minisig`、产物及其 `.minisig`；签名、哈希、兼容性照查，`--from` 只改字节来处，不改信任什么。它一旦有发布在跑就拒绝，因为会强制关掉 `on_apply` 与健康门禁，那等于悄悄关掉自动回滚。唯一需要它的场景是板上 `updaterd` 太旧、装不上修“太旧”的那个版本：先 `sudo systemctl stop robotd`，再 `updaterd install --from ... --force`；`--force` 在 `robotd` 还应答时会被拒。更深的信任链与文件布局见 `deploy/README.md`。