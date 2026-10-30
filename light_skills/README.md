# Skills Book

把多个开源 agent skill 项目翻译、对照、总结成一本中文书。第一版收录 gstack 与 mattpocock/skills。

## 目录

- `book/`：主题主书。按研发阶段组织，章节做跨项目对照。
- `catalog/`：技能全库。每个技能和附属文档的完整中文译文。
- `source-snapshots/`：固定 commit 的英文原文，只读，用于追溯和离线校验。
- `site/`：生成的静态 HTML，可直接打开 `site/index.html`。
- `assets/book.css`：站点样式的源文件；构建时复制到 `site/assets/book.css`。
- `scripts/`：扫描、校验、构建、预览脚本。
- `third-party/`：两个上游的 MIT 许可证原文。
- `sources.json`：来源、版本、commit、哈希和翻译状态。
- `book.json`：目录顺序与技能归属。
- `GLOSSARY.md`：中英术语统一表。
- `TRANSLATION.md`：翻译规范和检查清单。
- `NOTICE.md`：上游归属、许可证和修改说明。

## 命令

```bash
npm ci
npm run check
npm run check:release
npm run check:sources
npm run build
npm run stats
npm run serve
npm run serve -- --port 8001
```

## 阅读

构建后打开 `site/index.html`。也可以直接读 `book/` 和 `catalog/` 下的 Markdown。

## 来源

- gstack：https://github.com/garrytan/gstack，MIT。
- mattpocock/skills：https://github.com/mattpocock/skills，MIT。

具体版本与 commit 见 `sources.json` 和 `NOTICE.md`。