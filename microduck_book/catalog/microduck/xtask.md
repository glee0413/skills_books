---
id: microduck/xtask
title: 构建工具 xtask
description: 更新契约的发布者一侧：打包 tar.zst、用 minisign 签名、按同一份字节把 staging 提升为 stable。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: xtask/src/main.rs
snapshotPath: source-snapshots/microduck/xtask/src/main.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/xtask/src/main.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 构建工具 xtask：打包、签名与提升

`xtask/src/main.rs` 是更新契约的**发布者**一侧。它从不上机器人——注意它链接完整的 `minisign`（会签名），而 `updaterd` 只链 `minisign-verify`（不能签）。

用 Rust 写而不是 shell 脚本只有一个理由：它复用更新器测试所用的同一批 `minisign`、`tar`、`zstd`、`sha2` crate。shell 版则依赖另装的 `minisign`/`tar`/`zstd` 二进制，它们的行为可能与机器人验证时用的漂移——而这是最不该允许差异藏身的地方。

## 五条子命令

`Command` 枚举是 `Package`、`Sign`、`Keygen`、`Keycheck`、`Promote`，典型顺序写在模块文档里：

```text
cargo xtask package --version 1.2.3 --channel daemon --bin-dir <dir> --out dist/
cargo xtask sign    --dir dist/ --key secret.key
cargo xtask promote --version 1.2.3 --staging-tag daemon-staging-v1.2.3 \
                    --stable-tag daemon-v1.2.3 \
                    --repo ORG/REPO --out dist/ --key secret.key
```

## package：先挡住版本漂移

`package` 一开始就检查 `--version` 与 `workspace_version()`，为的是拦住“打了 tag 却没改 Cargo.toml”这个经典错误，于是机器人报告的版本与它实际运行的不一致。开发构建是 crate 版本加 prerelease 标签，因此三元组相同、prerelease 自由，不需要 `--allow-version-drift`——否则一个“只给工具自己测试用”的开关会变成常规路径，反而不再拦得住它存在的理由。

产物是 `{channel}-{version}.tar.zst`，布局被 `updater` 的约定钉死：`bin/<name>` 一律 0o755；`--include src=dest` 可以加文件，`hooks/` 与 `scripts/` 下的给 0o755，其余 0o644；`hooks/preinstall` **总是**由 `hooks/preinstall.in` 渲染生成，不允许被 `--include` 顶替——它断言的是每个 release 都需要的板级前提，一个只在你记得加参数时才随行的检查，总有一天会从最需要它的那个 release 里缺席；`version.toml` 记录 `version`、`channel`、`revision`、`binaries`，让机器人在没有网络也没有 manifest 时仍能说清自己是什么。

压缩默认 `zstd` 级别 19，注释解释了为什么它值得：发布是一次性事件，下载带宽不是；但这是单线程的，成本取决于喂进去的东西——CI 的冒烟测试打未 strip 的 debug 二进制，同一级别要 400 秒，占掉半个作业，所以 `--zstd-level` 让用完即弃的那一种付 1 级。

最后算 `sha256_hex`，写两份 manifest：一份 `url` 指向 `--base-url`（GitHub Releases 的下载地址），一份 `url` 是裸文件名给 `LocalDir` 用，让 CI 走机器人自己的代码路径验证而不必第二次碰签名密钥，也让开发者能把产物和它丢进目录侧载。`min_hw_rev` 来自 `robotd_params::board::min_hw_rev`，不是命令行参数——退役一块板子是一次提交，没人需要在 CI 里记住一个开关。

## 密钥：现在就生成备用

`keygen` 分 `KeyKind::Release`（长期、静态加密、每台机器人包括客户的都信任）与 `Dev`（不加密，CI 可非交互使用，只出现在开发者板子的信任集里，文件名带 `.dev.pub` 以便更新器识别）。函数文档解释了一件便宜但现在不做就再也补不上的事：机器人验证的是烧进镜像的**一组**公钥，如果只烧一把 release 密钥而它日后丢失或泄露，就没有任何办法通过空中引入替代——只能手工重刷。今天就生成第二把、从第一个镜像起就烧两把公钥，轮换以后只是“换另一把签”。它同样拒绝把私钥写进仓库：这是这里唯一一个删文件也无法挽回的错误。

`sign_dir` 遍历目录，给每个产物与 manifest 各写一个同名 `.minisig`（已存在的签名文件跳过，一个也没签就报错）；产物和 manifest 都签，是为了让机器人能相信 manifest 说的话，也能脱离 manifest 独立验证字节。`keycheck` 在依赖一把密钥**之前**验证它可用、公钥与私钥匹配，因为坏口令、错配、被截断的文件，要么现在发现、要么在你要给一整队机器人签修复的时候发现。口令优先读 `MINISIGN_PASSWORD` 环境变量，`hide_env_values` 让它不出现在帮助里——命令行参数会被机器上每个进程看见。

## promote：提升是决定，不是重建

`promote` 读出 staging manifest，核对版本，然后只改两件事：`url` 指向 **stable** release 上的同一个产物名，`sig_url` 跟着改。产物地址与 sha256 原样携带，所以发布出去的字节与被验证过的字节完全一致。它曾经指回 staging release 以省一份拷贝，结果是每个 stable release 都依赖一个名字听起来就可丢弃的 tag——而那些 `daemon-staging-v0.1.x` 果然被清掉了，留下三个指向空气的 stable release。manifest 里的 sha256 在安装前会被 `updater::verify::verify_sha256` 验证，所以真出现分叉的拷贝也不可能静默装上，这正是单拷贝规则原本要保护的东西。

`min_supported` 显式给出才设置，不给就**删除**而不是继承：为修复某个坏 staging 构建而设的下限，不该悄悄变成全队的强制升级。

它的对端是 [更新引擎](updater.md)：这一侧决定“发布什么”，那一侧决定“装不装、装完健不健康、不健康怎么回滚”。