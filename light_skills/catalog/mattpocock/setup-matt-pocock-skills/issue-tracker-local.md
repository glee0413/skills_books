---
id: mattpocock/setup-matt-pocock-skills/issue-tracker-local
title: issue-tracker-local
description: 只用 .scratch/ 下的 Markdown 文件承载议题与规格时，各技能应当遵守的目录与状态约定。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md
snapshotPath: source-snapshots/mattpocock/setup-matt-pocock-skills/issue-tracker-local.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/setup-matt-pocock-skills
---

# 议题跟踪器：本地 Markdown

这个仓库的议题（issue）和规格（spec）都是 `.scratch/` 下的 markdown 文件。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- 规格文件是 `.scratch/<feature-slug>/spec.md`
- 实现类 issue 是一个工单一个文件，放在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号，绝不用一个合并的 tickets 文件
- 分诊状态记录为每个 issue 文件靠顶部的一行 `Status:`（各角色字符串见 `triage-labels.md`）
- 评论和对话历史追加到文件底部，放在 `## Comments` 标题下

## 当某个技能说“发布到议题跟踪器”时

在 `.scratch/<feature-slug>/` 下新建一个文件（需要时先建目录）。

## 当某个技能说“取出相关工单”时

读取所引用路径上的文件。用户通常会直接给出路径或 issue 编号。

## 寻路（wayfinding）操作

供 `/wayfinder` 使用。**地图（map）** 是一个文件，每个工单对应一个**子（child）**文件。

- **地图**：`.scratch/<effort>/map.md`（正文是 Notes / Decisions-so-far / Fog 三部分）。
- **子工单**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 开始编号，正文里写问题本身。一行 `Type:` 记录工单类型（`research`/`prototype`/`grilling`/`task`）；一行 `Status:` 记录 `claimed`/`resolved`。
- **阻塞**：靠顶部一行 `Blocked by: NN, NN`。当它列出的每个文件都是 `resolved` 时，工单即解除阻塞。
- **前沿**：扫描 `.scratch/<effort>/issues/`，找出未关闭、未被阻塞、未被认领的文件；编号最小的胜出。
- **认领**：先设置 `Status: claimed` 并保存，再开始任何工作。
- **解决**：在 `## Answer` 标题下追加答案，设置 `Status: resolved`，然后往 `map.md` 里地图的 Decisions-so-far 追加一条上下文指针（要点 + 链接）。