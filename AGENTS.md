# AGENTS.md

## 这个仓库是什么

这是一个长期维护的 skills 学习工程。目标是把多个开源 agent skill 项目翻译、对照、总结成一本中文书，同时产出 Markdown 和可离线阅读的 HTML。

当前收录：

- `gstack/`：只读来源，`https://github.com/garrytan/gstack`，固定 commit `8d9501373b55897447ae30f1d281c4dbc8a1369e`，版本 `v1.91.226.0`。
- `mattpocock_skills/`：只读来源，`https://github.com/mattpocock/skills`，固定 commit `5beb35b040e3de97e54fa9e386d7e42d15c295c2`，`git describe` 为 `v1.3.1-47-g5beb35b`。
- `light_skills/`：本书的全部产物，包括 Markdown 书稿、英文快照、生成的 HTML、构建脚本和来源清单。

两个上游仓库是独立 git 仓库，已被 `.gitignore` 排除，不要把它们加入本仓库索引，也不要在里面提交改动。

## 先读什么

- 设计文档：`docs/superpowers/specs/2026-10-29-skills-book-design.md`
- 当前实施计划：`docs/superpowers/plans/2026-10-29-skills-book-foundation-and-pilot.md`
- 来源与版本：`light_skills/sources.json`
- 术语统一：`light_skills/GLOSSARY.md`
- 翻译规则：`light_skills/TRANSLATION.md`
- 许可证与归属：`light_skills/NOTICE.md`
- 项目技能：`skills/source-to-book/SKILL.md`（把新的开源项目或知识材料整理成书时先读它）

## 常用命令

```bash
cd light_skills
npm ci
npm run check          # 日常校验，允许尚未翻译的 todo
npm run check:release  # 发布校验，要求全部完成
npm run check:sources  # 校验英文快照；加 -- --upstream 对比同级上游
npm run build          # 重新生成 site/
npm run stats          # 查看各项目和状态的篇数
npm run serve          # 本地预览，默认 127.0.0.1:4173
```

## 写译文的规则

- 每篇译文对应一个 `SKILL.md` 或一篇 mattpocock 同目录必读文档，来源信息以 `sources.json` 为准。
- 原文的英文快照保存在 `source-snapshots/`，翻译时读快照，不直接依赖同级上游 checkout。
- 保留原文的标题层级、代码块、命令、路径、URL 和技能名。
- 译者注只能是 `> 译者注：` 引用块，且不能包含标题或代码围栏；结构校验会忽略这些块。
- 不要在译文正文里加“来源框”“技能速览”或“附属文档”导航，它们由构建脚本生成。
- 新术语先在 `GLOSSARY.md` 统一，再使用；同一概念不要在一页里换译名。

## Git 规则

- 分支 `main`，每个逻辑变更单独 commit。
- 提交说明使用中文，格式为 `<type>(<scope>): <摘要>`，正文写清来源、原因和验证命令。
- 从工程骨架完成后，每个 commit 都要通过 `npm run check`。
- 同一变更的 Markdown、来源元数据、英文快照、生成的 HTML 和 `CHANGELOG.md` 放在同一个 commit。
- 不把无关改动混进同一个 commit。
- `CHANGELOG.md` 是给人读的摘要，按日期记录“改了什么、来源、为什么”，不替代 git 历史。

## 生成物

`light_skills/site/` 是提交到 git 的生成物。修改 Markdown 后运行 `npm run build`，并把 `site/` 一起提交。`npm run check` 会检查 HTML 是否与 Markdown 同步。