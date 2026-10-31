---
id: microduck/contributing
title: 开发与测试约定
description: 本页记录 Microduck 的构建测试命令、Rust 版本上下限、仓库分层、命名与提交约定，以及签名发布的两步晋升流程。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: CONTRIBUTING.md
snapshotPath: source-snapshots/microduck/CONTRIBUTING.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/CONTRIBUTING.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 开发与测试约定

这是"改守护进程"的入口；只想使用机器人的人应该回到 [Microduck 是什么](./readme.md)。原文一开头就把两条约束摆出来：Rust 需要 **1.89+**，而且这个数字既是下限也是**上限**。

## 版本上限为什么存在

Yocto 镜像 `microduck_yocto` 用 OpenEmbedded 发行版自带的 Rust 从源码构建每个发布，wrynose 上是 **1.94.1**。因此代码不能要求更新的特性，哪怕 stable 已提供更好的 API 并把旧 API 标记废弃——CI 的 `-D warnings` 会把这种废弃变成错误，0.15.1 就是这样变成了需要 1.99、无法打进镜像的版本。对应的检查命令是：

```bash
cargo +1.94.1 check --workspace
```

## 测试：不需要硬件、网络和 Docker

```bash
cargo test --workspace
```

这条命令能通过，就说明工作区是健全的。Linux 主机需要先装 CI 也装的 C 库，因为 `padd` 通过 `gilrs` 绑 `libudev`，而 `mediad` 的管线是 `cfg(target_os = "linux")`，在 Mac 上根本不编译 GStreamer：

```bash
sudo apt-get install -y libudev-dev libgstreamer1.0-dev
sudo apt-get install -y libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev
```

macOS 上一条 `cargo test --workspace` 就够，原文记录的数字是 **942 个测试通过**。只有 ToF 驱动自己的两个测试不跑：`vendor/platform.c` 通过 `linux/i2c.h` 访问总线，`build.rs` 只在 Linux 目标编译它，而 `tofd --fake` 仍能提供帧。

值得单独记的是更新引擎的失败路径就在这些测试里：坏签名、启动后不健康的发布、安装后钩子失败、交换与健康门禁之间断电。它们都驱动**真实引擎**并注入故障，而不是模拟引擎，所以 `updater/tests/apply.rs` 比任何手工操作都更能回答"这到底保证了什么"。

`configd` 的 NetworkManager 客户端和 `btd` 的 BlueZ 客户端只在 Linux 上存在，所以主机测试通过说明不了它们。必须对板子的目标做 lint，否则问题会随发布出厂：

```bash
RUSTFLAGS="-D warnings" cargo clippy -p configd --all-targets --target aarch64-unknown-linux-gnu
```

`scripts/board-test.sh` 在 CI 里针对真实用户态运行：交叉编译后在 Debian 13（Trixie）上执行 60 条断言，覆盖回滚、拒绝被篡改的产物、启动计数恢复、socket 权限、peer 凭据授权，以及 `setup-board.sh` 与 `install.sh` 对板子做的每件事。`BOARD_IMAGES=` 可以换镜像。

想不发布就把改动跑在真机上，用 `scripts/dev-push.sh <user@board>`：本机构建，在板上作为一次带门禁的普通更新安装。默认用 `cargo zigbuild` 交叉编译，加 `--docker` 则直接在板子的用户态里构建，连工具链都不用配。细节见 `docs/robot/dev-push.md`。

## 仓库分层

原文用注释把目录分成四层，这个分层本身就是设计：

- **守护进程**：一个 crate 一个单元，全部打进同一个发布产物。`robotd/` 是控制、声音、特雷门琴与合唱；`updater/` 是引擎加 `updaterd`；`configd/` 管 Wi-Fi、名字、配对 PIN、重启与手柄配对；`btd/` 是 BLE 前门；`padd/` 把柄变成意图，是普通 socket 客户端、无特权；`mediad/` 管摄像头、麦克风、WebRTC、远程网关和它自己服务的控制台；`tof/` 只发布帧、不读任何东西；`nfc/` 让被触碰的标签指认手柄。
- **被驱动的库**：没有 socket、没有 systemd、没有东西启动它们。`duck-ipc-proto/` 是线协议；`duck-control/` 是控制核心（模型、总线、IMU、观测、策略、安全）；`kinematics/` 与 `odometry/` 各自负责运动学与里程计；`sounds/` 管合成与每台机器人的音色；`pet-detect/` 是听摸头的小 CNN；`robotd-params/` 管启动参数的模式、默认值与校验。
- **工具**：`robotctl/` 是本地 CLI（含 `monitor`）；`duckctl/` 是笔记本侧客户端，**永不随发布出厂、永不交叉编译**；`xtask/` 负责 package · sign · promote；`test-support/` 提供测试用的签名发布夹具。
- **配置与脚本**：`deploy/` 是机器人被配置成什么样（`updater.toml`、`robotd.toml`、信任锚、journald）；`hooks/` 是更新时在产物内运行的 preinstall/postinstall；`scripts/` 覆盖从制板到救援的全部流程；`docs/` 分 robot/design/project/ideas 四类。

服务之间用 Unix socket 上的 JSON-RPC 2.0、一行一个对象通信。契约放在 `duck-ipc-proto`，它只依赖 serde 和 semver——所以 `btd` 和 `robotd` 不会继承更新引擎那棵 http/tar/crypto 依赖树。

## 约定

- **注释说为什么，不说做什么。** 一个东西成为现在这样的理由，比代码活得久。
- **每个不显然的决定都要有一个测试**，测试的注释要说明它防的是哪种失败。回滚路径尤其如此：它们只在别的地方已经出错时才运行，因此最容易被悄悄弄坏。
- **先找现成的 crate，再自己写。** 优化的目标不是依赖数量，而是维护成本。
- AI 协助的提交尾注用 `Assisted-by:`，不用 `Co-Authored-By:`。

## README 里的媒体

视频和头图是 **GitHub attachment，不是仓库里的文件**：把片段拖进任意 issue 或 PR 的评论框，GitHub 返回一个 `https://github.com/user-attachments/assets/<id>` 地址。没有东西要提交，也没有东西要同步——克隆里同样没有，所以离线时那些格子是空的。

在 README 的 `<table>` 里，URL 必须放进元素，因为块级 HTML 内不解析 markdown，裸 URL 会原样显示为文本：

```html
<video src="https://github.com/user-attachments/assets/<id>" controls width="100%"></video>
```

**视频不能自动播放或循环。** 原文对着渲染器本身验证过（`POST https://api.github.com/markdown`）：在 `src autoplay muted loop controls playsinline preload poster width` 中，只有 `src`、`muted`、`controls`、`width` 能过消毒器。所以视频要等一次点击，唯一会自己动的是动图——GIF，或者体积小得多的动画 WebP：

```bash
ffmpeg -i clip.mp4 -vf "fps=15,scale=560:-1:flags=lanczos" -loop 0 -q:v 55 walk.webp
```

两三秒即可，当作会动的缩略图。需要声音或长度时才用视频。

## 发布

发布**在 CI 里签名，绝不在本地**。入口是 GitHub releases 页面，tag 决定发生什么：

| 你创建 | CI 做什么 |
|---|---|
| 预发布，tag 为 `daemon-staging-v0.4.0` | 构建、签名、用真实更新引擎验证、发布到 **staging** |
| 正式发布，tag 为 `daemon-v0.4.0` | 若 staging 0.4.0 存在则**晋升**它——同样的字节，重新签名；否则直接构建 0.4.0 |

在终端推任一 tag 效果相同：

```bash
git tag daemon-staging-v0.4.0 && git push --tags
```

金丝雀路径故意是两步：先发预发布，装到一台机器人上，再创建正式发布。没有 staging 可晋升时直接创建 release 是允许的，发布说明里会写明——它在 CI 里验证过，但从未在机器人上运行过。

**先升 workspace 版本。** `xtask package` 会拒绝与 `Cargo.toml` 不一致的 tag，这正是防止机器人报告一个它并未运行的版本。

`gh workflow run promote --field version=0.4.0` 是不用先创建 release 的同一套晋升，`min_supported` 也在这里。密钥保管、secrets 与轮换见 `docs/project/ci-setup.md`。发布之后"哪个进程在跑哪个发布"的问题，由[重启顺序](./restart-order.md)回答。