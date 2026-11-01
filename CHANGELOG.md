# 变更记录

## 2026-11-01

### 新增

- 书架入口：根目录 `npm start` 启动一个服务，首页 `/` 按分类陈列所有书，每本书挂在 `/books/<目录名>/` 下。
- `bookshelf.json`：集中定义分类（名称、说明、顺序、配色）与未分类兜底。
- `scripts/shelf.mjs`：发现带 `book.json` 的目录，合并 `book.json` 与 `sources.json` 的书名、章节数、条目数、完成数、来源 commit，渲染书架页；`--check` 校验分类与构建产物。
- `scripts/__tests__/shelf.test.mjs`：发现、校验、分组、渲染转义、静态挂载与路径穿越防护的测试。
- 三本书的 `book.json` 增加 `shelf` 元数据：`light_skills` → 方法与工作流，`microduck_book` → 机器人与实时系统，`cedar_book` → 授权与安全。
- 设计文档：`docs/superpowers/specs/2026-11-01-bookshelf-portal-design.md`。

### 验证

- `npm run check`：3 本书、3 个分类、0 problem。
- `npm test`：9 个测试通过。
- `npm start` 后 `/`、三本书首页、书内章节与 `assets/book.css` 均返回 200。