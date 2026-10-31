---
id: cedar-examples/use-cases
title: 六个真实用例
description: 从文档云到流媒体，逐个拆解六个示例的策略形态与它们演示的授权建模思路。
project: cedar-examples
sourceCommit: f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37
sourceRef: f4d2dbb
sourcePath: cedar-example-use-cases/README.md
snapshotPath: source-snapshots/cedar-examples/cedar-example-use-cases/README.md
sourceUrl: https://github.com/cedar-policy/cedar-examples/blob/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/cedar-example-use-cases/README.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 六个真实用例

这个目录不含应用代码，只有六套策略、schema、实体和成组的允许/拒绝请求。它的用法是“读策略 → 猜结果 → 用 CLI 验证”，目的是训练把业务规则翻译成 Cedar 的能力。六个例子覆盖了从层级继承、标签匹配到时间条件的多种建模手法。

## 六个例子各演示什么

- **文档云盘**（`document_cloud`）：模拟 Google Drive、Dropbox 一类共享系统。核心是文件所有者与共享关系：文档归某个人所有，再通过共享对象把访问权扩散出去，公开与私有文档的差别也体现在这层关系上。
- **GitHub**（`github_example`）：复刻 GitHub 的仓库访问权限。重点是组织内的团队关系与仓库权限如何沿层级继承；`in` 在这里承担了大部分工作。
- **酒店连锁**（`hotel_chains`）：按酒店集团的层级建模。权限不是逐店配置，而是跟随组织结构向下传递，适合观察“层级即权限边界”的写法。
- **标签与角色**（`tags_n_roles`）：实现基于标签的访问控制。主体侧标签挂在角色上而不是用户上，判定时要求主体标签与资源标签匹配，是 ABAC 与 RBAC 混合的典型。
- **税务申报**（`tax_preparer`）：敏感文档的访问取决于主体的组织成员身份，同时要求文档所有者事先给出整体授权。它演示的是“两个条件同时成立”的合取式授权，以及同意（consent）如何建模。
- **流媒体服务**（`streaming_service`）：点播内容平台，使用 `datetime` 扩展实现基于时间的规则，例如会员提前观看。它说明 Cedar 可以把时间作为上下文或属性参与判定。

六者共同的模式是：先确定主体与资源的层级，再决定哪些关系用 `in` 表达、哪些用属性比较、哪些放进 `context`。看懂这一点，比记住每个例子的具体策略更有用。

## 用 CLI 验证

README 的快速开始假定已按说明构建 CLI，并把 `cedar` 放进 `PATH`；可执行文件位于 `/path/to/cedar-policy/cedar/target/debug/`。验证文档云策略：

```shell
# validate the document_cloud policies
cedar validate \
      --policies document_cloud/policies.cedar \
      --schema document_cloud/document_cloud.cedarschema.json
```

发起一次授权请求：

```shell
# perform an authorization request with the document_cloud policies
cedar authorize \
      --policies document_cloud/policies.cedar \
      --entities document_cloud/entities.json \
      --request-json document_cloud/allow_requests/alice_view_alice_public.json
```

`run.sh` 会把策略验证和全部授权测试跑一遍。自己动手时，建议先只跑 `validate`，确认 schema 与策略一致，再逐条跑请求；否则一个 schema 错误会淹没后面所有判定结果。

## 子目录约定

每个用例内部结构一致：

| 文件 | 说明 |
|---|---|
| `policies.cedar` | Cedar 策略 |
| `linked` | 策略模板链接 |
| `entities.json` | 示例实体存储 |
| `policies.cedarschema` | Cedar schema |
| `ALLOW` | 应被允许的请求 |
| `DENY` | 应被拒绝的请求 |
| `README.md` | 走读该应用的教程 |

部分例子同时提供 `static` 与 `templated` 两个版本，放在不同子目录。静态版是写死具体值的策略；模板版把可变部分抽成占位符，再用 `linked` 里的链接填充。对照两者能直观看到模板省掉了多少重复。

`ALLOW`/`DENY` 请求目录是这套示例最有价值的部分：它们是策略的可执行规格（快速开始里的命令则使用 `allow_requests` 这类目录名）。修改策略后重跑全部请求，若某个 `ALLOW` 变成拒绝，或某个 `DENY` 被放行，就说明改动破坏了预期语义。这比人工审查可靠得多。

## 怎么练

建议按“先猜后验”的方式使用：打开一个例子的 `policies.cedar` 和 `entities.json`，挑一条 `ALLOW` 请求，先自己推导哪条策略会命中、`reason` 里会出现哪些策略 ID，再运行命令对照。遇到 `DENY` 时，逐条排除 permit，确认是哪个条件不满足——TinyTodo 教程里对 `kesha` 的分析就是这种推演。

进阶练习是把静态版改写成模板版，或反过来把模板展开成静态策略，然后用 `cedar validate` 和两组请求确认行为不变。这个过程会强迫你区分“策略结构”和“策略参数”，也是实际项目里做多租户授权时最常见的重构。

> 译者注：`cedar-examples` 顶层 README 的表格仍写着这个目录包含“两个示例应用”，与本页的六个不一致；以本目录 README 和实际子目录为准。

## 与全书其他部分的关系

这六个用例可以当作策略语言的练习题：层级继承对应“实体与实体层级”，标签匹配对应“数据类型与操作符”，时间规则对应扩展函数，模板版本对应“策略模板”。读完语法再回来做一遍，收获会比初读更大。