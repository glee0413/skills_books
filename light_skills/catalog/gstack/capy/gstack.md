---
id: gstack/capy/gstack
title: gstack
description: 在 Capy 与 Claude Code 中安装并使用 gstack，涵盖会话启动检查、工作流路由、无人值守运行与 Captain 审批流程。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: capy/skill/gstack/SKILL.md
snapshotPath: source-snapshots/gstack/capy/gstack/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 面向 Capy 与 Claude Code 的 gstack

## 会话启动：先检查，仅在需要时安装

`scripts/install.sh` 要相对这份 SKILL.md 解析，而不是相对当前工作仓库。它是一个冻结的引导脚本：先打印 `gstack-capy-skill: wrapper <n> (<path>)`，再从 gstack 的远端得知支持的最低版本，然后交给 checkout 自带的封装脚本（`bin/gstack-capy-session`）。

1. 会话启动时运行 `bash scripts/install.sh --check`；如果已经知道要用哪个工作流，就加上 `--for <skill>`（`--for autoplan`、`--for review`、`--for qa`）。它会为每个组件打印一行 `PASS|FAIL|SKIP|WARN <component>`（`WARN` 表示需要负责人处理），再打印一行 `GSTACK_LAUNCH:`，最后一行恰好是一条尾部结论：`gstack: ok <revision> for=<skill>[ (<notes>)]`（退出码 0）或 `gstack: fail <ids> …`（退出码 1）。直接读取退出状态并用 `^gstack: ` 匹配，绝不要把检查输出单独管到 `tail`、`head` 或 `grep` 里。`--check` 从不会移动 checkout。
2. 如果尾部结论点名了 `revision`、`runtime` 或 `pins`（`gstack: fail revision …`、`gstack: fail runtime,pins`、`gstack: fail pins`）且已存在 checkout，或者 ok 结论里带着 `behind=<n> (latest: <v>); fix: <command>`（checkout 落后 origin 有 <n> 个提交；输出里还会有一行 `gstack-capy-session: behind origin/<branch>: …`），就用同样的命令去掉 `--check` 再跑一遍（超时 900 秒）；如果 `fix:` 指向别的命令，就执行那条命令。原样汇报尾部结论，包括 `behind=`：落后的版本就该说落后。对 `pins` 而言，如果 pin 指向一个已验证的版本，就安装项目锁定的 Bun；否则以 `RUNTIME_PIN_CONFLICT` 停止，并指出需要抬高的是哪个 pin。任何干净、未锁定且落后于 origin 的 checkout，都会在安装模式下被快进（低于 `GSTACK_MIN_REVISION` 底线时由引导脚本完成，打印 `gstack-capy-skill: upgraded <old> -> <new>`；高于底线时由 checkout 自己完成，打印 `SELF_UPGRADE: done <old> -> <new>`），并在同一个加锁步骤里重装、重检。锁定（`--revision`、detached）、有未提交改动、已分叉，或被另一个活动会话持有租约（`UPGRADE_BUSY`）的 checkout 永远不会被移动：尾部结论会指出原因和确切命令（高于底线时，它是在 `SELF_UPGRADE: skipped (<reason>)` 之后的 `fail behind` 结论，并可能带 `UPGRADE_BUSY` 或 `UPGRADE_REFUSED`）。休眠后 pid 被复用的租约会被自动回收。`GSTACK_CAPY_AUTO_UPGRADE=0` 关闭所有快进，`GSTACK_CAPY_SELF_UPGRADE=off` 只关闭高于底线的那次。
3. 如果尾部结论是 `gstack: fail not-installed …`，而本会话不跑任何 gstack 工作流，就记下这一行然后继续；此时什么都不会安装。到第一个工作流之前再安装：`bash scripts/install.sh --for <skill>`（冷启动约 30 秒：克隆、在现有 Bun 不满足时安装一个经 SHA-256 校验的 Bun、装好两个不含 Chromium 的宿主配置，并放入 `~/.local/bin/bun` shim，让新开的 shell 拿到记录下来的 Bun）。
4. 其他任何 `FAIL` 行都带一条 `fix:` 命令和一个原因码，以及对应的排障锚点；先执行修复，再跑一次 `--check`。`SKIP codex-cli (optional; …)`、`SKIP browser (lazy; …)`、`SKIP pins (planning-only; …)` 和 `SKIP pins (helper runtime; …)` 都不是失败。

**尾部结论规则。** 本会话里这台机器没有打印过 `^gstack: ok` 行，就意味着这里没有安装 gstack：不要运行任何工作流，也不要声称这些技能可用。一台机器上的安装永远不会覆盖另一台。

**子代理。** 子代理给父代理的第一份报告，要在标识符之后原样带上它自己机器上 `--check` 输出的 `gstack:` 尾部结论行。父代理把缺失这一行视为 `gstack: fail not-installed`。只读并汇报的审查者子代理（一个 /autoplan 声音、一份第二意见）改跑 `--for review-voice`：热态下只需几秒，不跑 `./setup`，不装宿主配置，Bun 用 gstack 自己的最低版本，它给出的尾部结论只认证只读辅助程序（`gstack-pregate sealed`、`gstack-plan-reality`、`gstack-artifact` 以及 `gstack-autoplan` 的读取）；任何工作流都会以 `--for <skill>` 的修复建议拒绝它。绝不要告诉审查者“不需要安装”。一台没有这个技能的机器（比如你为子代理写的任务说明）要在项目目录里运行 checkout 自带的引导脚本：`test -f "$HOME/.local/share/gstack/setup" || git clone --quiet --single-branch --depth 1 https://github.com/garrytan/gstack.git "$HOME/.local/share/gstack" && GSTACK_CAPY_ROOT="$HOME/.local/share/gstack" bash "$HOME/.local/share/gstack/capy/skill/gstack/scripts/install.sh" --for <skill>`。

`gstack-capy-skill: owner action — Drive copy is wrapper <n>, minimum <m>; copy <root>/capy/skill/gstack/ (CAPY_WRAPPER_STALE)` 的意思是：这个技能目录比 checkout 要求的更旧。运行仍然可用；告知负责人，由他把该目录覆盖到技能目录上。永远不要自己去写技能目录。

## 每条 gstack 命令都用 GSTACK_LAUNCH 行启动

每次成功运行（包括 `--check`）都会打印 `GSTACK_LAUNCH: PATH=<dir>:$PATH GSTACK_SESSION_KIND=unattended GSTACK_STATE_ROOT=<path> GSTACK_EPHEMERAL=1 GSTACK_CAPY=1 GSTACK_INSTALL_VERDICT=<file>`（只有经过验证的 Bun 不在 PATH 首位时才带 `PATH=` 部分），随后为不解析 shell 语法的调用方再打印 `GSTACK_LAUNCH_PATH: <dir>`。给每条 gstack 命令都加上这些赋值前缀，或者在真正运行它的那个 shell 里导出一次；子 shell 的导出无法配置父 shell 之后执行的命令。PATH 那部分正是让 gstack 里 `#!/usr/bin/env bun` 的命令跑上尾部结论认证过的 Bun 的关键；Capy 镜像里的 `/usr/local/bin/bun` 是 1.3.14，低于 gstack 的最低版本。

带 `GSTACK_CAPY=1` 时，在无人值守或派生会话里启动的工作流，会检查上一次运行为本 checkout、HEAD 和工作流写下的安装结论，以及 PATH 上的 Bun。任一项不通过，它就打印一行 `INSTALL: fail …` 及其修复办法和 `GSTACK_RESULT: skill=<s> status=refused run=-`，并以退出码 3 结束：停下来，执行修复，重新开始。某个 ok 的 pins 行若是 `SKIP pins (planning-only; …)`，就不能放行需要跑仓库测试的工作流（`review`、`ship`、`qa`）；没有检查过该工作流所需组件的结论同样不能放行；先运行 `--for <that skill>`。

## 加载正确的工作流

对于运行 GPT-6 Astra 的 Capy，先读 `${CODEX_HOME:-$HOME/.codex}/skills/gstack/SKILL.md` 了解路由，再读 `${CODEX_HOME:-$HOME/.codex}/skills/gstack-<skill>/SKILL.md` 了解所选工作流。这些是生成的 GPT-6 Astra 指令，不是 Claude 的源文件。

对于 Claude Code，读 `~/.claude/skills/gstack/SKILL.md` 了解路由，读 `~/.claude/skills/<skill>/SKILL.md` 了解所选工作流。启动 Claude Code 会话时，要告诉它加载 gstack 并说明打算用哪个工作流。对于运行 Claude 模型的 Capy，可以直接读 Claude 指令文件，并套用下面的 Capy 适配；但这不会把 Capy 变成 Claude Code 运行框架。

如果没有指定具体技能，就用路由器里的任务到技能映射。只读所选工作流及其引用的文件。对于其他模型，使用最接近的适用指令配置，但不要声称已经为它生成或评估过特定模型的配置。

## 供父代理使用的无人值守运行

对于从 Capy 驱动的 `/autoplan`，读 checkout 里的 `autoplan/DRIVER.md`（`~/.local/share/gstack/autoplan/DRIVER.md`）：其中是精简的阶段性循环、产物契约和门禁协议，不含交互式前言。没有这个文件的 checkout 版本更旧；改按它的 `autoplan/SKILL.md` 执行。每条命令都带上 `GSTACK_LAUNCH` 赋值，并把输出当文件读，而不是当散文读：运行目录里有 `run.json`、`decisions.jsonl`、`findings.jsonl`、`tasks.jsonl`、`timing.json`、`plan.md` 和 `review-record.md`，运行结束时打印 `GSTACK_RESULT: skill=autoplan status=gate_pending run=<dir>`。完成的判定是 `~/.local/share/gstack/bin/gstack-artifact validate <dir>/run.json`。门禁通过 `gstack-autoplan answer`（或 `gstack-gate parse`）回答，并带上打印出来的 `gate_rev`；无人值守运行永远不自行批准自己的门禁。checkout 里的 `docs/unattended.md` 是契约。

`/autoplan` 的 Capy 检查清单：驱动 `gstack-autoplan`，绝不用手工改写的版本冒充一次运行。用 `gstack-gate render <dir>/gate.json --all` 转述，并把 `rec`（每条推荐，包含计划改动）作为单词默认回复；回答时用 `--by agent:<id> --owner-reply "<their words>"`。把 `GSTACK_AUTOPLAN_CHECKPOINT_DIR` 设为一个项目用户私有的 Drive 文件夹；换机器之后，`gstack-autoplan resume --out <new dir> --from <that dir>` 会恢复最新的有效检查点。

## 在 Captain 手下工作

当你为一位 Capy Captain（一个 crew 线程）工作，或直接为某个人工作时，gstack 的决定要经由你才能到达他们。每个带 `GSTACK_LAUNCH` 行启动的工作流都会打印 `CAPY: on` 和一个 `capy-asks` 块，重复这些规则。完整指南（含实例和可复制的模板）见本目录下的 [captain.md](https://github.com/garrytan/gstack/blob/8d9501373b55897447ae30f1d281c4dbc8a1369e/capy/skill/gstack/captain.md)。

- **审批如何流转。** crew 线程从不直接问人。它把请求作为 needs-you 报告发给自己的 Captain，由 Captain 用平实的语言去问人，并把他们的原话带回来。没有 Captain 的线程用 Capy 提问直接问人。一个答复只覆盖它被询问的那个线程和范围。
- **常设审批无需再问。** 这些是 Captain 在自己规则里列出的条目（例如“绿灯就合并，走 train”）。引用规则，而不是再问一遍。
- **这些永远需要重新征询：** 产品或行为层面的决定、超过既定上限的支出、任何发布到仓库之外的东西、改阈值/预算/试验次数、在不落地的前提下关闭别人的贡献，以及任何破坏性操作。
- **记录每一个答复。** 用 `gstack-approvals add --ask … --words "<their exact words>" --by … --scope …`，或者在 autoplan 答复之后用 `gstack-approvals import --autoplan <run dir> --by <name>`。`gstack-approvals render` 会打印 `## Approvals` 表格，供你的报告和 PR 正文使用。表格行会被密钥扫描，在 Capy 上还会镜像到私有的 Drive 文件夹。
- **计划审批**用 `gstack-owner-brief render --captain --out <run dir>`。它会打印改动前 → 改动后、为什么重要、是什么引发了这项工作、重大决定（选项、所选、为什么、什么会推翻它）以及我们需要什么，并把 `rec` 作为推荐的单词回复。整份转述。门禁码只出现在最后一行，那是给你看的。如果它以 `CAPTAIN_BRIEF_INCOMPLETE` 退出，先补上缺失的计划章节。
- **合并征询。** /ship 的 PR 正文开头是 `## What changed`（带说明的改动前后图片，来自 `gstack-pr-shots` 或 UI 截图，用 Capy 的 PR 资源工具上传）、`## Why` 和 `## Approvals`。你的 READY 报告要附上关键图片。

## 任何推送或拉取请求之前

在带有 sealed 配置（`.gstack/pregate.json` 里有 `sealed` 键）的仓库里，每次推送前和创建拉取请求前都要运行 `~/.local/share/gstack/bin/gstack-pregate sealed`：Capy 的拉取请求工具可能不执行本地 git 钩子，所以这一步才是把 sealed 或 eval 输出挡在公开仓库之外的检查。拒绝时会指出文件、行号和规则；在它通过之前不要推送。

## 把宿主相关指令适配到 Capy

- 要求调用 `Skill` 的指令，意思是“用可用的文件读取工具去读并遵循选中的 SKILL.md”。不要调用不存在的 Skill 工具，也不要假设斜杠命令已在 Capy 的 UI 里注册。
- 用 Capy 对用户可见的消息和提问工具来输出和做决定。纯助手文本在 Capy 里不算已送达的消息。用 Capy 的任务和拉取请求工作流，而不是不可用的 Claude 或 Codex 宿主工具。
- Capy 没有原生的 gstack 宿主目标。Claude 钩子不会变成被强制执行的 Capy 钩子；安全类技能在这里只是建议性的，`/autoplan` 会打印一次 `autoplan guard: not enforced by this host` 说明这一点。缺失的能力要如实报告，不要默默声称有同等强度的强制执行。
- 在 Capy 中选择 GPT-6 Astra 或 Claude，并不会安装或认证 Codex 或 Claude Code CLI。做跨模型审查时，另一个模型族上的子代理就是一个完整的外部声音；记录下是哪个模型做的审查。如果由另一个 runner 完成了审查，不要把缺少 Codex CLI 说成覆盖度下降。
- 保持用户要求的范围、决定和同意。不要替用户开启遥测或远程产物共享。安装 gstack 并不授权合并、部署、破坏性操作或绕过审批。

## 维护

`bash scripts/install.sh --check` 是健康检查；`bash scripts/install.sh` 会安装或修复，并把低于支持最低版本的 checkout 快进。在两个最低版本之间，`~/.local/share/gstack/bin/gstack-upgrade --check` 会说明 checkout 是否落后，`~/.local/share/gstack/bin/gstack-upgrade` 会把它快进到默认分支的顶端并重装（它拒绝有未提交改动、已分叉或已锁定的 checkout，且从不 stash 或 reset）。安装器是给装有 Git、curl、Node.js、flock 和 timeout 的 Capy Ubuntu 云机器用的；未经许可不要在个人设备上运行。