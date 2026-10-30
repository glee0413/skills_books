---
id: mattpocock/setup-matt-pocock-skills/issue-tracker-gitlab
title: issue-tracker-gitlab
description: 约定用 GitLab issue 承载议题与规格时，各技能应当使用的 glab 命令工作方式。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/setup-matt-pocock-skills/issue-tracker-gitlab.md
snapshotPath: source-snapshots/mattpocock/setup-matt-pocock-skills/issue-tracker-gitlab.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/setup-matt-pocock-skills
---

# 议题跟踪器：GitLab

这个仓库的议题（issue）和规格（spec）都以 GitLab issue 的形式存在。所有操作都使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI。

## 约定

- **创建 issue**：`glab issue create --title "..." --description "..."`。多行描述用 heredoc。传 `--description -` 可以打开编辑器。
- **读取 issue**：`glab issue view <number> --comments`。需要机器可读输出时用 `-F json`。
- **列出 issue**：`glab issue list -O json`，配上合适的 `--label` 过滤条件。
- **评论 issue**：`glab issue note <number> --message "..."`。GitLab 把评论叫“note”。
- **添加 / 移除标签**：`glab issue update <number> --label "..."` / `--unlabel "..."`。多个标签可以用逗号分隔，也可以重复传这个参数。
- **关闭**：`glab issue close <number>`。`glab issue close` 不接受关闭评论，所以先用 `glab issue note <number> --message "..."` 发出说明，再关闭。
- **合并请求**：GitLab 把 PR 叫“merge request”。用 `glab mr create`、`glab mr view`、`glab mr note` 等，形状和 `gh pr ...` 一样，只是用 `mr` 代替 `pr`，用 `note`/`--message` 代替 `comment`/`--body`。

从 `git remote -v` 推断仓库；在克隆目录里运行时，`glab` 会自己完成这一步。

## 把合并请求当作分诊面

**把 MR 当作请求面：否。** _（如果这个仓库把外部合并请求当作功能请求，就改成 `yes`；`/triage` 会读取这个开关。）_

当设置为 `yes` 时，MR 会走和 issue 相同的标签与状态，使用对应的 `glab mr` 命令：

- **读取 MR**：`glab mr view <number> --comments`，看 diff 用 `glab mr diff <number>`。
- **列出待分诊的外部 MR**：先 `glab mr list -F json`，然后只保留作者不是项目成员/所有者的 MR（即贡献者提交的 MR，而不是维护者正在进行的工作）。
- **评论 / 加标签 / 关闭**：`glab mr note`、`glab mr update --label`/`--unlabel`、`glab mr close`。

与 GitHub 不同，GitLab 对 issue 和 MR 分开编号，所以一旦知道维护者指的是哪一面，`#42` 就没有歧义。

## 当某个技能说“发布到议题跟踪器”时

创建一个 GitLab issue。

## 当某个技能说“取出相关工单”时

执行 `glab issue view <number> --comments`。

## 寻路（wayfinding）操作

供 `/wayfinder` 使用。**地图（map）** 是一个单独的 issue，**子（child）** issue 就是工单。

- **地图**：一个打了 `wayfinder:map` 标签的 issue，正文承载 Notes / Decisions-so-far / Fog 三部分。`glab issue create --label wayfinder:map`。（在提供原生 epic 的 GitLab 套餐里，也可以用一个 epic 承载地图；打标签的 issue 在任何套餐都能用。）
- **子工单**：一个在描述顶部写着 `Part of #<map>`、并打了 `wayfinder:<type>` 标签（`research`/`prototype`/`grilling`/`task`）的 issue。一旦被认领，工单就指派给驱动它的开发者。
- **阻塞**：GitLab 的**原生阻塞链接**，这是规范的、界面上可见的表达方式。用 `/blocked_by #<n>` 快捷操作添加，以 note 形式发出（`glab issue note <child> --message "/blocked_by #<blocker>"`）。原生阻塞链接是 Premium/Ultimate 功能；在免费套餐（或该功能不可用）时，退回在描述顶部写一行 `Blocked by: #<n>, #<n>`。当所有阻塞者都已关闭时，工单即解除阻塞。
- **前沿查询**：`glab issue list -O json`，范围限定为地图的子项，剔除那些有未关闭阻塞者的：指向未关闭 issue 的原生 `blocked_by` 链接（`glab api projects/:id/issues/<child-iid>/links`），或 `Blocked by` 行里还有未关闭 issue，或已有指派；在地图顺序里排第一的胜出。
- **认领**：`glab issue update <n> --assignee @me`，这是本会话的第一次写入。
- **解决**：先 `glab issue note <n> --message "<answer>"`，然后 `glab issue close <n>`，最后往地图的 Decisions-so-far 里追加一条上下文指针（要点 + 链接）。