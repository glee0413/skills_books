---
id: microduck/media-bringup
title: 媒体启动
description: 在 Radxa Zero 3W 上接通相机、硬件 H.264 与 WebRTC 的实测记录，含 MPP 权限陷阱、自建插件、旋转代价与 rkaiq 时序。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/media-bringup.md
snapshotPath: source-snapshots/microduck/docs/project/media-bringup.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/media-bringup.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 媒体启动

这篇是硬件观察记录而不是推断。`mediad` 需要硬件 H.264：软件编码不是“慢一点的选项”，而是**不存在的选项**——单靠 `jpegenc` 在这颗 SoC 上撑不住 640x480 30 fps，而 H.264 每帧更贵，还要和 `robotd` 的 50 Hz 回路抢四个 Cortex-A55。

## 板子上的既有事实

VPU 能编 720p H.264、码流有效（`avdec_h264` 干净解码，High profile level 4），但它经 **Rockchip MPP** 的 `/dev/mpp_service` 暴露，**不是** V4L2 M2M；所以 `v4l2h264enc` 不存在，`/dev/video*` 为空——后者也正好是“相机没接”的样子，都不算故障。GStreamer 来自纯 Debian trixie 的 1.26.2，`webrtcbin` 有，`gst-plugins-rs` 在任何 Debian 套件里都没有。内核必须是 `6.1.115-vendor-rk35xx`：相机 ISP 采集驱动和 VPU 节点都只在 Armbian vendor 分支上，一次把 `current` 内核拉回来的 `apt upgrade` 会同时拿走两者。

## 相机 overlay 与权限陷阱

插好的 CSI 相机在 overlay 启用前**既不产生 `/dev/video*` 也不进 dmesg**。坑在于 Armbian 把它装成 `radxa-zero3-rpi-camera-v2.dtbo`、**没有 `rk3568-` 前缀**，而板子跑 `overlay_prefix=rk3568`，于是 `overlays=` 里的词解析成带前缀的名字、加载器找不到、板子照常启动就是没有相机。文件必须先**镜像到带前缀的名字**再写进 `overlays=`；`configure_camera` 做这两步，且写进 vendor 内核的 overlay 目录。

`/dev/mpp_service` 到手是 `crw------- root root`（0600）。非 root 打不开，而 **`mpi_enc_test` 对它写个空文件并退出 0**——没有错误、没有日志，退出码什么都不能证明，文件大小才是证据。这一条制造了四个互相误导的结论，包括“Radxa 的 deb 只有解码器”。真相是 **MPP 插件无条件注册解码器，但注册编码器前会探测 MPP**，探测静默失败就把编码器从插件里省掉了：只列解码器说的是设备节点，不是插件，udev 规则装上之前 `gst-inspect-1.0 mpph264enc` 毫无意义。`scripts/setup-gstreamer.sh` 装一条 udev 规则（`99-robot-mpp.rules`，组 `video`，0660），单元配 `SupplementaryGroups=video`；用 `video` 而非 `robot`，因为内核设备节点不是我们有权重新定义的。

## 两个必须自建的插件

Rockchip MPP 不在 Debian 里，Radxa 用 GitHub Pages 的 apt 仓库发布，取包时**直接下载 `.deb`** 而不加进 `sources.list`——注意 `dpkg -i` 不解析依赖，闭包要自己凑。

`gstreamer-rockchip`（`JeffyCN/mirrors` 的 `gstreamer-rockchip` 分支，meson）给 `mpph264enc`；`gst-plugin-webrtc`（`gst-plugins-rs` 0.15.3，cargo-c）给 `webrtcsink`/`webrtcsrc`。0.14.5 是真正的下限——低于它缺一个远端描述与 ICE 处理之间的死锁修复，症状是客户端永远卡在“connecting”——0.15.3 只是更新。两者都在 [`microduck-gst-plugins`](https://github.com/pollen-robotics/microduck-gst-plugins) 里、arm64 runner 的 `debian:trixie` 容器中**原生**构建：不在板上编，也不交叉编译（GStreamer 会是第二个 C 依赖）。仓库必须**公开**，因为下载发生在 provision 和 `preinstall` 钩子里，那里没有 token。

装到 `/usr/local/lib/gstreamer-1.0` 后单元必须加 `Environment=GST_PLUGIN_PATH=/usr/local/lib/gstreamer-1.0`：GStreamer 默认不搜这个目录，而故意避开发行版目录是为了让 `apt` 无法替换插件。这条与 `SupplementaryGroups=video` 都极易忘，运行时表现却一样：编码器就是不存在，没有任何解释。

## 旋转的代价与 3A 的时序

相机装歪了四分之一圈，“在 tee 前加 `videoflip`”是错的：实测带 flip 时一次会话 5522 次 RGA 失败、丢 1565 帧、掉到 7–8 fps、SoC 97 °C 降频到 408 MHz；不带 flip 则 0 失败、约 30 fps。原因是 `mpph264enc` 把 UYVY→NV12 交给 2D 引擎几乎不花钱，而 `videoflip` 的输出 RGA 不认（`10000 is unsupport format`），MPP 只好**每帧软件转换**，CPU 打满、撞热限、全部降频。所以管线不旋转，只**上报**（`media.video`），由显示方自己转：控制台用 CSS transform，感知消费者折进本来就要做的重采样。`--flip-in-pipeline` 把旧行为留给负担得起的消费者。

`rkaiq_3A_server` 附着 ISP 后等**流启动事件**，且会错过已经发生的那次；在推流时重启它，就永远停在 `wait stream start event...`，没有统计回路、没有自动曝光，画面是绿的。更糟的是每次 `robotctl update apply` 都在推流下面重启它（preinstall 跑 `setup-rkaiq.sh`）。现在 drop-in 带着不变量：

```ini
ExecStartPost=-/bin/systemctl --no-block try-restart mediad.service
```

引擎一启动就把流在它后面弹一下，它等的事件于是还没发生。`try-restart` 不碰没有 `mediad` 的板子，`--no-block` 避免单元互等 job 死锁。手动救板的顺序就是全部技巧：

```bash
sudo systemctl stop mediad && sudo systemctl restart rkaiq_3A && sleep 2 && sudo systemctl start mediad
```

rkaiq 的 AE 还只在抓到流启动时收敛**一次**：它把曝光从 `600/1024` 推到自己的 `1589/1536` 然后停手，把画面压暗四倍也不再有反应。`mediad::exposure` 才是闭环：从 tee 的 raw 分支取平均亮度、每秒两次、目标 90，阻尼乘性步长按噪声顺序分给快门 600 行、模拟增益 11×、快门 1200 行、ISP 数字增益。硬快门上限是真实天花板——驱动对超过帧长的曝光是**拉长帧时间**，3500 行会悄悄变成 15 fps。所以 `setup-rkaiq.sh` 现在断言 `CommCtrl.Enable = 0`：不是引擎的 AE 无用，而是它的效果落在流启动那一刻，正好和 `mediad` 抢同一个控制。

## 编码器属性与一个词的模板

`mpph264enc` 的四个属性是管线决策而非可继承默认值：`profile` 设 `baseline`（WebRTC 的互操作底线是 Constrained Baseline，`h264parse` 会报 `constrained-baseline`）；`header-mode` 设 `each-idr`，否则后加入或丢了首包的 peer 永远解不出画面；`rotation` 在 alpha 板设 `180`，让编码器在硬件里做完整 CPU 一遍的事；`bps` 显式给目标。

真正的坑在一个词的模板上：`mpph264enc` 的 src 模板列了 `profile = { baseline, main, high }` 却漏掉 `constrained-baseline`——正是 WebRTC 要的那个。它只在编码器进入 `webrtcsink` 后发作：discovery 插入要求 `profile=constrained-baseline` 的 capsfilter，`h264parse` 在 caps 查询里剥掉 `alignment`、`stream-format`、`parsed` 但**不剥 `profile`**，于是空交集，失败在四个元件之外显现为 `videorate` 说“could not transform NV12 … in anything we support”，最后 discovery 丢掉 H.264、改谈 VP8、会话死在 `rtpvp8pay`，**没有一条错误提到 profile**。插件仓库因此打了一个改模板的单词补丁（`v3`），而 `mediad` 必须先把 GStreamer 日志和管线 bus 桥进 journal，否则每个媒体故障都是静默的。

预编码也不再是形状：`webrtcsink` 接受预编码 H.264 确实能工作，但它够不到不归它所有的编码器，拥塞控制便无法调码率、peer 的 PLI 也无法产生关键帧。现在 `mediad` 交原始 NV12，让它自建编码器并经 `encoder-setup` 配置。

设计见[远程 WebRTC](./remote-webrtc.md)，检测器与 `media.frame` 见 [NPU 启动](./npu-bringup.md)，空闲功耗见[空闲 CPU](./idle-cpu.md)。