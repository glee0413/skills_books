---
id: mattpocock/triage/out-of-scope
title: out-of-scope
description: 说明 `.out-of-scope/` 知识库如何记录被拒绝的功能请求，以及分诊时如何查询和维护它。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/triage/OUT-OF-SCOPE.md
snapshotPath: source-snapshots/mattpocock/triage/out-of-scope.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/triage
---

# 范围外知识库

仓库里的 `.out-of-scope/` 目录存放被拒绝的功能请求的持久记录。它有两个用途：

1. **组织记忆**：记录一个功能为什么被拒绝，这样 issue 关闭后理由不会丢失
2. **去重**：当新 issue 与先前的拒绝项匹配时，技能可以提出之前的决策，而不是重新争论一遍

## Directory structure

```
.out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── graphql-api.md
```

每个**概念**一个文件，不是每个 issue 一个。要求同一件事的多个 issue 归在同一个文件下。

## File format

文件应当写得松弛、易读，更像一篇简短的设计文档，而不是数据库条目。用段落、代码示例和例子把理由讲清楚，让第一次遇到它的人也能用得上。

```markdown
# Dark Mode

本项目不支持深色模式，也不支持面向用户的主题定制。

## Why this is out of scope

渲染管线假定只有一套调色板，定义在
`ThemeConfig` 中。要支持多主题需要：

- 一个包裹整棵组件树的主题上下文提供者
- 按组件解析的主题感知样式
- 一层用于保存用户主题偏好的持久化

这是一次重大的架构改动，与项目聚焦内容创作的定位不符。
主题化是下游消费者的事，他们负责嵌入或再分发产物。

```ts
// 当前的 ThemeConfig 接口不是为运行时切换设计的：
interface ThemeConfig {
  colors: ColorPalette; // 单套调色板，在构建时确定
  fonts: FontStack;
}
```

## Prior requests

- #42: "Add dark mode support"
- #87: "Night theme for accessibility"
- #134: "Dark theme option"
```

### Naming the file

给概念取一个简短、描述性的 kebab-case 名字：`dark-mode.md`、`plugin-system.md`、`graphql-api.md`。名字应当足够可辨认，让人浏览这个目录时不用打开文件就知道被拒绝的是什么。

### Writing the reason

理由要有实质内容：不是“我们不想要这个”，而是为什么。好的理由会引用：

- 项目范围或理念（“本项目聚焦 X；主题化是下游的事”）
- 技术约束（“支持这个需要 Y，而它与我们的 Z 架构冲突”）
- 战略决策（“我们选择用 A 而不是 B，因为……”）

理由应当耐久。避免引用暂时情况（“我们现在太忙了”）；那不是真正的拒绝，只是推迟。

## When to check `.out-of-scope/`

分诊期间（第 1 步：收集上下文），读取 `.out-of-scope/` 下的所有文件。评估新 issue 时：

- 检查请求是否匹配某个已有的范围外概念
- 匹配依据是概念相似度，而不是关键词：“night theme”会匹配 `dark-mode.md`
- 如果有匹配，向维护者提出来：“这与 `.out-of-scope/dark-mode.md` 类似。我们之前拒绝过，理由是[理由]。你现在还这么看吗？”

维护者可能会：

- **确认**：新 issue 被追加到已有文件的“Prior requests”列表，然后关闭
- **重新考虑**：范围外文件被删除或更新，issue 走正常分诊流程
- **不同意**：这些 issue 相关但不相同，走正常分诊流程

## When to write to `.out-of-scope/`

只在**enhancement**（而非 bug）被以 `wontfix` *拒绝*时写入。这对 enhancement PR 与对 issue 完全一样：被拒绝的 PR 也记录在这里，免得同样的请求将来又以新代码的形式回来。

当某个东西因为**已经实现**而被以 `wontfix` 关闭时，**不要**写到这里。那是一个已建成的功能，不是被拒绝的；记录它会让去重检查被错误的拒绝项污染。此时应由关闭评论指出该功能已经在哪里。

流程是：

1. 维护者判定某个功能请求超出范围
2. 检查是否已有匹配的 `.out-of-scope/` 文件
3. 如果有：把新 issue 追加到“Prior requests”列表
4. 如果没有：新建一个文件，写入概念名、决策、理由和第一条先前请求
5. 在 issue 上发评论解释决策，并提到该 `.out-of-scope/` 文件
6. 用 `wontfix` 标签关闭 issue

## Updating or removing out-of-scope files

如果维护者对先前被拒绝的概念改变了想法：

- 删除该 `.out-of-scope/` 文件
- 技能不需要重新打开旧 issue；它们是历史记录
- 触发这次重新考虑的新 issue 走正常分诊流程