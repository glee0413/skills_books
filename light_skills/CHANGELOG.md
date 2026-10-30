# 变更记录

这个文件给人读，记录每个阶段改了什么、来源是什么、为什么改。精确记录以 git 历史为准。

## 2026-10-29

### 新增

- 初始化 Skills Book 工程，采用“主题主书 + 全量附录”结构。
- 固定 gstack 与 mattpocock 的来源 commit，加入 123 份英文原文快照。
- 建立 `sources.json`、`book.json`、术语表和翻译规范。
- 复制两个上游的 MIT 许可证和归属说明。
- 新增 gstack/office-hours 译文。来源 gstack 8d95013。原因：产品追问主题的试点篇。
- 新增规则：gstack 译文从第一个 H1 开始，通用运行时前言保留在英文快照中，不进入书稿。
- 新增 mattpocock/grilling 译文。来源 mattpocock 5beb35b。原因：补齐产品追问对照。
- 新增 mattpocock/tdd、tdd/tests、tdd/mocking 译文。原因：试点覆盖技能加附属文档的形态。
- 新增“产品追问”对照章，比较 office-hours 与 grilling 的分工。

### 试点

- 完成 office-hours、grilling、tdd 及 tdd 的两篇附属文档。
- 完成“产品追问”对照章，验证主题主书结构。
- 试点确认后进入剩余 98 个技能和 20 篇附属文档的全量翻译。

### 修正

- 修复译文页把 YAML frontmatter 渲染进正文的问题，并加入回归测试。
- 加入 HTML 新鲜度校验：Markdown 改动后未重建 `site/` 会报 `site-out-of-date`。
- 补上页内目录、变体标签区分、来源框的翻译日期与快照路径。
- `scan-sources` 改为合并已有状态，避免同步上游时把 `complete` 重置成 `todo`。
- 发布模式增加空正文和占位文本检查。
- 测试改为在上游 checkout 缺失时跳过集成用例，并补上 `--upstream` 和统计测试。
- `npm run serve` 支持 `--port` 和 `--host`，端口占用时给出可操作的提示。
- 修正正文布局：侧边栏改为网格布局，去掉重复的左侧 padding，正文从约 400px 恢复到约 848px 的可读宽度。
