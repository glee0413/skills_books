---
id: gstack/hackernews-frontpage
title: hackernews-frontpage
description: 抓取 Hacker News 首页，返回前 30 条故事的标题、分数、链接和评论数。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: browser-skills/hackernews-frontpage/SKILL.md
snapshotPath: source-snapshots/gstack/hackernews-frontpage/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# Hacker News 首页抓取器

抓取 Hacker News（`news.ycombinator.com`）首页，把前 30 条故事以 JSON 返回。每条故事包含排名、标题、链接 URL、分数和评论数。

## 用法

```
$ $B skill run hackernews-frontpage
{
  "stories": [
    { "rank": 1, "title": "...", "url": "...", "points": 412, "comments": 87 },
    ...
  ],
  "count": 30
}
```

## 它如何工作

1. 通过 daemon 导航到 `https://news.ycombinator.com`。
2. 读取页面 HTML。
3. 把每一行故事（HN 稳定的 `tr.athing` 结构）解析成带类型的 `Story` 记录。
4. 在 stdout 上输出单个 JSON 文档。

## 为什么它是参考技能

`hackernews-frontpage` 是最小的、有意义的浏览器技能：不需要鉴权、HTML 稳定、输出确定、便于使用文件 fixture。Phase 1 的每个组件（SDK、带作用域的令牌、三级查找、spawn 生命周期）都由 `$B skill run hackernews-frontpage` 和随附的 `script.test.ts` 覆盖。

当 HN 的 HTML 改版、我们的选择器失效时，测试会先对着捕获的 fixture 失败，用户还没察觉。这正是它的意义。