---
id: mattpocock/to-questionnaire
title: to-questionnaire
description: 把一个用户自己答不了的决策，转成一份交给别人填写的问卷。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/to-questionnaire/SKILL.md
snapshotPath: source-snapshots/mattpocock/to-questionnaire/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

把用户无法独自回答的事情，变成一份**问卷**：一份 Markdown 文档，他们可以交给某一个人异步填写，也可以在会议里一起填完。收件人掌握着用户缺少的知识，问卷负责把这些知识取出来。

**追问的是“发送”，不是主题。** 你只就_发送_这件事采访用户，因为这一部分他们总能回答：发给谁，需要拿回什么。文档里随后的问题，则对准收件人所知与用户所需之间的**缺口**。

1. **这份问卷发给谁？** 用一次交流问清收件人的角色、专长，以及与用户的关系。这决定了问卷的语气，以及它必须承载多少背景信息。当你知道了收件人是谁、他们知道哪些用户不知道的事，这一步就完成了。

2. **你需要拿回什么？** 用一次交流问清用户无法独自解决、必须从这个人那里得到的具体决策或事实。当你拿到一份明确的清单、知道用户走完这一程必须能做什么或能决定什么，这一步就完成了。

3. **写问卷。** 按第 1–2 步发现的缺口起草问题，遵循下面的文档结构。把它写到当前目录下的 `to-questionnaire-<slug>.md`（slug 取自主题），并报告路径。当文件存在、且用户在第 2 步点到的每一项都有对应问题时，这一步就完成了。

## 文档结构

把这份文档写成一份**发现式问卷**：用户缺少上下文，收件人手里有。问题按最重要优先排序，因为异步意味着你可能只得到一次机会；一旦问题多到一把抓不住，就用 `##` 标题按主题分组。用下面的模板来写。

<questionnaire-template>

# <问卷标题>

**Purpose:** 这份问卷为什么存在，以及压在上面的那个决策是什么。

**From:** <用户>，**To:** <收件人>，**How your answers will be used:** <答案会去哪里>

## Context

用一段话为不在用户脑子里的收件人做定位。足够他们答得好，但不要写成整页。

## How to answer

截止时间和大致投入。部分回答和“我不知道”同样有用：对不确定的地方做标记，而不是跳过。

## <主题标题>

每个主题一个 `##` 章节。每节下面放该主题的问题，最重要的在前。每个问题只表达一个想法，绝不合在一起；问题正下方留一个作答占位；只有在这个问题可能被误读、或容易被敷衍时，才补一行_为什么这重要_。

<question-example>
### What load is the system expected to handle at launch?

_为什么这重要：它决定我们现在就要为突发流量做容量规划，还是可以往后推。_

>
</question-example>

## Anything else?

收尾的兜底一问：还有什么是我们没问、但我们应该知道的？

</questionnaire-template>