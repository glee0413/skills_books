---
id: microduck/pair-gamepad
title: 配对手柄
description: 让 Xbox、DualSense、Pro Controller 进入配对模式并 bond，以及配对失败、掉线与栈差异的排查手段。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/robot/pair-a-gamepad.md
snapshotPath: source-snapshots/microduck/docs/robot/pair-a-gamepad.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/robot/pair-a-gamepad.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# 配对手柄

每只手柄只需配一次。之后 `padd.service` 从开机起驱动任何连上的手柄，没有要启动的东西，也不会随 ssh 会话死掉。LAN 上另一台机器的手柄可以改走 UDP，见 [UDP 手柄](udp-pad.md)；按钮做什么、怎么改，见 [robotctl 速查](cheatsheet.md)。

## 让它进入配对模式

Xbox 手柄是两次按键，第二次容易错：短按 Xbox 键开机（**长按会关机**），再按住顶部 USB-C 旁的小 **Sync** 键，直到 Xbox 灯**快速闪烁**——慢闪表示已开机但没在配对。DualSense 同时按住 Create 与 PS 直到灯条闪烁。Pro Controller（无品牌的 Switch 风格手柄，bluetoothctl 里显示 `Pro Controller`）按住顶部小 Sync 键，直到玩家灯来回扫。Pro 是经典蓝牙（BR/EDR），Xbox 是 LE，机器人对两者的配对顺序相反，`pad pair` 会自己判断。

## 配对与确认

```bash
sudo robotctl pad pair
robotctl pad status
```

不需要 MAC：机器人找处于配对模式的手柄并取第一个。手柄同时被 paired 与 *trusted*，才能在无人登录的重启后自己重连。两只都在配对模式会拒绝并打印地址；也可点名 `sudo robotctl pad pair 78:86:2E:BB:13:28`，这也是配机器人不认得的硬件的办法。**加第二只手柄不必先忘掉第一只**：已 bond 的手柄在每次扫描里，机器人优先选正在配对的那只；代价是没新手柄时重跑会等满整个搜索窗口，只想重修信任可加 `--timeout 5`。

插了 NFC 读卡器（USB 的 CLRC663 板，`/dev/ttyACM0`）的机器人，把写着地址的标签一贴即可：读到标签叫一声，配对成功再给另一种声音，拒绝则没有第二声。正在驱动的手柄优先，一次触摸只尝试一次，日志在 `journalctl -u nfcd -b`。

`pad status` 两行，因为两件事会分别坏：

```
pad     Xbox Wireless Controller 78:86:2E:BB:13:28  connected
padd    active — driving whatever pad connects
```

`paired but NOT trusted` 值得认识：现在能用，重启后不会重连，因为批准重连需要 agent，而开机时没有；重跑 `pad pair` 修好。

## 忘掉与重配

```bash
sudo robotctl pad forget 78:86:2E:BB:13:28
```

只删机器人这一半，手柄自己那半还在，所以再配必须让它回到配对模式，否则它带着本机已没有的密钥来，bond 被拒。Xbox 手柄只存一个主机 bond，半途失败会让它握着本机没有的密钥，表现得像板子坏了；一直失败就先配到笔记本再在那边删掉，释放它的 bond 槽——只把它放回配对模式并不总能做到。

## 配不上时：射频、Privacy、抓包

aic8800 射频在 `btd` 广播时无法建立新 bond，用 `--pause-btd-on-pair` 重新 provisioning，会留下标记 `/var/lib/robot/weird-ble`；之后 `pad pair` 自己停 `btd`、给适配器断电重启、配对、再启动 `btd`。已有 bond 不受影响。有些单位即使暂停也不行，要 `--weird-ble`（隐含暂停并把 `Privacy` 设为 `device`），但**先试暂停**：不需要它的板子加了会让 bond 后立刻抖 `PIN or Key Missing (0x06)`，从不成输入设备。

手工路径同样两步，断电循环不可省：

```bash
sudo systemctl stop btd
sudo bluetoothctl power off && sudo bluetoothctl power on
sudo systemctl start btd
```

只停 `btd` 会留下它的广播与配对代理给控制器的 IO 能力，手柄仍拒绝 bond；重启板子有同样效果。绝不要 `systemctl restart bluetooth`，这块板会直到重启都没有适配器。

每次都失败时看 `/etc/bluetooth/main.conf` 的 `Privacy`：应为 `Privacy = device`；`off` 可能让连接以 `le-connection-abort-by-local` 放弃。若抓包显示 `DHKey check failed (0x0b)`，那是相反故障，该试 `off`。改值前先抓 `sudo btmon -t > /tmp/btmon.log 2>&1 &`，两种都见过，答案不同。`setup-board.sh` 会修正取值，重启后生效。

## 掉线时看什么

```bash
robotctl monitor
```

按 `p` 打开 `padd` 正在用的手柄的原始 evdev 流：每条报告一根柱，满格 100 ms，超过 500 ms `robotd` 已把速度归零。**别处看不到这个**：`padd` 以 50 Hz 重发最后的摇杆值，射频停了在下游仍像活的驱动——`robot.state` 有新鲜意图，deadman 永不触发，机器人按没人给过的命令继续走。手柄静止时什么都不发，所以静默只有在驱动时才是证据，面板超过五秒会说“摇杆没动”。

要一段时间的结论，把脚本拷到板上：

```bash
scp scripts/pad-link-test.sh microduck@<board>:/tmp/
sudo sh /tmp/pad-link-test.sh --history
sudo sh /tmp/pad-link-test.sh
```

`--history` 读 `padd` 的 journal，立刻有答案；不带参数测两分钟，**全程要动摇杆**。每次掉线后跟内核原因：`0x08` 是监督超时（距离或干扰），`0x13` 是有人关了手柄。两块板表现不同时，用 `scripts/pad-stack-report.sh` 打印内核、BlueZ、控制器固件、LE 或 BR/EDR 以及手柄固件，`--fingerprint` 只留必须一致的值供 `diff`；`transport` 显示 `BR/EDR` 说明走的是内核经典 HID 路径，按钮编号不同。