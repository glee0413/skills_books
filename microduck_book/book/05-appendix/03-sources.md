# 来源、许可证与版本

这本书不是 Pollen Robotics 的官方中文文档，而是围绕一个固定 commit 写成的学习性衍生作品。所有引用的设计文档、使用文档和源码片段都登记在 `sources.json` 的 48 个条目里，每条带 `sourcePath`、`sourceSha256` 和 `sourceUrl`；英文原文按同样的相对路径放在 `source-snapshots/` 下，离线也能核对。完整的归属声明见 `NOTICE.md`，许可证全文见 `third-party/microduck-LICENSE`。

## 上游仓库与固定版本

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/pollen-robotics/microduck |
| 固定 commit | `b2b0d213a402caeac492dd662ea891faa17f67c0` |
| 引用（ref） | `daemon-dev-main` |
| workspace 版本 | `0.18.3`，edition 2024，Rust 下限 1.89 |
| 许可证 | Apache-2.0 |

上游仓库是 `opensrc/` 下的独立 git 仓库，已被本书仓库的 `.gitignore` 排除。不要把它加入本书索引，也不要在里面提交改动；本书只读固定 commit。

## 收录了什么

48 个条目全部是 `extract`：只取与主题相关的部分，不做整仓镜像。

- **设计文档 10 篇**：`architecture.md`、`robotd-design.md`、`updater-design.md`、`policy-channel-design.md`、`restart-order.md`、`app-path-design.md`、`remote-webrtc.md`、`remote-access-design.md`、`boot-recovery-net.md`、`simulation.md`。
- **使用文档 9 篇**：`cheatsheet.md`、`cheatsheet-dev.md`、`dev-push.md`、`duckctl.md`、`install-dev.md`、`pair-a-gamepad.md`、`simulation.md`、`telemetry.md`、`udp-pad.md`。
- **项目记录 7 篇**：`roadmap.md`、`install-path-gap.md`、`media-bringup.md`、`npu-bringup.md`、`update-over-ble.md`、`idle-cpu.md`、`tof-on-demand.md`。
- **仓级文档 8 项**：`README.md`、`CONTRIBUTING.md`、`docs/README.md`、`faq.md`、`recurrent-policies.md`、`policy-manifest.md`、`Cargo.toml`、`deploy/README.md`。
- **源码片段 14 个**：`duck-ipc-proto`、`duck-control`、`robotd/src/{main,control}.rs`、`kinematics`、`odometry`、`mediad`、`updater`、`padd`、`btd`、`tof`、`sounds`、`duckctl`、`xtask`。

## 没有收录什么

- **同名不同仓库的部分**：手机 app 在 `microduck-app`，策略训练在 `microduck_rl`，系统镜像在 `microduck_yocto`，另外还有 `microduck-policies`、`microduck-duck-detector`、`microduck-gst-plugins`。本书只用主仓库里的文档解释它们，不引它们的源码。
- **未收录的文档**：`design/mobile-app.md`、`design/webrtc-console.md`、`robot/install-by-hand.md`、`project/ci-setup.md`、`project/slice-2-bringup.md`、`project/pad-minimal-pairing.md`、`ideas/autonomous_behavior.md`。它们要么描述本书不覆盖的外部组件，要么是一次性记录。
- **仓库运维文件**：`.github/` 下的 workflow、`AGENTS.md` 与 `CLAUDE.md`、`spaces/`，以及 README 里的图片和视频（它们是 GitHub attachments，不是仓库文件）。
- **二进制与权重**：模型 `.onnx` 放在 Hugging Face Hub，不随仓库发布；本书也不保存任何构建产物。
- **完整测试套件**：只通过 `CONTRIBUTING.md` 和设计文档描述它，不逐文件摘录。

## 许可证与归属

上游使用 Apache-2.0。翻译、改写、章节导读和术语表是本书新增内容；引用本书时请同时保留项目名、commit 与 Apache-2.0 归属。书稿自身的内容许可证尚未决定，这一点写在 `NOTICE.md` 里，不要在别处替它宣布一个。

## 如何重新同步

目标是“换 commit，但不丢可追溯性”。一次只升这一个仓库：

```bash
#1. 在只读来源里切到新 commit
cd opensrc/microduck
git fetch origin
git checkout <new-commit>
git rev-parse HEAD

#2. 按原相对路径复制到快照目录
cp docs/design/architecture.md \
   ../../microduck_book/source-snapshots/microduck/docs/design/architecture.md

#3. 重新计算哈希，回填 sources.json 的 commit、ref、sourceSha256
cd ../../microduck_book
sha256sum source-snapshots/microduck/docs/design/architecture.md
npm run build && npm run check
```

四个要点。内容变了的条目要把 `translationStatus` 重置为 `todo`、`translatedAt` 置空，翻完再标；只换 commit 没改内容也要更新 `sourceSha256`，否则 `npm run check` 会报哈希不一致。行为变了就重跑章节里的命令和夹具，不能只改版本号。最后在 `CHANGELOG.md` 记下来源、原因和验证命令。

## `docs/design` 与 `docs/project` 的分工

上游把文档分成四个目录，这个划分本身是这本书的一层结构：

| 目录 | 时态 | 用途 | 冲突时 |
|---|---|---|---|
| `docs/design/` | 现在时 | 机制怎么工作、为什么这样设计；一页只拥有一个机制，其它页指过去 | 行为与文档不一致，文档是 bug |
| `docs/project/` | 过去时 | 带日期的记录：某块板子上发生了什么、哪个 bug 怎么被关掉 | 会故意过期，结论要回填到 design |
| `docs/robot/` | 祈使句 | 你手上有一台机器人时照着做 | 以能跑通的命令为准 |
| `docs/ideas/` | 将来时 | 还没设计的东西，先写下来免得被当成决定 | 不是承诺 |

所以读法也不同：想理解“为什么”，去 `design/`；想理解“曾经踩过什么坑”，去 `project/`，例如 `install-path-gap.md` 讲的四个安装路径 bug，结论最后落在 `updater-design.md` §9.1 的一条规则上。本书保留这个区分，是因为机器人系统里最贵的知识往往不是接口，而是那些只有出过事才写得出来的约束。