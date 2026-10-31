# 开发板、开发推送与仿真

在 Microduck 上开发有三条从快到慢的路：在仿真里跑同一批守护进程、把本机构建直接推给一块开发板、或者等 CI 构建完再用分支标签安装。三条路共用同一套更新机制和健康门禁，区别只在“身体”和“信任的签名钥匙”。这一章按从板子到仿真的顺序走一遍，命令见 [开发板安装](../../catalog/microduck/install-dev.md)、[开发推送](../../catalog/microduck/dev-push.md)、[模拟机器人](../../catalog/microduck/simulation.md)、[仿真设计](../../catalog/microduck/sim-design.md) 和 [开发板速查](../../catalog/microduck/cheatsheet-dev.md)。

## 开发板只是换了信任的钥匙

开发板信任团队的 dev key，所以它会安装团队里任何人构建的东西；客户机器人则明确拒绝这些构建。除此之外没有任何放宽：签名、哈希、兼容性、健康门禁、自动回滚全都一样跑。唯一的差别是哪把钥匙签的，而这正是把开发构建挡在客户机器人之外的东西——对方同时有两道限制：`allow_dev_keys = false`，以及一把公钥只有文件名以 `.dev.pub` 结尾时才被归类为 dev key。

这条边界值得反复说，因为“开发模式”很容易被理解成“跳过验证”。它不是。一个用 dev key 签名的本机构建，和从网络下载的正式版本走同一条验证路径，只是验证的公钥集合不同。

## 从空白板到能推分支

先用 Armbian imager 刷 **Radxa Zero 3** 的 **Armbian 26.2.1 Minimal**。写入前在 imager 的配置里填好 Wi-Fi 和用户名密码，板子首次启动就会入网、能直接 ssh，省掉一次串口。然后把自己的 ssh 公钥放上去，因为后续流程会重启板子并自己重连，密码提示撑不过去：

```bash
ssh-copy-id microduck@192.168.1.42
```

从本仓库的克隆里执行两件事：导出访问 release 资产用的 GitHub token，然后运行配置脚本。

```bash
export DUCK_TOKEN=github_pat_replace_with_your_token
./scripts/provision-board.sh --pause-btd-on-pair --name <MY_COOL_ROBOT_NAME> \
  microduck@192.168.1.42
```

`--pause-btd-on-pair` 默认加上，是因为 aic8800 射频在 `btd` 广播时无法让手柄建立**新的** bond。这个标志留一个标记，`robotctl pad pair` 在配对窗口里停掉 `btd`、给适配器断电再上电，然后重新启动它；已有 bond 不受影响。板子有三种配置，靠“配一次手柄、看失败方式”来选：

| 现象 | 板子需要 |
|---|---|
| 手柄能 bond、能驱动 | 什么都不加 |
| 手柄不 bond，SMP 最后一步不完成 | `--pause-btd-on-pair` |
| 暂停后仍不 bond | `--weird-ble`（隐含暂停，并加 `Privacy = device`） |
| 能 bond 但立刻闪断，报 `PIN or Key Missing (0x06)` | `--weird-ble` 用错了：去掉它，只保留暂停 |

最后一行是陷阱：`Privacy = device` 用在只需要暂停的板子上，会得到一个立刻失效的 bond，比“干脆配不上”更难诊断。改过 `Privacy` 之后必须重新配对，因为它改变了存储密钥所依据的地址。

配置脚本会送 dev key、启动 provisioning、等重启、流式打印日志，最后停在 `robotctl health`。判断板子是否真的成了开发板，有一条可检查的证据：

```bash
grep -c 'DEV BOARD' /var/lib/robot/provision.log
```

输出 `1` 才是；`0` 说明钥匙没落地，之后 `--ref` 会被拒绝，错误看起来却像“发布损坏”。

## dev-push：改一行到机器人跑起来

第一次推送前准备三样：板子是开发板、dev 私钥在 `~/.duck-keys/team.dev.key`（或用 `DUCK_DEV_SECRET_KEY` 指过去）、有一套能给板子构建的工具链。可以装 `cargo-zigbuild` 和 `zig`，也可以每次加 `--docker`，只需要一个运行中的 Docker daemon。

```bash
scripts/dev-push.sh --name duck-c51b
export DUCK_ROBOT=duck-c51b
scripts/dev-push.sh
```

名字就是 `duckctl scan` 列出的那个。脚本通过蓝牙问机器人自己的 `net.status` 要地址，然后缓存；只有缓存地址不可达时才回到射频，所以换 DHCP 租约、重刷或换网络都不用改命令。一次推送大约一分钟，输出长这样：

```text
==> building 0.5.1-dev.local.1763400000.g7fc1444 for the board (zigbuild)
==> packaging
==> signing with /Users/you/.duck-keys/team.dev.key
==> copying to microduck@192.168.1.42:/home/microduck/duck-sideload
==> applying on microduck@192.168.1.42
==> checking every daemon is running it
    [ok] robotd  [ok] configd  [ok] padd  [ok] updaterd  [ok] btd  [ok] mediad
```

这是一次普通更新：签名、哈希、兼容性、健康门禁、自动回滚全在。构建起不来会被回滚，板子回到原来的版本；想主动回去也是普通命令 `sudo robotctl update rollback daemon`。`updaterd` 和 `btd` 在 apply 回复五秒后才重启，所以那两行会晚一点到；`[--] padd published nothing` 不是失败，它也可能是被停用或没有摄像头的板子上 `mediad` 的样子。

`--dry-run` 会构建、签名、复制，并做完除切换之外的所有检查，板子继续跑原来的版本。`--bootstrap` 只用于第一次推送到低于 0.5.0 的板子，因为 `apply --from` 需要 API v7，而旧 `updaterd` 不会接受这个调用。几个常见错误：没有 dev key、没有 `cargo-zigbuild`、第一次推送找不到 `libudev.so.1`、以及把 sideload 目录指到 `/tmp`——`updaterd.service` 有 `PrivateTmp=yes`，它看到的 `/tmp` 不是你复制进去的那个。

## 仿真：同一批 daemon，换一个身体

`robotd --sim host:port` 把伺服总线换成 `duck_control::sim::RemoteIo`：每个 tick，关节位置、速度和 IMU 从 TCP socket 进来，策略的目标再发回去。接缝以上——50 Hz 回路、策略、安全、跌倒检测、运动学、里程计、整个 IPC 面——全是机器人跑的代码，而且分辨不出差别。`tofd --sim` 从同一个模拟器取 8×8 深度帧，`mediad --sim-camera` 取渲染出来的头部相机图像。`configd` 和 `updaterd` 也照常运行，所以一只仿真鸭有序列号、名字和一个能从句网外到达的 Hugging Face 账号。

身体那一半在 [`microduck_rl`](https://github.com/pollen-robotics/microduck_rl) 的 `duck-body` 里：一个进程、一个窗口、同一场景里 N 只鸭子，用训练时的 BAM 执行器模型。需要本仓库、一个带 venv 的 `microduck_rl` 检出，以及——如果你在非 Linux 上还要相机——两个 Homebrew formula：`gstreamer` 和 `libnice-gstreamer`。第二个容易被漏掉：Homebrew 的 `gstreamer` 把 `libgstnice.dylib` 链接进一个它并不依赖的独立 formula，缺了它，管线、相机、会合注册都正常，直到第一个消费者要 pad，会话才死在 GStreamer 线程里。

最常用的命令：

```bash
scripts/duck-sim            # 打开 MuJoCo 窗口，鸭子站起来
scripts/duck-sim status     # 健康状态，是否站立
scripts/duck-sim drive      # 前进 8 秒（参数 vx vyaw，默认 0.15 0）
scripts/duck-sim ctl health # 任何 robotctl 命令，指向这只鸭子
scripts/duck-sim monitor    # 关节、IMU、ToF、摇杆
scripts/duck-sim log        # robotd 的日志
scripts/duck-sim down
```

`up` 和 `boot` 的区别在守护进程跑在什么下面。`up` 是普通进程、你的用户、每只鸭子一个 pidfile，几秒起；`boot N` 把每只鸭子放进一个 `systemd-nspawn` 容器，用真实 unit 文件跑真 systemd，第一次要建 Debian 13 rootfs，约三分钟。做控制回路、策略、IPC 或客户端，用 `up`；碰 systemd、更新器、provisioning，或者要多只鸭子互相说话，用 `boot`。有两个 bug 就是 `boot` 抓到的：一个 daemon 的用户不存在，unit 根本没启动——这是 `up` 看不见的一类。

## 假身体与假无线电

`--sim` 不是 `--fake`。`robotd --fake` 是一个什么都没有的机器人：没有物理，位置完美回声，什么都不会倒，用于单元测试和完全不需要身体的本机工作；`--sim` 是数字孪生，两者互斥。

多只鸭子时脚本会启动 `duck-ether`，一个在容器之间传 chorale BLE 信标的假射频。它故意是**坏**的：按对丢弃和延迟，因为完美射频会藏住真实射频造成的 bug——四只鸭子会瞬间、无损地互相看见，于是每次都收敛到同一个声部，而现场报告是“有时什么都不发生，有时两首不同的歌”。

```bash
duck-ether --discovery 90 --loss 0.3 --seed 3
```

`--discovery` 是“从上线到被注意到”的延迟，按 pair 计算，因为不对称才是分裂合唱团的原因；`--seed` 让 flaky 可复现。相机是按鸭子 opt-in 的（`DUCK_SIM_CAMERAS=a` 或 `a,c`），因为渲染一帧要 12 毫秒，而步进四只鸭子的物理只要 0.3 毫秒；四路相机就是大半个核。实时系数很重要：守护进程的回路按墙钟走，低于 1.0× 不只是看着慢，策略在驱动一个比它预期移动更少的机器人，根本平衡不了；鸭子不会变慢，它们会在 45 Hz 健康门禁上变成 unhealthy，容器形态里更新器还会开始回滚。

## 速查：出问题时先看哪里

`sudo robotctl update apply daemon` **不带 `--ref`** 装的是 stable 通道的最新版，在开发板上通常是降级。它会在板子已经有一个新 daemon 的 unit 时，让旧发布的 `ExecStart` 指向一个不存在的二进制，重启失败，然后回滚——门禁是对的，但那条命令看起来像最自然的选择。要留在开发通道就用 `--ref main`。

更新后如果“修复明明装了却没生效”，先看每个 daemon 实际在跑哪个 release：

```bash
robotctl health
```

`units` 块每个 daemon 一行，标出启动它的 release；和已安装版本不一致时会警告并点名该重启谁。`robotd`、`configd`、`padd` 在更新中重启，`updaterd` 和 `btd` 在回复五秒后重启；`updaterd` 是唯一不会自己修自己的，必要时 `sudo systemctl restart updaterd`，但更该先读日志问为什么。

想在本机用手柄驱动板子，`padd` 是普通客户端：先停掉板子上的那个，转发 socket，再从克隆里跑。

```bash
sudo systemctl stop padd
ssh -L /tmp/robotd.sock:/run/robotd.sock microduck@192.168.1.42
cargo run -p padd -- --socket /tmp/robotd.sock
```

## 仿真的边界

仿真对“守护进程及其客户端”几乎完全可信：IPC、`robotctl`、控制台、更新器、chorale、策略站立行走、建图。它不能告诉你任何驱动里的事：Dynamixel 总线、BLE 射频、相机 ISP、NPU、硬件编码器都不存在，也没有被建模。拿一周的真实 bug 去对照这张清单——一个 `videoflip` 让编码器丢掉零拷贝路径、损失 22 fps；3A 引擎错过 stream-start；自动曝光收敛一次就停；INT8 检测头的分数塌成两个值；伺服总线丢读——孪生一个都抓不到。这不是设计缺陷，是边界；硬件仍然是驱动唯一真实的地方。