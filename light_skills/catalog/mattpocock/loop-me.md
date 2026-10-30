---
id: mattpocock/loop-me
title: loop-me
description: 通过持续追问，把用户生活中反复出现的循环写成可直接实现的 workflow 规格。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/in-progress/loop-me/SKILL.md
snapshotPath: source-snapshots/mattpocock/loop-me/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

运行一个带状态的 `/grilling` 会话，唯一产出是 **workflow** 规格。用追问的纪律（不放松、一次问一轮、每个问题附一个推荐答案），对准下面这套词汇和目标。随着追问解决一个个问题，创建、编辑和删除规格。

## 循环的视角

**循环（loop）**是用户生活中反复出现的模式：职业、一周、早晨、某个重复的活动。把生活看成层层嵌套的循环，能看出这些活动其实多么可预测，而这正是它们值得**委派**的原因。用这个视角找出值得写规格的循环，并提出用户自己还没注意到的循环。

**workflow** 是一个循环的规格，落到实处。你在一段循环上运行 workflow：循环是它运行中的实例。Workflow 存放在 `workflows/*.md`，是唯一的事实源。

## 词汇

一套共享语言，只在 workflow 需要时才取用：绝不是清单。**不要规定任何结构性内容**：除非追问表明需要，否则 workflow 不需要 AI，不需要检查点，也不需要时间表。

- **Trigger（触发）**：每次运行由什么触发，一个**事件**（新邮件、新 issue）或一个**时间表**（每天早上）。事件触发通常更高效。
- **Checkpoint（检查点）**：人在环中的一点，用户被要求验证或决策。有些 workflow 没有任何检查点，自主运行；有些完全不用 AI。
- **Push right（后推）**：把检查点尽可能往后推。在请人介入之前做尽可能多的工作，这样人只被问一次、问得晚，而且一切已经备好。
- **Brief（简报）**：检查点呈现的东西，一份紧凑、可直接决策的摘要（产出了什么、为什么、以及指向产物本身的链接），绝不是原始输出。用户读的是简报，不是草稿。审查的速度至关重要。

## 完成的定义

当一个实现者 agent 能不问任何问题就把它构建出来时，workflow 规格就算完成。追问到那一刻为止；只要还剩一个问题，就没有完成。

## 工作区

- `workflows/*.md`：每个 workflow 一份规格。
- `NOTES.md`：关于用户的世界、他们使用的工具、他们处理的渠道，以及他们对这两者的自有术语的原始笔记。当它为空或单薄时，先访谈他们的世界，再写任何规格。随着模糊的术语浮现，把它们打磨成规范术语，并记录在这里。