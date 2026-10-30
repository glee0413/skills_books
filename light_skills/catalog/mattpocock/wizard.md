---
id: mattpocock/wizard
title: wizard
description: 生成一个交互式 bash 向导，带着人走完只有人才能完成的手工步骤，例如配置基础设施、准备凭据或 CI 密钥。
invocation: model
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/wizard/SKILL.md
snapshotPath: source-snapshots/mattpocock/wizard/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# Wizard

**向导（wizard）** 是一个 bash 脚本，它一步一步地带一个人走完某个手工流程——这种流程手动做很繁琐，而且每次向 AI 重新解释一遍也很繁琐。它会打开每个 URL，明确说出该点什么、复制什么，捕获这些值，把它们写到该去的地方（`.env`、GitHub secrets），在每个阶段确认，并显示还剩几个阶段。它可能用来配置第三方服务、执行一次性迁移，或者把项目从一种状态搬到另一种状态。

令人愉快的交互体验已经由 [template.sh](https://github.com/garrytan/gstack/blob/8d9501373b55897447ae30f1d281c4dbc8a1369e/wizard/template.sh) 解决：逐阶段的进度、确认门禁、跨平台打开 URL（包括 WSL）、隐藏式密钥输入、幂等的 `.env` upsert、`gh secret`/`gh variable` 写入，以及收尾总结。**你的工作只是界定流程的范围并编写它的各个阶段。** `STAGES` 标记之上的库在每个向导里都完全相同；这种一致性正是重点：永远不要手工修改它。

向导默认是临时的：为一次运行而构建，保存到临时路径或 `scripts/` 路径，任务完成后删除。只有当用户想要一条应当留在仓库里的可重复安装路径时，才提交它。

## 流程

### 1. 界定流程范围

弄清这个人必须执行的每一个手工步骤，以及沿途会捕获的每一个值。先读仓库，不要冷启动就问：

- 对于配置类任务：`.env`、`.env.example`、`.env.*`、`README`、`docker-compose*`、框架配置，以及 `.github/workflows/*`（每一处 `secrets.*` / `vars.*` 引用都是向导必须产出的值）。
- 对于迁移或切换类任务：当前状态、目标状态，以及两者之间不可逆的操作。

然后把排好序的阶段列表和每个阶段产出的值展示给用户，并请他确认：他可以增加、删除或重排。

**完成标准：** 每个阶段都按顺序命名，并且对于每个被捕获的值，你知道 (a) 人从哪里拿到它，(b) 它写到哪里（`.env`、某个 GitHub secret、两者都写，还是哪里都不写；有些阶段只是纯操作），以及 (c) 它是密钥（隐藏输入）还是公开值。

### 2. 梳理每个阶段的路径

对每个阶段，写出这个人要走的精确路径：打开哪个 URL、在那里做什么、值显示在哪里、它填进哪个变量，例如 "Dashboard → Developers → API keys → Reveal test key → copy"。如果你并不真的了解当前的界面或确切的命令，就说明这一点，然后问用户或查文档：绝不要编造可能并不存在的步骤。

**完成标准：** 每个阶段都能追溯到具体指令，陌生人照着也能走完。

### 3. 编写向导

把 `template.sh` 复制到目标路径。把示例阶段替换成每个步骤一个 `stage`，按依赖顺序排列。使用库提供的辅助函数：`stage`、`say`/`step`、`open_url`、`ask`/`ask_secret`、`write_env`、`set_secret`/`set_var`、`pause`/`confirm`。把 `TOTAL_STAGES` 设成你编写的阶段数。

守住模板设定的标准：先打开 URL 再索取它的值；任何密钥都用 `ask_secret`；每个需要持久化的值都用 `write_env`；只用 `set_secret` 写 CI 真正需要的值；任何不可逆操作之前都要 `confirm`。每个 `stage` 都会清屏，只显示当前步骤：让一个阶段只承担一件专注的任务，这样人需要看到的内容不会被滚走。不要碰标记之上的库。

### 4. 验证并交接

- `bash -n <script>`；如果环境里有 `shellcheck`，也跑一遍。
- `chmod +x <script>`。
- 不要自己端到端跑它：它会打开浏览器并阻塞等待人工输入。改为静态地追踪：第 1 步列出的每个值都被捕获，并落到第 1 步所说的位置；每个 `set_secret` 的名字都与 CI 里的某个 `secrets.*` 引用完全对应。
- 告诉用户怎么运行它。如果这是一条可重复的安装路径，就提交它，并在 `README` 里链接它，这样下一个人会去跑脚本，而不是去问 AI。