# 翻译规范

## 翻译对象

- 两个项目的全部 101 个非测试 `SKILL.md`。
- mattpocock 技能目录内、被 `SKILL.md` 明确要求阅读的 22 篇同目录 Markdown。
- gstack 只翻译提交后的 `SKILL.md`；`sections/`、`.tmpl` 和脚本已经折叠进生成文件，不重复翻译。
- gstack 的译文从第一个 H1 开始。H1 之前的通用运行时前言（Preamble、AskUserQuestion 格式、遥测等）保留在英文快照中，不翻译。没有 H1 的技能从正文开头翻译。
- 不翻译脚本、测试、模板、图片、完整 docs 站点、bucket README、`pr/CREDITS.md`、CHANGELOG 和生成配置。

## 文体

- 用中文技术写作，清楚、克制，不写成营销文案。
- 保留原文的标题层级、表格、代码块、命令、路径、URL 和链接。
- 命令、代码、路径、URL、frontmatter 键名、技能名、工具名保留原文。
- 术语第一次出现可以给英文原词，之后按 `GLOSSARY.md` 的统一译法。
- 原文有歧义就保留歧义，用译者注说明，不要替作者做决定。
- 长文按原文章节翻译，不做“摘要代替翻译”。

## 译者注

译者注只能写成引用块：

```markdown
> 译者注：这里解释一个原文没有展开的背景。
```

译者注不能包含标题或代码围栏。结构校验会忽略以 `> 译者注：` 开头的块，其他新增标题或代码块一律视为结构不一致。

## 页面结构

译文页的 Markdown 只包含：

1. YAML frontmatter：`id`、`title`、`description`、`invocation`、`project`、`sourceCommit`、`sourceRef`、`sourcePath`、`snapshotPath`、`license`、`translatedAt`。
2. 原文正文的完整翻译。

来源框、技能速览、附属文档导航和上一篇/下一篇都由构建脚本生成，不要手写进 Markdown。

## 结构对照

- 去掉 YAML frontmatter 后，源文与译文的标题数量必须一致。
- 代码块数量必须一致。
- `> 译者注：` 块不参与计数。
- 源文和译文的命令、路径、版本号、链接必须逐字保留。
- 每篇译文必须有来源记录，`sourceSha256` 与英文快照一致。

## 质量检查

- 每批至少抽查 10%，重点看同一概念是否出现多种译名。
- 新增术语必须同一个 commit 更新 `GLOSSARY.md`。
- 译文完成后运行 `npm run check`；发布前运行 `npm run check:release`。
- 如果上游更新，先更新 `sources.json`、快照和 `CHANGELOG.md`，再重译受影响段落。