---
id: mattpocock/setup-matt-pocock-skills
title: setup-matt-pocock-skills
description: 为仓库配置工程技能所依赖的议题跟踪器、分诊标签词汇和领域文档布局，首次使用前运行一次。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/setup-matt-pocock-skills/SKILL.md
snapshotPath: source-snapshots/mattpocock/setup-matt-pocock-skills/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 配置 Matt Pocock 的技能

搭建工程技能所假设的按仓库配置：

- **议题跟踪器（issue tracker）**：issue 存放在哪里（默认 GitHub；开箱也支持本地 Markdown）
- **分诊标签**：五个规范分诊角色所用的字符串
- **领域文档**：`GLOSSARY.md` 和 ADR 放在哪里，以及读取它们的消费方规则

这是一个提示词驱动的技能，不是确定性脚本。先探索、呈现你发现的东西、与用户确认，然后再写。

## 过程

### 1. 探索

查看当前仓库，了解它的起始状态。读到什么就是什么；不要假设：

- `git remote -v` 和 `.git/config`：这是 GitHub 仓库吗？是哪一个？
- 仓库根目录的 `AGENTS.md` 和 `CLAUDE.md`：存在哪一个？其中是否已有 `## Agent skills` 区块？
- 仓库根目录的 `GLOSSARY.md` 和 `GLOSSARY-MAP.md`
- `docs/adr/` 以及任何 `src/*/docs/adr/` 目录
- `docs/agents/`：这个技能之前的输出是否已经存在？
- `.scratch/`：本地 Markdown 议题跟踪器约定已在使用的迹象
- `triage` 技能是否已安装？（与这个技能并列的 `triage` 技能文件夹，或者你的可用技能里有 `triage`。）这决定 B 节是否运行。
- Monorepo 信号：`pnpm-workspace.yaml`、`package.json` 里的 `workspaces` 字段，或者已有内容、自带 `src/` 的 `packages/*`。这些只出现在真正的大型多包仓库里；没有它们就意味着单上下文，几乎所有仓库都是这样。

### 2. 呈现发现并提问

总结哪些已存在、哪些缺失。然后按顺序处理各节。一节，一个答案，然后下一节。

每节先给推荐答案，让用户一个词就能接受。只有当选择确实会分叉时，才给一行解释；如果探索已经确定了，就整节跳过（`triage` 未安装时跳过 B 节，没有 monorepo 时跳过 C 节）。

**A 节：议题跟踪器。**

> 解释：这里的“议题跟踪器”是这个仓库里 issue 存放的地方。`to-tickets`、`triage` 和 `to-spec` 这类技能会读它、写它。它们需要知道该调用 `gh issue create`、在 `.scratch/` 下写 Markdown 文件，还是遵循你描述的其他工作流。选你实际为这个仓库跟踪工作的地方。

默认姿态：这些技能是为 GitHub 设计的。如果 `git remote` 指向 GitHub，就提议它。如果 `git remote` 指向 GitLab（`gitlab.com` 或自托管主机），就提议 GitLab。否则（或者用户更偏好），提供：

- **GitHub**：issue 放在仓库的 GitHub Issues 里（使用 `gh` CLI）
- **GitLab**：issue 放在仓库的 GitLab Issues 里（使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI）
- **本地 Markdown**：issue 作为这个仓库 `.scratch/<feature>/` 下的文件存放（适合个人项目或没有 remote 的仓库）
- **其他**（Jira、Linear 等）：请用户用一段话描述工作流；技能会把它记录为自由文本

把选择记录在 `docs/agents/issue-tracker.md`。GitHub 和 GitLab 模板带有一个“PR 作为请求入口”的开关，默认**关闭**。保持关闭，不要提起：想让外部 PR 进入分诊队列的用户，之后可以在文件里自己打开。

**B 节：分诊标签词汇。** 如果 `triage` 技能未安装（探索时已经知道），就整节跳过，因为未安装的技能不需要标签。

如果已安装，只问一个问题：

> 你想保留默认的分诊标签吗？（推荐：**是**）

默认值是五个规范角色，每个标签字符串等于它的名字：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。回答**是**，就按原样写入。只有当用户说不，通常是因为他们的跟踪器已经在用别的名字（例如用 `bug:triage` 表示 `needs-triage`），才收集这些覆盖，让 `triage` 应用已有标签而不是创建重复项。

**C 节：领域文档。** 默认用**单上下文**（仓库根目录一个 `GLOSSARY.md` 加 `docs/adr/`）。这适合几乎所有仓库；直接写，不必询问。

只有当探索发现 monorepo 信号时，才提供**多上下文**（根目录 `GLOSSARY-MAP.md` 指向各上下文的 `GLOSSARY.md` 文件）。然后确认他们想要哪种布局。

### 3. 确认并编辑

给用户看一份草稿：

- 要加到 `CLAUDE.md` / `AGENTS.md` 的 `## Agent skills` 区块草稿（加到哪里见第 4 步的选择规则）
- `docs/agents/issue-tracker.md`、`docs/agents/domain.md` 和 `docs/agents/triage-labels.md` 的内容（最后一个只在 `triage` 已安装时）

写入之前让他们编辑。

### 4. 写入

**选择要编辑的文件：**

- 如果 `CLAUDE.md` 存在，编辑它。
- 否则如果 `AGENTS.md` 存在，编辑它。
- 如果两者都不存在，问用户要创建哪一个；不要替他们选。

当 `CLAUDE.md` 已存在时，绝不要创建 `AGENTS.md`（反之亦然）；永远编辑已经存在的那个。

如果选中的文件里已经有 `## Agent skills` 区块，就原地更新它的内容，而不是追加一个重复块。不要覆盖用户对周围章节的编辑。

区块内容：

```markdown
## Agent skills

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Triage labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of layout: "single-context" or "multi-context"]. See `docs/agents/domain.md`.
```

只有当 `triage` 已安装且 B 节运行过时，才包含 `### Triage labels` 子区块，并写 `docs/agents/triage-labels.md`。否则两者都省略。

当 B 节在 GitHub 或 GitLab 上运行过，就为跟踪器缺失的每个已配置标签创建出来（`gh label create` / `glab label create`）。

然后以这个技能文件夹里的种子模板为起点写文档文件：

- [issue-tracker-github.md](./issue-tracker-github.md)：GitHub 议题跟踪器
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md)：GitLab 议题跟踪器
- [issue-tracker-local.md](./issue-tracker-local.md)：本地 Markdown 议题跟踪器
- [triage-labels.md](./triage-labels.md)：标签映射（只在 `triage` 已安装时）
- [domain.md](./domain.md)：领域文档消费方规则 + 布局

对于“其他”议题跟踪器，按用户的描述从零写 `docs/agents/issue-tracker.md`。

### 5. 完成

告诉用户配置完成，以及哪些工程技能现在会从这些文件读取。提醒他们之后可以直接编辑 `docs/agents/*.md`；只有在想切换议题跟踪器或从头重来时，才需要重新运行这个技能。