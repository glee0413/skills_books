---
id: mattpocock/to-spec
title: to-spec
description: 把当前对话整理成一份规格并发布到项目的议题跟踪器，只做综合，不再采访用户。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/to-spec/SKILL.md
snapshotPath: source-snapshots/mattpocock/to-spec/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

这个技能取用当前的对话上下文和对代码库的理解，产出一份规格（spec）。不要采访用户，只管综合你已知的内容。

议题跟踪器和分诊标签词表应当已经提供给你。如果没有，请让用户运行 `/setup-matt-pocock-skills`。

## Process

1. 如果你还没做过，先浏览仓库，了解代码库的当前状态。整份规格都要使用项目的领域术语表词汇，并遵守你所触及领域的 ADR。

2. 勾画出你打算在哪些接缝上测试这个功能。优先复用已有接缝，而不是新建。用尽可能高的接缝。如果确实需要新接缝，就在你能找到的最高位置提出。整个代码库里的接缝越少越好，理想数量是一个。

与用户确认这些接缝符合他们的预期。

3. 用下面的模板写出规格，然后发布到项目的议题跟踪器。打上 `ready-for-agent` 分诊标签，不需要再做额外的分诊。

<spec-template>

## Problem Statement

用户正面临的问题，从用户的视角描述。

## Solution

这个问题的解决方案，从用户的视角描述。

## User Stories

一份长长的、带编号的用户故事列表。每条用户故事都应当是这种格式：

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

这份用户故事列表应当极其详尽，覆盖这个功能的方方面面。

## Implementation Decisions

列出已经做出的实现决策。可以包括：

- 将要构建/修改的模块
- 这些模块中将被修改的接口
- 来自开发者的技术澄清
- 架构决策
- 模式变更
- API 契约
- 具体的交互

不要写具体的文件路径或代码片段，它们可能很快就会过时。

例外：如果某个原型产出的片段比文字更能精确表达一个决策（状态机、reducer、schema、类型形状），就把它内联到相关决策下面，并简要说明它来自原型。只保留决策密集的部分，不要放可运行的演示，只要关键内容。

## Testing Decisions

列出已经做出的测试决策。包括：

- 描述什么算好的测试（只测外部行为，不测实现细节）
- 哪些模块会被测试
- 测试的先例（即代码库中类似类型的测试）

## Out of Scope

描述这份规格不涵盖的内容。

## Further Notes

关于这个功能的任何其他说明。

</spec-template>