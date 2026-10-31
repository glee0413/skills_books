---
id: cedar-docs/resources
title: 学习资源
description: 汇总 Cedar 的在线演练场、示例仓库、托管策略服务与社区入口，并说明各自适合什么场景。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_overview/resources.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_overview/resources.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_overview/resources.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 学习资源

原文用一页链接回答“接下来去哪儿”：想先看 Cedar 跑起来、想把它做成服务、或想边学边改示例，可以分别走下面几条路。

## 在线试验：Cedar Playground

[Cedar playground](https://www.cedarpolicy.com/en/playground) 在浏览器里提供完整的策略编辑与授权试验环境：写策略、构造请求、查看决策，一步到位。它最适合验证语法细节和条件语义——改一改 `principal`、`action`、`resource`、`context` 与实体数据，就能观察 permit/forbid 的匹配情况。准备一份最小策略、一份实体列表和一个请求，就足以复现书里的例子；本书讲过的模板占位符、`in` 的传递性、`has` 的存在性保护，都能在这里用最小例子试出来，不必先搭工程。

## 示例应用：cedar-examples

[cedar-examples](https://github.com/cedar-policy/cedar-examples/) 收集了可直接运行的示例应用。原文特别推荐 [tinytodo](https://github.com/cedar-policy/cedar-examples/tree/release/3.2.x/tinytodo)：它既是示例也是入门教程，从命令行操作到一次完整的授权决策都有覆盖，适合在读完语法后立刻上手。

本书已经把其中两条线整理成了条目：[TinyTodo 教程](../cedar-examples/tinytodo-tutorial.md) 按教程顺序走一遍命令与策略，[六个真实用例](../cedar-examples/use-cases.md) 则覆盖文档云、GitHub、酒店、标签角色、税务与流媒体等场景。可以先读条目建立框架，再回仓库跑代码对照。

## 托管策略存储：Amazon Verified Permissions

[Amazon Verified Permissions](https://aws.amazon.com/verified-permissions/) 是使用 Cedar 的托管服务：它托管策略存储，提供管理策略的 API，并代应用执行授权决策。适合不想自己运维策略存储与决策服务的团队——把策略集中托管后，多个应用共享同一套授权模型。对应的自建路径见 [Rust SDK](../cedar/sdk.md)、[Cedar CLI](../cedar/cli.md) 和[在 Express 中集成 Cedar](./integration-express.md)。

## 社区与更多链接

遇到问题时可以加入 [cedar-policy Slack](https://communityinviter.com/apps/cedar-policy/cedar-policy-language) 与维护者和其他使用者交流。更多周边项目、文章、工具和集成汇总在 [cedar-awesome](https://github.com/cedar-policy/cedar-awesome)。

本书使用的来源、固定 commit 与许可证信息，见仓库中的 `sources.json` 与 `NOTICE.md`；各页顶部的来源框也标出了原文路径与英文快照位置。