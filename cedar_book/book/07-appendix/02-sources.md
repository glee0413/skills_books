# 来源、许可证与版本

这本书不是 Cedar 官方中文文档，而是基于三个固定 commit 的学习性衍生作品。书中引用的章节内容、代码片段和术语都能追溯到 `sources.json` 里的条目；英文原文保存在 `source-snapshots/`，用于离线核对和重新翻译。完整的归属声明见 `NOTICE.md`，机器可读的来源清单见 `sources.json`。

## 三个上游项目

| 项目 | 仓库 | 固定 commit | 版本/描述 | 许可证 |
|---|---|---|---|---|
| Cedar 文档 | `cedar-policy/cedar-docs` | `a0b28494644671804c60301fee4d59f5fc4fbd99` | `a0b2849` | Apache-2.0 |
| Cedar SDK | `cedar-policy/cedar` | `d5fb0422e6edb8617b595428530224663e122668` | `v4.3.0-782-gd5fb0422` | Apache-2.0 |
| Cedar 示例 | `cedar-policy/cedar-examples` | `f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37` | `f4d2dbb` | Apache-2.0 |

三个仓库都是独立 git 仓库，放在 `opensrc/` 下，已被本书仓库的 `.gitignore` 排除。不要把它们加入本书索引，也不要在里面提交改动；本书只读取固定 commit 的内容。

## 本书覆盖了什么

- **文档**：`cedar-docs` 全部 48 个实际内容页，覆盖术语、场景、授权流程、策略语法、实体与 JSON 语法、数据类型、操作符、验证、模板、JSON 格式、schema 四篇、安全、19 篇最佳实践、授权模式、策略示例、设计模式、集成、版本历史和文档首页。
- **SDK**：仓库总览、`cedar-policy` Rust API、CLI、WASM、symcc，共 5 个条目。
- **示例**：示例仓库总览、TinyTodo 教程、六个真实用例总览、Rust Hello World，共 4 个条目。

章节与条目的对应关系写在 `book.json` 的 `sources` 字段里；每个知识库条目顶部还标注了原路径、commit、快照路径和许可证。

## 没有覆盖什么

本书刻意排除了以下内容，避免把“学习书”写成“上游镜像”：

- Cedar 的 Rust 实现源码、测试套件、语言服务器实现和 WASM 内部细节；只保留公开 README 和 API 用法。
- Lean 形式模型和 `cedar-spec` 仓库；安全章节只引用其结论，不展开证明。
- Cedar 文档中的图片、include 片段、静态资源和 Amazon Verified Permissions 专有文档；48 个实际内容页已全部覆盖，6 行重定向桩不计入。
- 示例仓库里的 TinyTodo 完整实现、其他语言的 hello world、基准测试和策略语言实战等目录；TinyTodo 只取教程。
- 六个用例目录中的全部策略文件没有逐一存快照，只存了用例总览 README；章节引用的策略、schema、链接文件和夹具来自同一固定 commit 的 `opensrc/cedar-examples/`。`sales_orgs/` 是上游额外的变体目录，不在本书六个用例之列。

## 许可证与归属

三个上游项目均使用 Apache-2.0。许可证全文分别在 `third-party/cedar-docs-LICENSE`、`third-party/cedar-LICENSE`、`third-party/cedar-examples-LICENSE`。翻译、改写和章节导读是本书新增内容；书稿自身的内容许可证尚未决定。引用本书时，请同时保留上游项目名称、commit 和 Apache-2.0 归属。

## 如何重新同步

同步的目标是“换 commit，但不丢可追溯性”。建议按下面顺序操作：

```bash
#1. 在只读来源里切到新 commit
cd opensrc/cedar-docs
git fetch origin
git checkout <new-commit>
git rev-parse HEAD

#2. 把选定的原文件复制到快照目录，保持相对路径
cp docs/collections/_overview/terminology.md \
   ../../cedar_book/source-snapshots/cedar-docs/docs/collections/_overview/terminology.md

#3. 计算新哈希，更新 sources.json 的 commit、ref、sourceSha256
cd ../../cedar_book
sha256sum source-snapshots/cedar-docs/docs/collections/_overview/terminology.md
```

四个要点：

1. 一次只升一个项目，先更新快照和 `sources.json`，再改译文；不要把三个仓库的升级混在一个 commit。
2. 内容变化的条目要把 `translationStatus` 重置为 `todo`、`translatedAt` 置空，翻译完成后再标记；只改 commit 没改内容时，也要更新 `sourceSha256`。
3. 策略或 API 行为变化时，先重跑该条目关联章节里的命令和夹具，再改文字；不能只改版本号。
4. 完成后运行 `npm run build` 和 `npm run check`，确认快照哈希、章节路径、知识库条目和生成的 HTML 一致，并在 `CHANGELOG.md` 记录来源、原因和验证命令。

如果只想核对某个条目是否漂移，直接对比 `sources.json` 里的 `sourceSha256` 与当前快照的 `sha256sum`；不一致就说明快照被改动或同步不完整。章节里引用的策略片段应与固定 commit 的 `opensrc/` 内容一致，若上游已改而本书未重译，以 `sources.json` 记录的 commit 为准。