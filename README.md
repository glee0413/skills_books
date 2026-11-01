# Skills Books

把开源项目读成中文书。每本书固定来源 commit，带英文/代码快照、可离线阅读的静态 HTML，以及一份中文精读目录。

## 书架

三本书已在同一入口下：

| 分类 | 书 | 内容 |
|---|---|---|
| 机器人与实时系统 | `microduck_book` | 15 个舵机的 50 Hz 控制回路、感知、签名更新与 WebRTC |
| 授权与安全 | `cedar_book` | Cedar 策略语言、Schema、Rust SDK 与示例 |
| 方法与工作流 | `light_skills` | gstack 与 mattpocock 两个 agent 技能库的中文精读 |

## 启动

不需要安装依赖，`site/` 已经提交：

```bash
npm start          # http://127.0.0.1:4180/
```

首页按分类陈列所有书，点进去直接读。每本书也可以单独预览：

```bash
cd microduck_book && npm run serve -- --port 4175
```

## 新增一本书

1. 建目录，写 `book.json`、`sources.json`，跑该书的 `npm run build`。
2. 在 `book.json` 里加 `shelf`：

   ```json
   "shelf": {
     "category": "robotics",
     "blurb": "一句话说明这本书讲什么。",
     "tags": ["Rust", "控制"],
     "order": 1
   }
   ```

3. 根目录 `npm run check`，刷新首页即可看到新书。

分类在 `bookshelf.json` 中定义；没有声明分类的书会落到“未分类”，不会消失。详细规则见 `AGENTS.md`。

## 仓库结构

- `bookshelf.json`：书架的分类树。
- `scripts/shelf.mjs`：书架服务与首页渲染，`npm start` / `npm run check` / `npm test`。
- `light_skills/`、`cedar_book/`、`microduck_book/`：三本书的完整产物（书稿、快照、站点、构建脚本）。
- `skills/`：本项目自己的可复用技能，例如 `source-to-book`。
- `opensrc/`：只读的上游仓库，被 `.gitignore` 排除。