# Microduck 机器人系统实战

以 Pollen Robotics 的 Microduck 为样本，学习一个真实机器人系统怎样把控制回路、IPC、感知、交互、更新和远程访问拆成可维护的 Rust 服务。

## 这本书怎么读

- 想先建立整体图：读“Microduck 是什么”和“七个 daemon 与一个机器人”。
- 想理解控制：读 `robotd`、控制核心、运动学与感知。
- 想理解交付：读更新系统、远程访问、构建与测试。
- 想上手开发：读开发板、开发推送与仿真。

## 目录

- `book/`：主题章节。
- `catalog/`：设计文档、使用文档和关键源码模块的中文精读。
- `source-snapshots/`：固定 commit 的英文原文和代码片段，只读。
- `site/`：生成的静态 HTML。
- `sources.json`：来源、版本、哈希和状态。
- `book.json`：章节与目录。

## 来源

- 仓库：https://github.com/pollen-robotics/microduck
- 固定 commit：`b2b0d213a402caeac492dd662ea891faa17f67c0`
- 许可证：Apache-2.0

## 运行

```bash
npm ci
npm run build
npm run check
npm run serve -- --port 4175
```