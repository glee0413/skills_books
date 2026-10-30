---
id: gstack/document-generate
title: document-generate
description: 先通读代码再动笔，按 Diataxis 四个象限为功能、模块或整个项目写出结构完整的高质量文档。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: document-generate/SKILL.md
snapshotPath: source-snapshots/gstack/document-generate/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# Document Generate：Diataxis 文档写作

你在执行 `/document-generate` 工作流。你的任务是：为某个功能、模块或整个项目产出**高质量、有结构**的文档。在写下第一行文档之前，先把代码研究透。

这个技能有两种调用方式：
1. **独立调用** —— 用户把你指向某个功能、模块或项目，说"给它写文档"
2. **由 /document-release 调用** —— 覆盖图识别出了缺口，你去补上

你遵循 **Diataxis 框架** —— 文档的四个象限，各自服务不同的读者需求：
- **教程（Tutorial）** —— 面向学习，带新手一步步走完一个可运行的例子
- **操作指南（How-to）** —— 面向任务，说明如何完成某个具体目标（假定读者有基本熟悉度）
- **参考（Reference）** —— 面向信息，完整准确的技术描述
- **解释（Explanation）** —— 面向理解，说明事情为什么是这样运作的

**理念：先研究整体，再写各个部分。** 就像建筑师在画第一个房间之前先勘察整个场地，你在写任何文档之前先读完整个代码表面。这能避免"只描述了半个功能"这种典型失败。

---

## 步骤 0：范围与意图

1. 确定要写什么：
   - **带具体目标调用时**（功能、模块、文件、技能）：范围就是这个目标
   - **为整个项目调用时**：范围就是整个项目
   - **由 /document-release 带缺口调用时**：范围是覆盖图里列出的具体实体

2. 用 AskUserQuestion 确认范围，并询问文档落点：

   - A) 直接在现有文件里写文档（README、ARCHITECTURE 等）
   - B) 创建独立的文档文件（例如 `docs/` 目录）
   - C) 两者都做 —— 现有文件里放摘要 + 独立文件里放深度文档

   RECOMMENDATION: 选 C，因为它同时最大化可发现性和深度。

3. 确定输出格式：
   - 如果项目已有 `docs/` 目录，遵循它的约定
   - 如果项目用了文档框架（Nextra、Docusaurus、MkDocs、VitePress），遵循它的格式
   - 否则用 `docs/` 下的纯 Markdown 文件

---

## 步骤 1：代码考古（研究阶段）

文档的质量取决于你对代码的理解程度，所以这一步权重最大。

1. **摸清项目结构：**

```bash
find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.gstack/*" -not -path "./dist/*" -not -path "./build/*" -not -path "./.next/*" | head -200
```

2. **读入口文件。** 识别并阅读：
   - README.md、ARCHITECTURE.md、CONTRIBUTING.md、CLAUDE.md / AGENTS.md
   - package.json / Cargo.toml / pyproject.toml / go.mod（判断项目类型）
   - 主入口文件（index.ts、main.rs、app.py、cmd/main.go）
   - 配置文件与示例

3. **读每个目标实体的源码。** 对每个要写文档的功能/模块：
   - 从头到尾读实现文件（不只是签名）
   - 读测试 —— 它们揭示了预期行为、边界情况和用法模式
   - 读目标依赖的、以及依赖目标的相邻模块
   - 读已有行内注释，尤其是 `// NOTE:`、`// DESIGN:`、`// WHY:`

4. **建立概念图。** 动笔之前，先产出一份内部提纲：

```
Target: [feature/module name]
Purpose: [one sentence — what problem does it solve?]
Key concepts: [list the 3-5 concepts a reader must understand]
Public surface: [commands, functions, config options, API endpoints]
Dependencies: [what it needs from other modules]
Dependents: [what relies on it]
Edge cases: [from reading tests and code]
Design decisions: [any non-obvious "why" choices]
```

5. 输出："Researched N files, identified K public surface items, M concepts, and J design decisions."

---

## 步骤 2：Diataxis 划分

对每个目标实体，决定要产出哪几个 Diataxis 象限。不是每个实体都需要四个都写。

**决策矩阵：**

| 实体类型 | 教程？ | 操作指南？ | 参考？ | 解释？ |
|---|---|---|---|---|
| 用户会交互的新功能 | ✅ | ✅ | ✅ | 也许 |
| CLI 命令或参数 | 也许 | ✅ | ✅ | 否 |
| 内部模块/架构 | 否 | 否 | ✅ | ✅ |
| 配置项 | 否 | ✅ | ✅ | 否 |
| 设计模式 / 理念 | 否 | 否 | 否 | ✅ |
| API 端点 | 也许 | ✅ | ✅ | 否 |
| 工作流（多步流程） | ✅ | ✅ | 否 | 也许 |

输出划分计划：

```
Documentation plan:
  [entity]              [tutorial] [how-to] [reference] [explanation]
  Widget system         ✅ new     ✅ new   ✅ new      ✅ new
  --verbose flag        ❌        ✅ new   ✅ inline   ❌
  Bayesian scheduler    ❌        ❌       ✅ new      ✅ new
```

如果计划要创建 5 篇以上文档，先用 AskUserQuestion 确认再继续。范围较小时直接进行。

---

## 步骤 3：先写参考文档

参考文档是基础。它们基于事实、完整，且直接从代码推导。要在教程或操作指南之前写，因为它们确立了词汇。

**参考文档模板：**

```markdown
# [Entity Name]

[One paragraph: what it is, what it does, when you'd use it.]

## API / Interface

[Complete listing of public surface: functions, commands, config options, parameters.
Include types, defaults, and constraints. Pull directly from code — do not paraphrase
loosely.]

## Options / Configuration

[If applicable: every option with its type, default, and effect.]

## Examples

[2-3 concrete examples showing actual usage. Prefer real command output or code that
would actually compile/run.]

## Related

[Links to other reference docs, how-tos, or explanations that provide context.]
```

**参考文档的规则：**
- 准确优先于优雅。每个说法都必须能追溯到代码。
- 写出类型、默认值和约束。"接受一个字符串"不够 —— "接受一个字符串（最多 256 字符，必须匹配 `^[a-z-]+$`）"才是参考级别。
- 给出复制粘贴就能真正跑通的真实示例。
- 不要解释*为什么* —— 那属于解释文档。

---

## 步骤 4：写解释文档

解释文档回答"为什么是这样运作的？"它们承载设计理由。

**解释文档模板：**

```markdown
# [Concept / Design Decision]

[Opening paragraph: the problem this design solves, stated in terms a smart reader
who hasn't seen the code would understand.]

## The problem

[Concrete description of what goes wrong without this design. Real failure modes,
not abstract risks.]

## The approach

[How the design solves the problem. Include diagrams (ASCII or Mermaid) for
architectural concepts.]

## Trade-offs

[What was given up. Every design decision trades something — name it explicitly.]

## Alternatives considered

[If discoverable from code comments, ADRs, or git history: what was tried or
rejected and why.]
```

**解释文档的规则：**
- 从问题开始，不是从方案开始。
- 架构用 ASCII 图。它们可 grep、diff 友好，而且到处都能渲染。
- 明确写出取舍。"我们选 X 而不是 Y，因为 Z"是黄金标准。
- 不要重复参考材料 —— 给链接。

---

## 步骤 5：写操作指南

操作指南面向任务。它们假定读者懂基础，只想完成某件具体的事。

**操作指南模板：**

```markdown
# How to [accomplish specific task]

[One sentence: what you'll accomplish and the end result.]

## Prerequisites

[What the reader needs before starting. Be specific — versions, installed tools,
config state.]

## Steps

1. [Action verb] [specific instruction]

   ```bash
   [exact command]
   ```

   [Expected output or result, if non-obvious.]

2. [Next step...]

## Verification

[How to confirm it worked. A command, a URL to visit, a test to run.]

## Troubleshooting

[Common failure modes and their fixes. Pull from tests and error handling code.]
```

**操作指南的规则：**
- 标题以 "How to" 开头 —— 没有例外。这是读者的入口。
- 每一步都必须可执行。不要写"考虑是否……"，要写"运行 X"或"把 Y 加到 Z"。
- 要有验证步骤。读者不应该问"它成功了吗？"
- 如果任务可能失败，故障排查小节是必需的。

---

## 步骤 6：写教程

教程面向学习。它们带新手从零走到一个可运行的例子。这类最难写好，也最有价值。

**教程模板：**

```markdown
# [Tutorial title — describes what you'll build/learn]

[Opening paragraph: what you'll build, why it's useful, and what you'll understand
by the end. Keep it concrete — "You'll build a working X that does Y" not
"This tutorial covers X".]

## What you'll need

[Prerequisites: tools, versions, prior knowledge. Link to installation guides.]

## Step 1: [Set up the foundation]

[Start from a clean state. Show every command. Explain what each does on first
encounter — but briefly, not a lecture.]

```bash
[exact command]
```

[Brief explanation of what just happened.]

## Step 2: [Build the first working piece]

[Get to a working, visible result as fast as possible. The reader should see
something happen within the first 3 steps.]

...

## Step N: [Final step]

## What you built

[Recap: what the reader now has and what it can do. Link to reference docs
for deeper exploration. Suggest next steps.]
```

**教程的规则：**
- **首次结果在 3 步之内。** 如果读者到第 3 步还没看到东西跑起来，教程太慢了。
- 每一步都必须产生可见的变化或输出。不要只写"现在配置 X"却不展示会变什么。
- 用读者会真正输入的确切命令。不要"运行适当的命令"这种抽象说法。
- 错误路径：如果某一步经常失败，就地把错误和修复方式写出来。
- 以 "What you built" 结尾 —— 把教程接回真实用例。

---

## 步骤 7：跨文档链接与可发现性

写完全部文档后：

1. **在象限之间加交叉链接。** 每篇参考文档都应链接到它的操作指南，每篇操作指南都应链接回参考。教程应同时链接两者。

2. **更新入口文件。** 在以下位置加上新文档的引用：
   - README.md —— 加到文档小节或目录
   - CLAUDE.md / AGENTS.md —— 相关时加到项目结构
   - 任何已有的文档索引或侧边栏配置

3. **验证可发现性。** 每篇新文档都必须能从 README.md 出发两次点击内到达。如果用了文档框架，把它加进侧边栏/导航配置。

4. **检查坏链。** grep 所有指向不存在文件的 `](` 引用。

---

## 步骤 8：质量自审

提交之前，对照这些标准审每一篇文档：

**准确性门禁：**
- [ ] 每个代码示例复制粘贴后都能编译 / 运行 / 通过
- [ ] 每处 API 描述都匹配真实的代码签名
- [ ] 展示的每条命令都产生所描述的输出
- [ ] 没有对已改名/已移除实体的过时引用

**完整性门禁：**
- [ ] 参考文档覆盖 100% 的公共表面
- [ ] 操作指南覆盖用户最可能尝试的前 3 个任务
- [ ] 教程在 ≤3 步内到达可运行结果
- [ ] 解释文档写出取舍，而不只是选择

**文风门禁：**
- [ ] 写给一个没看过代码的聪明人
- [ ] 没有未加简短行内解释的术语，首次出现要给说明
- [ ] 主动语态、具体名词、短句
- [ ] 写"你现在可以……"，不写"系统提供了……"

继续之前先修掉所有不合格项。

---

## 步骤 9：提交与输出

1. 按文件名逐个暂存新文档（绝不用 `git add -A` 或 `git add .`）。

**提交前的脱敏扫描。** 生成的文档里经常出现示例凭据；扫描暂存区的文档内容，遇到 HIGH 级凭据就阻断（提交进仓库的活格式密钥就是泄露）。按 span 的占位符过滤会放行明显的文档示例（例如 `AKIAIOSFODNN7EXAMPLE`）；活格式密钥无论出现在哪里都阻断，是否在代码围栏里都一样：

```bash
REDACT_VIS=$(~/.claude/skills/gstack/bin/gstack-config get redact_repo_visibility 2>/dev/null)
[ -z "$REDACT_VIS" ] && REDACT_VIS=$(gh repo view --json visibility -q .visibility 2>/dev/null | tr 'A-Z' 'a-z')
git diff --cached --no-color | grep '^+' | sed 's/^+//' | \
  ~/.claude/skills/gstack/bin/gstack-redact --repo-visibility "${REDACT_VIS:-unknown}" --json
# exit 3 (HIGH) → unstage the offending doc, remove the secret, re-stage. Do NOT commit.
```

2. 创建提交：

```bash
git commit -m "$(cat <<'EOF'
docs: generate [scope] documentation (Diataxis)

[One-line summary of what was documented]

Quadrants: [list which quadrants were produced]

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

3. 推送到当前分支：

```bash
git push
```

4. **如果存在 PR**，在 PR 描述里加一个 `## Documentation Generated` 小节，列出每个新文件及其 Diataxis 象限和一行说明：

```
## Documentation Generated

| File | Quadrant | Description |
|------|----------|-------------|
| docs/tutorial-getting-started.md | Tutorial | Walk-through from install to first working example |
| docs/reference-widget-api.md | Reference | Complete widget API with types, defaults, examples |
| docs/explanation-bayesian-scheduler.md | Explanation | Why the scheduler uses Bayesian inference |
| docs/howto-custom-widgets.md | How-to | Creating and registering custom widgets |
```

5. 输出结构化摘要：

```
Documentation generated:
  Scope: [what was documented]
  Files: [N] new, [M] updated
  Coverage:
    Tutorials:    [count] ([list])
    How-tos:      [count] ([list])
    Reference:    [count] ([list])
    Explanation:  [count] ([list])
  Quality: [pass/fail on each gate]
```

---

## 重要规则

- **先研究再写。** 步骤 1 不是可选的。读代码、读测试、读已有文档。研究不足只会写出浮于表面的文档。
- **准确性没有商量余地。** 每个代码示例都必须能跑。每处 API 描述都必须匹配真实代码。细节没把握就再读一遍源码 —— 不要猜。
- **Diataxis 象限服务不同读者。** 不要把教程内容混进参考文档，也不要把参考内容混进操作指南。每个象限对应特定状态下的特定读者。
- **教程的首次结果时间。** 如果读者到第 3 步还没看到东西跑起来，重构教程。
- **万物交叉链接。** 孤立的文档等于没人能找到的文档。
- **文风：友好、具体、面向用户。** 写就像在给一个没看过代码的聪明人解释。绝不写成企业腔，绝不写成学术腔。
- **完整优先于极简。** AI 让写全文档变得便宜。不要写"最小可用文档" —— 写完整文档。把海煮干。