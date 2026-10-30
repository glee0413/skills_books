# Skills Book 全量翻译 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成剩余 98 个技能和 20 篇附属文档的中文翻译，写“gstack 与 mattpocock_skills 相同与差异”独立章节，并让 `check:release` 通过。

**Architecture:** 以 `sources.json` 为唯一来源清单，按批次把源快照翻译到 `catalog/`。每批由独立子代理执行，只写自己的目标文件；主代理负责路径规范化、状态合并、构建和全量校验。翻译结构由 `check-page` 和 `check:release` 逐页把关。

**Tech Stack:** Markdown、Node.js、现有 `scripts/check-page.mjs`、`scripts/mark-complete.mjs`、`scripts/build.mjs`。

**Spec:** `docs/superpowers/specs/2026-10-29-skills-book-design.md`

## Global Constraints

- 剩余范围：gstack 62 篇、mattpocock 36 篇技能、mattpocock 20 篇附属文档，共 118 篇。
- gstack 译文从第一个 H1 开始，通用运行时前言不翻译。
- 带附属文档的技能页路径为 `catalog/<project>/<skill>/SKILL.md`。
- 每页保留源文标题数和代码围栏数；译者注只能是 `> 译者注：` 引用块。
- 不修改 `sources.json` 的状态；由主代理在页面通过 `check-page` 后统一标记。
- 每个批次完成后只提交该批次涉及的文件；最终统一构建 `site/` 并打标签。

## Tasks

### Task 1: 规范化技能页路径

- [x] 修改 `scripts/lib/inventory.mjs`：有附属文档的父技能使用 `<skill>/SKILL.md`。
- [x] 重新运行 `scripts/scan-sources.mjs`，保留已有完成状态。
- [x] 测试 `node --test scripts/__tests__/inventory.test.mjs`。

### Task 2: 并行翻译 28 个批次

- [x] 生成 `/tmp/opencode/skills-book-batches/batch-01.json` 到 `batch-28.json`。
- [x] 启动 28 个独立翻译子代理。
- [ ] 收集每个批次的完成 ID 和阻塞项。
- [ ] 对失败页面逐页修复。

### Task 3: 标记完成并全量校验

- [ ] 运行 `npm run mark-complete`。
- [ ] 运行 `npm run check`，修复所有结构、frontmatter、链接问题。
- [ ] 运行 `npm run check:release`，直到 0 error。

### Task 4: 对比分析章节

- [x] 新增 `book/01-two-paradigms/01-same-and-different.md`。
- [x] 加入 `book.json` 第一部。
- [ ] 构建后检查章节链接和排版。

### Task 5: 构建、提交、发布

- [ ] 运行 `npm run build`。
- [ ] 运行 `npm run check` 和 `npm run stats`。
- [ ] 更新 `CHANGELOG.md`。
- [ ] 分批提交翻译，最终提交构建和章节。
- [ ] 打标签 `v1.0.0` 并推送 `main` 和标签。