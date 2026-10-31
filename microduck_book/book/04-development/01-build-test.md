# 构建、测试与 CI

Microduck 的仓库同时装着七个守护进程、一组被它们调用的库、两个命令行工具和发布工具。它们在一个 Cargo workspace 里，用一种编译器版本约束、一套测试命令和一条签名发布链串起来。理解这套骨架，比记住某个 crate 的名字更重要：新增一个 daemon 时，它会自动进入打包、lint、测试和重启集合，而不是靠某个人记得改四处清单。原始约定见 [开发与测试约定](../../catalog/microduck/contributing.md)、[Cargo workspace](../../catalog/microduck/cargo-workspace.md) 和 [xtask](../../catalog/microduck/xtask.md)。

## 一个 workspace，三层 crate

```text
守护进程（各一个 crate、一个 unit，同一个发布物）
  robotd  updater  configd  btd  padd  mediad  tofd  nfc
它们驱动的库（无 socket、无 systemd、不会自己启动）
  duck-ipc-proto  duck-control  kinematics  odometry  sounds
  pet-detect  robotd-params  duck-detect  duck-ble  duck-ether
工具与测试支撑（不随机器人发布）
  robotctl  duckctl  xtask  test-support
```

这条分层不是审美。`duck-ipc-proto` 只依赖 serde、serde_json 和 semver，所以 BLE 服务和控制守护进程永远不会继承更新引擎的 http/tar/crypto 依赖树；恢复路径上的东西必须保持轻，才能在别的东西都坏掉时还能工作。`robotctl` 同样只依赖协议 crate，不链接更新引擎。

workspace 里有一个容易被忽略的键：`default-members` 排除了 `duckctl`。`cargo board --bins` 在 `dev-push.sh` 和发布工作流里都为 aarch64 构建默认成员；对机器人的守护进程这是对的，对开发者本机运行的客户端则是错的——那会为了一个永远不该见到蓝牙栈的板子，在发布路径上交叉编译一个蓝牙栈。排除写在根 `Cargo.toml` 一处，新增 daemon 会被两条路径同时拾取。

## Rust 版本既是下限，也是上限

`rust-version = "1.89"`。下限来自 `std::fs::File::try_lock`，更新引擎的单飞锁靠它实现而不引入依赖；edition 2024 需要 1.85，所以 1.89 同时覆盖两者。写上这个字段，使用旧工具链的同事会看到“requires rustc 1.89”，而不是一个“方法不存在”的报错。

它同时是上限。Yocto 镜像 `microduck_yocto` 用 OpenEmbedded 发行版自带的 Rust 从源码构建每个发布，wrynose 上是 **1.94.1**，所以这里的代码不能要求更新。0.15.1 曾把下限抬到 1.99 去用原子类型的 `try_update`，结果根本编不进镜像；`mediad` 后来把那些地方改写成 compare-exchange 循环。日常检查是：

```bash
cargo +1.94.1 check --workspace
```

## cargo test 不需要机器人

```bash
cargo test --workspace
```

这条命令不需要硬件、网络、Docker 或 D-Bus。在 macOS 上是 **942 个测试全部通过，没有排除项**；只有 ToF 驱动自己的两个测试不在那里跑，因为没有驱动可测——`vendor/platform.c` 通过 `linux/i2c.h` 访问总线，`build.rs` 只在 Linux 目标上编译它。`tofd` 仍然能构建，`tofd --fake` 仍然出帧，这也是它离开板子后的唯一运行方式。

Linux 上要先装 CI 装的那批 C 库：`padd` 通过 `gilrs` 绑 `libudev`，`mediad` 的管线是 `cfg(target_os = "linux")`，Linux 主机因此会编译 GStreamer，而 Mac 不会。

```bash
sudo apt-get install -y libudev-dev libgstreamer1.0-dev
sudo apt-get install -y libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev
```

测试里最值钱的一批是更新引擎的失败路径：坏签名、装完起不来、post-install hook 失败、切换与健康门禁之间断电。它们驱动真实引擎并注入故障，而不是 mock 掉引擎，所以 `updater/tests/apply.rs` 比任何手工演练都更能回答“到底保证了什么”。

## 只编译通过不算数：目标平台 lint 与板级测试

`configd` 的 NetworkManager 客户端和 `btd` 的 BlueZ 客户端只在 Linux 上存在，主机上构建通过、测试全绿，对它们什么也说明不了。必须在板子的目标上 lint：

```bash
RUSTFLAGS="-D warnings" cargo clippy -p configd --all-targets \
  --target aarch64-unknown-linux-gnu
```

交叉编译用 `cargo board --bins`，它是带板子目标和 glibc 下限的 `cargo zigbuild`，定义在 `.cargo/config.toml`。`mediad` 是另一个量级：`gstreamer-rs` 是 pkg-config crate，交叉编译需要目标机的头文件、`.pc` 和共享库。`scripts/cross-sysroot.sh` 把机器人自己的 Debian 包解成一个 sysroot，整个 workspace 都能对着它构建，GStreamer 解析到板子同款的 1.26.2。三个细节：`PKG_CONFIG_LIBDIR` 是替换而不是追加搜索路径，所以 sysroot 必须服务整个 workspace，否则 `padd` 会在 `libudev-sys` 里莫名其妙地失败；包清单是显式的十九个，不是从 `Depends` 递归出来的五百多个；只装 `-dev` 包不够，实际链接还需要运行时的 `.so.N`。

`scripts/board-test.sh` 在 CI 里对着发布的 userland 跑：交叉编译到板子，然后在 Debian 13（Trixie）上执行 60 条断言，覆盖回滚、被篡改的产物、启动计数器恢复、socket 权限、peer credential 授权，以及 `setup-board.sh` 和 `install.sh` 对板子做的每一件事。`BOARD_IMAGES=` 可以换镜像。`scripts/systemd-test.sh` 则在一个真的把 systemd 当 pid 1 的容器里跑完整更新，验证延迟重启定时器真的替换了 `updaterd`，以及一个装得上却起不来的 unit 会让更新失败并点名自己。

## xtask：打包、签名、晋升

发布侧的入口是 `xtask`，它用 Rust 写而不用 shell，只为复用更新器测试用的同一批 `minisign`、`tar`、`zstd`、`sha2` crate——shell 版本依赖单独安装的二进制，行为可能和机器人验证时用的漂移，而这是最不该藏差异的地方。

```bash
cargo xtask package --version 1.2.3 --channel daemon --bin-dir <dir> --out dist/
cargo xtask sign    --dir dist/ --key secret.key
cargo xtask promote --version 1.2.3 --staging-tag daemon-staging-v1.2.3 \
                    --stable-tag daemon-v1.2.3 --repo ORG/REPO \
                    --staging-manifest dist/manifest.json --out dist/
```

`package` 先检查 `--version` 与 `Cargo.toml` 的 workspace 版本一致；不一致就拒绝，这是为了防止“打了 tag 却没 bump 版本”，让机器人报告一个自己没在跑的版本。预发布版本（`0.2.0-dev.17.abc1234`）被接受，因为每次分支构建都需要它，否则 `--allow-version-drift` 会变成常规路径，反而失去检查作用。产物是 `.tar.zst`，二进制在 `bin/`，带 `version.toml`，并且总是从模板生成 `hooks/preinstall`——板子前置条件是每个发布的属性，不能是一个可能被忘记传的 `--include`。

签名密钥分两种。release key 长期有效、加密保存、被每台机器人信任；dev key 不加密，好让 CI 非交互签名，只出现在开发板的信任集合里，文件名必须以 `.dev.pub` 结尾才被识别。`keygen` 拒绝把密钥写进仓库，也要求现在就生成第二把 release 备用钥匙：机器人信任的是镜像里烘焙的公钥集合，只烘一把，丢了就只能手工重刷。

`promote` 不重建。它读取 staging 清单里的 artifact URL 和 sha256，生成指向 stable release 的新清单，字节完全相同；晋升是一次重新签名，所以发布出去的东西可证明就是被测过的那个。`min_supported` 不会从 staging 继承——为修一个坏版本设下的强制升级下限，不该悄悄变成全队的强制升级。

## 从 tag 到机器人：两条发布通道

发布只在 CI 签名，不在本地。tag 决定发生什么：

| 你创建的 | CI 做什么 |
|---|---|
| 预发布 `daemon-staging-v0.4.0` | 构建、签名、用真实更新引擎验证，发到 staging |
| 正式发布 `daemon-v0.4.0` | 若 staging 有 0.4.0，晋升同样的字节并重新签名；否则直接构建 |

金丝雀路径故意是两步：先发预发布，装到一台机器人上，再创建正式发布。正式发布若没有可晋升的 staging，也允许，但会在自己的说明里写清楚“只在 CI 验证过，没在机器人上跑过”。

```bash
git tag daemon-staging-v0.4.0 && git push --tags
gh workflow run promote --field version=0.4.0
```

分支构建走另一条路：`dev.yml` 发布 `daemon-dev-<branch>` 标签，版本里带构建序号和提交号；开发板用 `robotctl update apply --ref <branch> daemon` 安装。它进不了 stable，因为它被标记为预发布；它也进不了客户机器人，因为对方 `allow_dev_keys = false`。

## 三条让构建可信的规则

第一，**易漂移的常量只能有一个来源**。ONNX Runtime 的 floor/target、Rockchip NPU 运行时版本、官方策略集、检测模型、GStreamer 插件版本都放在 `[workspace.metadata.*]`；那些被 `curl` 单独取走、读不到 `Cargo.toml` 的脚本各自带字面量，并由 xtask 测试断言两处一致。两个副本漂移过一次，结果是一台板子装了 1.20.1，而 `ort` 在 1.23 以下会 panic。

第二，**清单之间要互相证明**。测试会检查 `install.sh` 安装的每个 unit 都被打包、hook 运行的每个脚本都被打包、`install.sh` 的每个安装步骤都在某个 hook 里也有对应，否则“只更新过的板子”永远拿不到它。这条规则来自四次真实事故，详见[安装路径故障](../../catalog/microduck/install-path-gap.md)。

第三，**发布物就是被验证过的东西**。晋升不重建只是其中一半；另一半是健康门禁、签名、哈希和 `min_hw_rev` 都在机器人上再验一遍。开发推送也一样，`dev-push.sh` 走的是普通更新，不绕过任何一道门。这样“本地能跑”和“机器人能跑”之间只隔一次真实的安装与启动，而不是一次信念。