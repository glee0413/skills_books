# 书架入口（Bookshelf Portal）设计

日期：2026-11-01 · 状态：已确认（方案 C）

## 意图

仓库里已有三本书（`light_skills`、`cedar_book`、`microduck_book`），各自 `npm run serve` 起在不同端口。书会继续增加，需要**一个入口**：启动一次，打开首页，像书架一样按分类看到所有书，点进去直接读。

## 目标

- 一条命令启动：根目录 `npm start`，首页 `/` 是书架，每本书挂在 `/books/<目录名>/` 下。
- 分类由根目录 `bookshelf.json` 集中定义（名称、说明、顺序、配色）；每本书在 `book.json` 里用 `shelf.category` 声明归属，并给出简介、标签、排序。
- 新书零配置成本：新建目录、写 `book.json`、跑构建，首页自动出现；没声明分类的书落到“未分类”，不会消失。
- 首页支持按分类过滤与关键词搜索（书名、副标题、简介、标签）。
- 每张书卡显示：书名、副标题、简介、章节数、条目数、来源 commit、进入阅读 / 知识全库入口。
- `npm run check` 校验书架元数据（分类存在、目录存在、站点已构建、slug 不重复）。

## 非目标

- 不做账号、收藏、阅读进度同步。
- 不改三本书各自的构建产物与站内链接；书架只做挂载。
- 不引入第三方依赖，不新建前端框架工程。

## 方案

- **C（采纳）**：中央分类树 + 书自报归属。分类顺序与配色集中管理；书只声明“我是哪类”。相比 A（全部手写清单）不会漏书，相比 B（分类散在书里）能保证分类顺序和空分类有统一处理。

## 实现要点

- 根 `package.json`：`start` / `serve` → `node scripts/shelf.mjs`；`check` → `node scripts/shelf.mjs --check`；`test` → `node --test`。
- `scripts/shelf.mjs`：
  - 发现：扫描根目录与 `books/` 下一层的 `book.json`，跳过 `node_modules`、`opensrc`、`docs`、`skills` 等。
  - 元数据：`book.json` 的 `title`/`subtitle`/`parts`/`catalog`，`sources.json` 的 commit 与完成数，`book.json.shelf` 的分类与简介。
  - 渲染：服务端拼 HTML，内联 CSS 与少量原生 JS（过滤、搜索），配色沿用书内 `--bg/--ink/--accent` 的暖纸风格。
  - 服务：`/` 书架，`/books/<slug>/<path>` 静态挂载 `<slug>/site/`，`/api/books` 返回发现结果，路径穿越防护沿用现有 `serve.mjs` 做法。
  - `--check`：分类合法、`site/index.html` 存在、slug 唯一、`shelf.order` 唯一（重复则警告）。
- 每本书 `book.json` 增加：
  ```json
  "shelf": { "category": "robotics", "blurb": "一句话简介", "tags": ["Rust"], "order": 1 }
  ```
- 文档：`AGENTS.md` 增加入口命令；根 `CHANGELOG.md` 记录本次新增。

## 留给实现者

- 分类初始三条：方法与工作流（`methods`）、机器人与实时系统（`robotics`）、授权与安全（`security`）。
- 端口默认 `4180`，可用 `--port` 覆盖。
- 深色模式不做；移动端单列，桌面端三列网格。