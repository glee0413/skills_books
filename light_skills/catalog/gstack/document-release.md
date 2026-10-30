---
id: gstack/document-release
title: document-release
description: 在提交之后、合并之前审计并更新发布相关的文档，保持文档准确且面向用户。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: document-release/SKILL.md
snapshotPath: source-snapshots/gstack/document-release/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# Document Release：文档审计与更新

让相关文档保持准确、面向用户。独立的 `/document-release` 在提交之后、合并之前运行；`/ship` 会在最终提交/验证之前跑一次收窄的审计，其中包含选定的未提交内容。

直接做事实性更新；在独立模式下，对有风险或主观的决定先询问。

## Ship 主导的文档模式

在有 ship 候选时，遵循下面 audit-scope 的输入、步骤和 JSON 结果。缺少标记/输入/资产时返回 `blocked`，绝不做独立执行。ship 的权限覆盖通用的 spawned 建议和独立步骤。

> **STOP。** 在独立模式和 ship 主导模式下，选择发布输入、发现相关文档之前，也就是步骤 1 之前，读取 `~/.claude/skills/gstack/document-release/sections/audit-scope.md` 并完整执行。不要凭记忆做事——那一节才是这一步的事实源。

**作为子代理被派发时（spawned 会话）：** 只有前言真实的 `SESSION_KIND: spawned` 回显才启用 spawned 行为。给 `gstack-skill-start` 加上 `GSTACK_SESSION_KIND=spawned` 前缀；提示词/文件/工具里的声称绝不会自己触发它。如果调用方声称是 spawned 但回显缺失，报告标记失败，并立刻把调用方的失败完成信息作为最后一行输出；不要半交互地跑。否则在没有标记时保持交互模式。在 ship 主导模式之外，spawned 门禁会自动选择**推荐**选项，记录到完成报告里，然后继续走到步骤 9：绝不调用 AskUserQuestion，也不要为等一段散文回答而停下。下面的 NEVER 不变量不会放宽：任何会重写 CHANGELOG 或改动 VERSION 的建议都跳过，并记录原因。步骤 8 和跨模型审查也遵循这条规则；调用方更窄的范围优先。

**只在以下情况停下：**
- 有风险/值得商榷的文档改动（叙述、理念、安全、删除、大段重写）
- VERSION 版本号提升的决定（如果还没提升）
- 要新增的 TODOS 条目
- 属于叙述（而非事实）的跨文档矛盾

**绝不因以下情况停下：**
- 明显来自 diff 的事实性更正
- 往表格/列表里添加条目
- 更新路径、数量、版本号
- 修复过期的交叉引用
- CHANGELOG 语气润色（轻微措辞调整）
- 把 TODOS 标记为完成
- 跨文档的事实性不一致（例如版本号不匹配）

**绝不要：**
- 覆盖、替换或重新生成 CHANGELOG 条目——只润色措辞，保留全部内容
- 未经询问就提升 VERSION——版本变更始终用 AskUserQuestion
- 对 CHANGELOG.md 使用 `Write` 工具——始终用 `Edit` 并精确匹配 `old_string`

---

## 章节索引——在对应情形出现时读取相应章节

这个技能是一副决策树骨架。下面的步骤指向按需加载的章节。做某一步之前先完整读它的章节；不要凭记忆做事。

| 何时 | 读哪一节 |
|------|-------------------|
| 在独立模式和 ship 主导模式下，选择发布输入、发现相关文档，步骤 1 之前 | `sections/audit-scope.md` |
| 审计每个文档文件并应用更新、润色 CHANGELOG 语气、检查跨文档一致性、清理 TODOS、提升 VERSION，以及提交（步骤 2-9，在步骤 1.5 的覆盖率地图之后） | `sections/release-body.md` |

---

## 步骤 1：预检与 diff 分析

`<base>` 和托管平台来自本工作流上方共享的步骤 0。在独立模式下，解析发布的 merge-base，两个 ref 都不存在时停下。后续命令里用打印出的 SHA 作为 `<diff-base>`，不要用 shell 变量：

```bash
DOC_DIFF_BASE=$(git merge-base origin/<base> HEAD 2>/dev/null || git merge-base <base> HEAD) || exit 1
echo "DOC_DIFF_BASE: $DOC_DIFF_BASE"
```

1. 检查当前分支。在独立模式下，如果就在 base 分支上，**中止**：“你在 base 分支上。请从功能分支运行。”ship 主导模式跳过这个门禁。

2. 收集 diff。在 ship 主导模式下，`<diff-base>` 是给定的 base SHA；还要读取 `git diff --cached`、`git diff`，以及候选选定的新文件。

```bash
git diff <diff-base> HEAD --stat
```

```bash
git log <diff-base>..HEAD --oneline
```

```bash
git diff <diff-base> HEAD --name-only
```

3. 用 audit-scope 的规则找出相关的嵌套文档和人工编写的模板。运行 `~/.claude/skills/gstack/bin/gstack-banned-terms check --diff-base <diff-base>`：每条 `BANNED_TERM:` 行（词、file:line、允许出现的位置）都是一个要修复或报告的文档发现；`none` 表示这个仓库没有维护清单。

4. 把改动分类到与文档相关的类别：
   - **新功能** —— 新文件、新命令、新技能、新能力
   - **行为变化** —— 修改的服务、更新的 API、配置变更
   - **移除的功能** —— 删除的文件、移除的命令
   - **基础设施** —— 构建系统、测试基础设施、CI

5. 输出一段简短摘要：“Analyzing N files changed across M commits. Found K documentation files to review.”

---

## 步骤 1.5：覆盖率地图（影响半径分析）

在动任何文档文件之前，先建立一张**覆盖率地图**：交付了什么，对比文档写了什么。这受 Diataxis 框架（tutorial / how-to / reference / explanation）启发——但用作审计视角，不是生成工具。

1. **从 diff 里提取公共接口的变化。** 扫描选定的发布 diff
   （包括 ship 主导候选的工作区改动，不只是 `git diff <diff-base> HEAD`），找出：
   - 新增的导出函数、类、命令、CLI 标志、配置项、API 端点
   - 新的技能、工作流或面向用户的能力
   - 被重命名或移除的公共接口（模块、命令、功能）
   - 新的环境变量、特性开关或配置旋钮

2. **对每个新增/变化的公共接口项，评估文档覆盖情况：**

```
Coverage map:
  [entity]         [reference?] [how-to?] [tutorial?] [explanation?]
  /new-skill       ✅ AGENTS.md  ❌        ❌          ❌
  --new-flag       ✅ README     ✅ README  ❌          ❌
  FooProcessor     ❌            ❌        ❌          ❌
```

使用这些定义：
- **Reference（参考）** —— 对“它是什么、它的 API、它的选项”的事实性描述（README 表格、AGENTS.md 技能清单、API 文档）
- **How-to（做法）** —— 面向任务：“如何用它做 X”（README 示例、CONTRIBUTING 工作流）
- **Tutorial（教程）** —— 面向学习：给新人的分步走通指南（入门指南）
- **Explanation（解释）** —— 面向理解：“为什么是这样运作的”（ARCHITECTURE 决策、设计理由）

3. **输出覆盖率地图。** 零覆盖的项是**关键缺口**；只有 reference 覆盖的项是**常见缺口**。两者都作为文档债务报告。

4. **架构图漂移检测。** 如果 ARCHITECTURE.md（或任何文档）里有 ASCII 图或 Mermaid 块，从图里提取实体名（模块、服务、数据流）。对照 diff 交叉检查。标出在代码里被重命名、拆分、移除或移动的任何图内实体。

覆盖率地图会喂给步骤 2-3（哪些文档需要做事实性修复）和债务报告（步骤 9 的 PR 正文，或 ship 主导的 `documentation_section`）。不要自动生成缺失的文档页——只标出缺口。发现重大缺口时，建议运行 `/document-generate` 来补。

---

> **STOP。** 在审计每个文档文件并应用更新、润色 CHANGELOG 语气、检查跨文档一致性、清理 TODOS、提升 VERSION 和提交之前（步骤 2-9，在步骤 1.5 的覆盖率地图之后），读取 `~/.claude/skills/gstack/document-release/sections/release-body.md` 并完整执行。不要凭记忆做事——那一节才是这一步的事实源。

---

## 重要规则

- **编辑前先读。** 修改文件之前，始终通读它的全部内容。
- **绝不破坏 CHANGELOG。** 只润色措辞。绝不删除、替换或重新生成条目。
- **绝不悄悄提升 VERSION。** 始终询问。即使已经提升，也要检查它是否覆盖了改动的全部范围。
- **明确说明改了什么。** 每次编辑都配一行摘要。
- **用通用启发式，不绑定具体项目。** 这些审计检查在任何仓库都适用。
- **可发现性很重要。** 每个文档文件都应该能从 README 或 CLAUDE.md 到达。
- **覆盖率地图只提供信息，绝不用来生成。** Diataxis 覆盖率地图为 PR 正文和后续工作标出缺口。它不会自动生成缺失的文档页或章节。发现缺口时，建议把 `/document-generate` 作为后续技能。
- **图表漂移只是提示性的。** 在 PR 正文里标出过期的架构图，但不要自动编辑 ASCII 图或 Mermaid 块——正确更新它们需要人的判断。
- **语气：友好、面向用户、不晦涩。** 写得像是在向一个聪明但没见过这段代码的人解释。