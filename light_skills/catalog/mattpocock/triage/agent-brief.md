---
id: mattpocock/triage/agent-brief
title: agent-brief
description: 说明如何编写耐久的 agent 简报：以行为而非步骤描述改动，并给出可独立验证的验收标准。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/triage/AGENT-BRIEF.md
snapshotPath: source-snapshots/mattpocock/triage/agent-brief.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/triage
---

# 编写 agent 简报

agent 简报是一条结构化评论，在 GitHub 上的 issue 或 PR 移到 `ready-for-agent` 时发布。它是离线 agent 据以工作的权威规格。原始正文和讨论是上下文，agent 简报才是契约。

简报说明**agent 应该做什么**，这一点在两种入口上都成立：对 issue，是从零构建这个改动；对 PR，是针对*已有的 diff* 还剩下什么：把它做完、补齐缺口、处理评审意见。两侧的原则相同，下面的 PR 例子展示了差异所在。

## Principles

### Durability over precision

这个 issue 可能在 `ready-for-agent` 里待上几天甚至几周，其间代码库会变化。写简报时要让它在文件被改名、移动或重构之后依然有用。

- **要**描述接口、类型和行为契约
- **要**点名 agent 应当寻找或修改的具体类型、函数签名或配置形状
- **不要**引用文件路径：它们会过时
- **不要**引用行号
- **不要**假定当前的实现结构会保持不变

### Behavioral, not procedural

描述系统应该做**什么**，而不是**怎么**实现它。agent 会重新浏览代码库，自己做实现决策。

- **好：**“`SkillConfig` 类型应当接受一个可选的 `schedule` 字段，类型为 `CronExpression`”
- **坏：**“打开 src/types/skill.ts，在第 42 行加一个 schedule 字段”
- **好：**“当用户不带参数运行 `/triage` 时，应当看到需要关注的 issue 摘要”
- **坏：**“在主处理函数里加一个 switch 语句”

### Complete acceptance criteria

agent 需要知道什么时候算做完。每份 agent 简报都必须有具体、可测的验收标准。每条标准都应当可以独立验证。

- **好：**“运行 `gh issue list --label needs-triage` 会返回已经过初步分类的 issue”
- **坏：**“分诊应当正确工作”

### Explicit scope boundaries

明确说明什么不在范围内。这能防止 agent 镀金，或对相邻功能做假设。

## Template

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** 一句话说明需要发生什么

**Current behavior:**
描述现在发生什么。对 bug，这是坏掉的行为。
对 enhancement，这是该功能所基于的现状。

**Desired behavior:**
描述 agent 的工作完成之后应当发生什么。
对边界情况和错误条件要写具体。

**Key interfaces:**
- `TypeName`：需要改什么，以及为什么
- `functionName()` 的返回类型：它现在返回什么，vs 它应当返回什么
- 配置形状：需要新增的任何配置项

**Acceptance criteria:**
- [ ] 具体、可测的标准 1
- [ ] 具体、可测的标准 2
- [ ] 具体、可测的标准 3

**Out of scope:**
- 在本 issue 中不应被修改或处理的东西
- 看起来相关但实际独立的相邻功能
```

## Examples

### Good agent brief (bug)

```markdown
## Agent Brief

**Category:** bug
**Summary:** 技能描述截断会从词中间切断，产出破损的输出

**Current behavior:**
当一份技能描述超过 1024 个字符时，它会被恰好截在
1024 个字符处，不考虑词边界。这会产生在词中间结束的描述
（例如 "Use when the user wants to confi"）。

**Desired behavior:**
截断应当在 1024 个字符之前最后一个词边界处断开，
并追加 "..." 表示已截断。

**Key interfaces:**
- `SkillMetadata` 类型的 `description` 字段：不需要改类型，
  但填充它的校验/处理逻辑需要尊重词边界
- 任何读取 SKILL.md frontmatter 并提取 description 的函数

**Acceptance criteria:**
- [ ] 1024 字符以下的描述保持不变
- [ ] 超过 1024 字符的描述在 1024 字符之前最后一个词边界处截断
- [ ] 截断后的描述以 "..." 结尾
- [ ] 包含 "..." 的总长度不超过 1024 字符

**Out of scope:**
- 改变 1024 字符上限本身
- 支持多行描述
```

### Good agent brief (enhancement)

```markdown
## Agent Brief

**Category:** enhancement
**Summary:** 增加 `.out-of-scope/` 目录支持，用来记录被拒绝的功能请求

**Current behavior:**
当一个功能请求被拒绝时，issue 会带上 `wontfix` 标签并附一条评论后被关闭。
决策和理由没有持久记录。以后遇到类似请求时，维护者只能靠回忆
或搜索先前的讨论。

**Desired behavior:**
被拒绝的功能请求应当记录在 `.out-of-scope/<concept>.md` 文件里，
其中写明决策、理由，以及所有要求过该功能的 issue 的链接。
分诊新 issue 时，应当检查这些文件是否有匹配项。

**Key interfaces:**
- `.out-of-scope/` 中的 Markdown 文件格式：每个文件应当有一个
  `# Concept Name` 标题、一行 `**Decision:**`、一行 `**Reason:**`，
  以及一个带 issue 链接的 `**Prior requests:**` 列表
- 分诊工作流应当尽早读取全部 `.out-of-scope/*.md` 文件，
  并按概念相似度把进入的 issue 与它们匹配

**Acceptance criteria:**
- [ ] 把一个功能以 wontfix 关闭时，会在 `.out-of-scope/` 中创建或更新一个文件
- [ ] 该文件包含决策、理由，以及指向被关闭 issue 的链接
- [ ] 如果已有匹配的 `.out-of-scope/` 文件，新 issue 会被追加到它的
      "Prior requests" 列表，而不是新建重复文件
- [ ] 分诊期间会检查已有的 `.out-of-scope/` 文件，并在新 issue
      与先前拒绝项匹配时提出来

**Out of scope:**
- 自动匹配（由人来确认匹配）
- 重新打开先前被拒绝的功能
- bug 报告（只有被拒绝的 enhancement 才写入 `.out-of-scope/`）
```

### Good agent brief (PR)

对 PR，“Current behavior”描述的是 diff 的状态，简报要求 agent 把它做完或修好，而不是从零构建。

```markdown
## Agent Brief

**Category:** enhancement
**Summary:** 完成贡献者为 `triage list` 添加的 `--json` 输出开关

**Current behavior:**
这个 PR 添加了 `--json` 开关，把 issue 列表序列化成 JSON。正常路径
已经可用，diff 也符合项目的命令结构。还剩两个缺口：错误仍然以
人类可读文本打印（而不是 JSON），并且新开关没有测试覆盖。

**Desired behavior:**
带 `--json` 时，所有输出（包括错误）都是格式正确的 JSON，写到 stdout，
并且命令的退出码保持不变。不带该开关时，现有的人类可读输出保持不变。

**Key interfaces:**
- 命令的错误路径在 `--json` 下应当输出 `{ "error": string }`，
  而不是纯文本错误
- 复用 PR 已经加好的序列化器；不要引入第二个

**Acceptance criteria:**
- [ ] `triage list --json` 在成功和出错两种情况下都输出合法 JSON
- [ ] 退出码与非 JSON 命令一致
- [ ] 有测试覆盖 `--json` 的成功输出和一个出错场景
- [ ] 默认（非 JSON）输出逐字节不变

**Out of scope:**
- 给其它任何命令添加 `--json`
- 改变 PR 已定义的成功响应载荷的 JSON 形状
```

### Bad agent brief

```markdown
## Agent Brief

**Summary:** 修一下分诊的 bug

**What to do:**
分诊那个东西坏了。看看主文件然后修掉。
大概第 150 行附近的那个函数有问题。

**Files to change:**
- src/triage/handler.ts（第 150 行）
- src/types.ts（第 42 行）
```

这份简报糟糕，因为：
- 没有分类
- 描述含糊（“分诊那个东西坏了”）
- 引用了会过时的文件路径和行号
- 没有验收标准
- 没有范围边界
- 没有描述当前行为与期望行为的差别