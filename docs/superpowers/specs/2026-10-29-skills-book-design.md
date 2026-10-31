# Skills Book 设计文档

- 日期：2026-10-29
- 状态：待确认
- 选定方案：B，主题主书 + 全量附录
- 第一份交付物：工程骨架 + 试点译文 + 一篇对照章

## 1. 背景

这个目录是一个长期维护的 skills 学习工程。未来会放入多个开源 skill 项目。目标是把这些项目翻译成中文，整理成一本有主线、有对照、有来源、有变更历史的书，而不是把一堆 `SKILL.md` 逐篇机翻后堆在一起。

第一版收录两个项目：

| 项目 | 来源 | 当前版本 | 非测试 `SKILL.md` | 许可证 |
|---|---|---|---|---|
| gstack | `https://github.com/garrytan/gstack` | `v1.91.226.0` / `8d9501373b55897447ae30f1d281c4dbc8a1369e` | 63 | MIT |
| mattpocock_skills | `https://github.com/mattpocock/skills` | `v1.3.1-47-g5beb35b` / `5beb35b040e3de97e54fa9e386d7e42d15c295c2` | 38 | MIT |

合计 101 个非测试 `SKILL.md`。gstack 的 63 个中包含 4 个 OpenClaw 变体和 1 个 capy 变体；mattpocock 的 38 个中包含 20 个 engineering、7 个 productivity、7 个 in-progress、4 个 misc。测试 fixture 不翻译。

mattpocock 的 `package.json` 版本是 `1.3.1`，但当前 commit 在 `v1.3.1` 标签之后 47 个提交，因此来源引用使用 `git describe` 的 `v1.3.1-47-g5beb35b`，不把 `v1.3.1` 当成完整版本。每页仍同时记录完整 commit。

两个项目的定位不同：

- gstack 是一支完整的虚拟工程团队，覆盖 `Think → Plan → Build → Review → Test → Ship → Reflect`，强调角色、流程、审查门和交付自动化。
- mattpocock_skills 是一套可组合的工程方法，强在追问、规格、工单、TDD、代码审查和写作，强调小步、纪律和可复用技能。
- 两者在“追问”“规格”“审查”“复盘”等主题上大量重叠，正好适合做对照阅读，而不是分成两本互不相干的手册。

## 2. 目标

1. 把两个项目的全部 101 个非测试 `SKILL.md` 翻译成中文，保留原文结构、命令、代码和关键术语。
2. 翻译 mattpocock 技能目录内、被 `SKILL.md` 明确要求阅读的 22 篇同目录文档，作为技能页的附属文档。
3. 在完整译文之上写一本有主线的中文技能书，按研发阶段组织，并做跨项目对照。
4. 每个技能页都能追溯到项目、仓库、commit、源文件路径、许可证和原文链接。
5. 同时产出 Markdown 和静态 HTML 两种格式，HTML 可离线打开。
6. 用根目录 git 管理，每次更新单独 commit，提交说明和 `CHANGELOG.md` 使用中文并写清变更原因。
7. 形成可扩展的结构，以后新增开源 skill 项目时不需要重做目录和构建系统。

## 3. 非目标

- 不修改两个上游仓库，不在上游提交变更，不把上游 `.git` 嵌入本项目的 git。
- 不翻译脚本、模板、测试、二进制、图片、完整 docs 站点、CHANGELOG 和 README。
- 不做逐字机翻。译文要能读懂，但不能替作者补充原文没有的观点。
- 不做动态 CMS、数据库、登录、评论或在线编辑器。
- 不在第一版实现全文搜索和复杂主题系统；这些放到后续版本。
- 不自动跟随上游更新。同步是显式动作，必须记录新 commit 和变更原因。
- 不对译文主张官方或授权版本；这是学习性衍生作品。

## 4. 读者与成功标准

目标读者：中文技术读者，包括开发者、技术负责人、创业者和正在学习 agent 工作流的人。默认是先服务个人学习，再考虑公开出版。

成功标准：

- 101 个 `SKILL.md` 和 22 篇必读附属文档全部有对应中文页，没有遗漏。
- 每页都有来源框，且 `sources.json` 与页面 frontmatter 一致。
- 主书至少覆盖 8 个研发阶段，每个阶段有跨项目对照，不只是技能清单。
- Markdown 与 HTML 内容一致，站内链接全部可达。
- 每个 commit 通过 `npm run check`；发布时 `npm run check:release` 通过，覆盖翻译完整性、结构一致性、链接、来源哈希和 HTML 新鲜度。
- 任意一页都能回答三个问题：它来自哪里，当前对应哪个版本，为什么这次更新改了这一页。
- 新读者能从 `site/index.html` 开始，按目录读完第一份学习资料，不需要先安装任何东西。

## 5. 方案选择

### A. 按来源分卷

第一卷 gstack，第二卷 mattpocock，各自按研发阶段分组，逐篇全译。

优点：来源清楚，翻译与上游一一对应，维护简单。

代价：两套内容会重复，读起来像两份手册拼在一起，跨项目对照被埋没。

### B. 主题主书 + 全量附录

主线按研发阶段组织，每章对照两个项目；101 篇完整译文放在技能全库中，作为单一事实源；章节链接到译文。

优点：像一本真正的书，能看出两套方法论的异同；以后加新项目也能放进同一结构；完整翻译仍然保留。

代价：编辑工作更多，需要稳定的技能 ID、目录清单和交叉链接。

### C. 双语对照手册

每篇英文原文和中文译文并排，按项目分组。

优点：最适合学习和核对原文。

代价：篇幅翻倍，HTML 排版复杂，叙事性最弱。

### 选择

选 B。理由是用户要的是“完整的 skills book”，不是翻译文件合集。B 把完整翻译保留为事实源，再在上面加一层对照和总结，既能全量覆盖，也不会让读者在 101 篇长文里迷路。

## 6. 书的结构

主书由导读、八个研发阶段部和全库附录组成。章节不是逐篇摘要，而是围绕问题做对照；每个技能只在全库里出现一次，章节通过链接引用。

| 部 | 主题 | 主要内容 |
|---|---|---|
| 导读 | 怎么读这本书 | 书的由来、两个项目、skill 的基本概念、翻译原则、来源说明 |
| 第一部 | 两种范式 | gstack 的流程驱动与 mattpocock 的方法驱动；如何选择 |
| 第二部 | 想清楚 | 产品追问、grilling、领域语言、术语表、原型 |
| 第三部 | 规划 | CEO、工程、设计、DX 四种计划评审；规格、工单、decision ticket、范围控制 |
| 第四部 | 构建 | implement、implement-spec、TDD、deep module、seam、设计系统、前端生成 |
| 第五部 | 审查 | 代码审查、测试审查、共享代码、设计审查、DX 审查、安全、第二意见 |
| 第六部 | 测试 | 反馈回路、investigate、QA、性能、健康、eval、iOS 真机 |
| 第七部 | 交付 | ship、部署、canary、文档、PDF、图表、浏览器自动化、外部 agent |
| 第八部 | 反思与运营 | retro、架构改进、记忆、上下文交接、配置、路由、triage |
| 附录 | 全库与索引 | gstack 全库、mattpocock 全库、阶段索引、调用方式索引、术语表、来源与许可证、变更记录 |

建议章节（实施时可以微调。每个技能必须在 `book.json` 的 `catalog` 里出现且只出现一次；章节可以引用任意子集，不要求每个技能都拥有主书章节）：

1. 导读：这本书怎么用
2. 两个项目，两种答案
3. gstack：把研发流程变成一支虚拟团队
4. mattpocock：把工程纪律拆成可组合技能
5. 产品追问：office-hours 与 grilling
6. 领域语言：glossary、ADR 与 wait-what
7. 什么时候该做原型
8. 计划评审：CEO、工程、设计、DX 四种视角
9. 规格与工单：to-spec、spec、to-tickets、wayfinder
10. 范围控制：扩张、保持、收缩
11. 实现循环：implement、implement-spec 与 tdd
12. 模块设计：deep module、seam 与 codebase-design
13. 设计与前端：design-consultation、design-shotgun、design-html
14. 代码审查：review 与 code-review
15. 测试审查与共享代码：test-audit、deslop-shared-libs
16. 设计与 DX 审查：design-review、devex-review
17. 安全与第二意见：cso、codex、claude-code
18. 反馈回路：investigate 与 diagnosing-bugs
19. QA：浏览器、API、CLI、job、webhook
20. 性能与健康：benchmark、health、eval-plan
21. iOS：真机 QA 与修复
22. 发布：ship、land-and-deploy、canary
23. 文档：document-release、document-generate、make-pdf、diagram
24. 浏览器与外部世界：browse、scrape、skillify、pair-agent
25. 复盘：retro 与 improve-codebase-architecture
26. 记忆与交接：learn、context-save/restore、handoff、gbrain
27. 配置与路由：setup-matt-pocock-skills、triage、ask-matt
28. gstack 全库
29. mattpocock 全库
30. 按阶段与调用方式索引
31. 术语表、来源、许可证与变更记录

第一部先回答“为什么有两套做法”。后面的每一部用“问题 → 两种做法 → 怎么选”的结构，不按项目轮流介绍。

## 7. 内容模型

### 7.1 技能 ID

统一使用 `<project>/<slug>`：

- `gstack/office-hours`
- `gstack/openclaw/office-hours`（宿主变体）
- `mattpocock/tdd`
- `mattpocock/ask-matt`

附属文档使用 `<技能 ID>/<文档名>`，例如 `mattpocock/tdd/tests`、`mattpocock/tdd/mocking`。附属文档不是独立技能，不进入 `book.json` 的技能清单，但拥有自己的来源记录和页面。

同一项目内重名时加变体段。ID 一经使用不再改；改标题不改 ID。

### 7.2 `sources.json`

所有来源元数据的唯一事实源。技能和附属文档分开记录，避免把 22 篇附属文档误算成技能：

```json
{
  "schemaVersion": 1,
  "skills": [
    {
      "id": "gstack/office-hours",
      "project": "gstack",
      "repo": "https://github.com/garrytan/gstack",
      "commit": "8d9501373b55897447ae30f1d281c4dbc8a1369e",
      "ref": "v1.91.226.0",
      "sourcePath": "office-hours/SKILL.md",
      "snapshotPath": "source-snapshots/gstack/office-hours/SKILL.md",
      "sourceSha256": "<sha256>",
      "sourceUrl": "https://github.com/garrytan/gstack/blob/<commit>/office-hours/SKILL.md",
      "license": "MIT",
      "translationPath": "catalog/gstack/office-hours.md",
      "translationStatus": "complete",
      "translatedAt": "2026-10-29",
      "notes": "上游 SKILL.md 由模板生成。"
    }
  ],
  "documents": [
    {
      "id": "mattpocock/tdd/tests",
      "parentSkill": "mattpocock/tdd",
      "project": "mattpocock",
      "repo": "https://github.com/mattpocock/skills",
      "commit": "5beb35b040e3de97e54fa9e386d7e42d15c295c2",
      "ref": "v1.3.1-47-g5beb35b",
      "sourcePath": "skills/engineering/tdd/tests.md",
      "snapshotPath": "source-snapshots/mattpocock/tdd/tests.md",
      "sourceSha256": "<sha256>",
      "sourceUrl": "https://github.com/mattpocock/skills/blob/<commit>/skills/engineering/tdd/tests.md",
      "license": "MIT",
      "translationPath": "catalog/mattpocock/tdd/tests.md",
      "translationStatus": "complete",
      "translatedAt": "2026-10-29",
      "notes": "tdd/SKILL.md 明确要求阅读的配套文档。"
    }
  ]
}
```

`sourceSha256` 用于检测上游和快照是否变化。`translationStatus` 取值：`todo`、`draft`、`complete`、`needs-resync`。`snapshotPath` 指向仓库内的英文原文快照，保证只克隆本书仓库也能校验和追溯，不依赖同级的上游 checkout。

### 7.3 `book.json`

书的目录和技能归属的唯一事实源：

```json
{
  "title": "Skills Book",
  "subtitle": "从两个开源项目学习 agent 工作流",
  "parts": [
    {
      "id": "part-2-think",
      "title": "第二部 想清楚",
      "chapters": [
        {
          "id": "product-questioning",
          "title": "产品追问：office-hours 与 grilling",
          "path": "book/02-think/05-product-questioning.md",
          "skills": ["gstack/office-hours", "mattpocock/grilling"]
        }
      ]
    }
  ],
  "catalog": {
    "gstack": ["gstack/office-hours", "..."],
    "mattpocock": ["mattpocock/grilling", "..."]
  }
}
```

构建时校验：101 个技能全部出现在 `catalog`，且每个技能只出现一次；每章的 `skills` 都必须存在于 `sources.json`。章节引用可以多对多，一个技能可以出现在多个章节，也可以只出现在全库。附属文档不进入 `catalog`，由父技能页链接。

### 7.4 译文页 frontmatter

每个技能页只保留渲染需要的字段，来源细节与 `sources.json` 对齐：

```yaml
---
id: gstack/office-hours
title: office-hours
description: 用六个追问把产品想法重新框定，产出可执行的设计文档。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: office-hours/SKILL.md
snapshotPath: source-snapshots/gstack/office-hours/SKILL.md
license: MIT
translatedAt: 2026-10-29
---
```

原文的 YAML frontmatter（`name`、`description`、`allowed-tools`、`triggers` 等）保存在 `source-snapshots` 的英文快照里，不在译文页里重复渲染。译文页从原文提取三样东西：翻译后的 `description`、`invocation`（`user` / `model` / `unknown`）和来源信息。这样读者能看到技能是做什么的、谁可以调用，又不会把机器配置混进书稿。

技能页正文开头再放一个“技能速览”块，显示名称、调用方式、一句话说明和所属项目。它和来源框都由构建脚本从 frontmatter 生成，不写入 Markdown 正文，因此不参与源文与译文的结构对照。附属文档的“附属文档”导航也由构建脚本从 `sources.json` 的 `parentSkill` 生成，不写进译文正文。

### 7.5 来源框

每个技能页顶部固定生成：

> **来源**：gstack · `office-hours/SKILL.md` · `v1.91.226.0` · commit `8d95013`
> **许可证**：MIT · [查看原仓库](https://github.com/garrytan/gstack/blob/<commit>/office-hours/SKILL.md)
> **英文快照**：`source-snapshots/gstack/office-hours/SKILL.md`
> **翻译**：2026-10-29 · 译者注以 `> 译者注：` 标出

来源框由构建脚本从 frontmatter 生成，不手写，避免漂移。构建时会把 `source-snapshots/` 复制到 `site/source-snapshots/`，并生成相对链接。这样只打开 `site/` 或只部署 `site/` 时，英文快照也能离线打开；“查看原仓库”只是方便核对，不作为 `check` 的网络依赖。

### 7.6 变更记录

- `light_skills/CHANGELOG.md` 是给人读的变更记录，按日期分组，每条写清“改了什么 + 为什么”。
- git 历史是精确记录；`CHANGELOG.md` 是摘要，不替代 commit。
- 上游同步时，条目必须写清旧 commit、新 commit、变了哪些技能、为什么重译。
- 单篇译文不单独维护历史数组，避免与 git 和 changelog 三处重复。

## 8. 目录与文件布局

```text
/
  AGENTS.md
  docs/superpowers/specs/2026-10-29-skills-book-design.md
  light_skills/
    README.md                 # 项目说明、构建方式、阅读入口
    CHANGELOG.md              # 中文变更记录
    GLOSSARY.md               # 中英术语表
    TRANSLATION.md            # 翻译规范与检查清单
    NOTICE.md                 # 上游归属、许可证、修改说明
    book.json                 # 目录与技能归属
    sources.json              # 101 个技能 + 22 篇附属文档的来源元数据
    package.json
    package-lock.json
    scripts/
      build.mjs               # Markdown -> HTML
      check.mjs               # 校验；默认 draft-aware，--release 严格
      scan-companions.mjs     # 扫描 mattpocock 同目录必读文档
      sync-sources.mjs        # 检查/更新上游来源与快照
      serve.mjs               # 本地静态服务器
    book/
      00-intro/
      01-two-paradigms/
      02-think/
      03-plan/
      04-build/
      05-review/
      06-test/
      07-ship/
      08-reflect/
    catalog/
      gstack/
      mattpocock/
    source-snapshots/           # 固定 commit 的英文原文，只读，用于离线校验和追溯
      gstack/
      mattpocock/
    third-party/
      gstack-LICENSE
      mattpocock-skills-LICENSE
    site/                     # 生成的 HTML，提交到 git
      index.html
      assets/book.css
      book/...
      catalog/...
      source-snapshots/...
```

根目录 `.gitignore`：

```gitignore
/opensrc/
/light_skills/node_modules/
.DS_Store
```

两个上游仓库保持只读，不进入根仓库。`light_skills/source-snapshots/` 保存翻译时对应的英文原文，随书仓库提交。它让只克隆本书仓库的人也能运行结构校验、核对译文，并在上游仓库消失时仍有可追溯的底本。`sources.json` 中的 commit、`sourceSha256` 和 `snapshotPath` 共同构成可复现记录。

## 9. 翻译规范

### 9.1 翻译对象

- 全部 101 个非测试 `SKILL.md`。
- mattpocock 技能目录内、被 `SKILL.md` 明确要求阅读的 22 篇同目录 Markdown。清单如下，M1 由 `scripts/scan-companions.mjs` 扫描并冻结到 `sources.json` 的 `documents` 数组：

| 技能 | 附属文档 |
|---|---|
| ask-matt | `PHASE-BOUNDARIES.md` |
| codebase-design | `DEEPENING.md`、`DESIGN-IT-TWICE.md` |
| domain-modeling | `ADR-FORMAT.md`、`GLOSSARY-FORMAT.md` |
| improve-codebase-architecture | `HTML-REPORT.md` |
| prototype | `LOGIC.md`、`UI.md` |
| setup-matt-pocock-skills | `domain.md`、`issue-tracker-github.md`、`issue-tracker-gitlab.md`、`issue-tracker-local.md`、`triage-labels.md` |
| tdd | `tests.md`、`mocking.md` |
| triage | `AGENT-BRIEF.md`、`OUT-OF-SCOPE.md` |
| teach | `GLOSSARY-FORMAT.md`、`LEARNING-RECORD-FORMAT.md`、`MISSION-FORMAT.md`、`RESOURCES-FORMAT.md` |
| writing-for-agents | `SKILL-MECHANICS.md` |

- 附属文档使用 `<技能 ID>/<文档名>`，拥有独立来源记录和页面，但不进入 `book.json` 的技能清单。
- gstack 只翻译提交后的 `SKILL.md`。它的 `sections/*.md`、`.tmpl` 和脚本已经折叠进生成的 `SKILL.md`，不重复翻译。
- gstack 的译文从第一个 H1 开始，H1 之前的通用运行时前言（Preamble、AskUserQuestion 格式、遥测等）保留在英文快照中，不翻译。这些内容每个 gstack 技能都重复，翻译它们只会淹没技能本身。没有 H1 的技能从正文开头翻译。
- 不翻译：脚本、测试、模板、图片、完整 `docs/` 站点、bucket README、`pr/CREDITS.md`、CHANGELOG、生成配置。
- 英文原文快照不是译文，放在 `source-snapshots/`，只用于核对和离线校验。

### 9.2 文体

- 用中文技术写作，清楚、克制，不写成营销文案。
- 保留原文的结构和标题层级。需要补充背景时用 `> 译者注：`，不要悄悄改写作者观点。
- 译者注只能是引用块，且不得包含标题或代码围栏。结构校验会忽略以 `> 译者注：` 开头的块，其他新增标题或代码块一律视为结构不一致。
- 命令、代码、路径、URL、frontmatter 键名、技能名、工具名保留原文。
- 术语第一次出现时给英文原词，之后按 `GLOSSARY.md` 的统一译法。
- 原文有歧义就保留歧义，并在译者注里说明，不要替作者做决定。
- 长文按原文章节翻译；不做“摘要代替翻译”。

### 9.3 术语表

先建立 30 到 50 个高频词的统一译法，至少覆盖：

`skill`、`agent`、`harness`、`context window`、`subagent`、`spec`、`ticket`、`issue`、`triage`、`seam`、`tracer bullet`、`deep module`、`grilling`、`workflow`、`gate`、`review`、`ship`、`retro`、`prototype`、`decision ticket`。

`GLOSSARY.md` 是唯一事实源。新增术语时在同一个 commit 里更新，不允许各页自行创造译名。

### 9.4 质量检查

- 结构对照：源文与译文都从第一个 H1 开始比较；没有 H1 时比较全文。标题数量、代码块数量必须一致；`> 译者注：` 块不参与计数。缺一段就失败。
- 来源对照：每页必须有来源框，commit、路径、许可证与 `sources.json` 一致；英文快照必须存在且哈希匹配。
- 术语抽查：每批至少抽查 10%，重点看同一概念是否出现多种译名。
- 事实抽查：命令、路径、版本号、链接必须逐字保留。
- 试读者检查：试点阶段由用户确认语气和版式；批量阶段默认沿用试点风格。

## 10. 构建与校验

### 10.1 技术选型

- Node.js 20+，环境当前为 Node 24。
- 依赖尽量少：`marked` 负责 Markdown，`yaml` 负责 frontmatter，`github-slugger` 负责稳定锚点。
- 构建脚本只用 Node 标准库加这三个依赖，不引入静态站点框架。
- HTML 全部使用相对链接，`site/index.html` 可以直接双击打开，也可以由 `npm run serve` 提供本地服务。

### 10.2 命令

```bash
cd light_skills
npm ci
npm run build          # 重新生成 site/
npm run check          # 日常校验，允许未翻译的 todo 记录；每个 commit 都应通过
npm run check:release  # 发布校验，要求 101 篇技能 + 22 篇附属文档全部完成
npm run check:sources  # 用快照校验来源；--upstream 时再对比同级上游仓库
npm run stats          # 统计各项目、各状态的篇数
npm run serve          # 本地预览
```

### 10.3 构建行为

- 读取 `book.json` 和 `sources.json`。
- 读取 `book/` 与 `catalog/` 下的 Markdown。
- 生成侧边栏、章节正文、上一篇/下一篇、来源框、页内目录。
- 将 `.md` 链接改写为 `.html`，生成稳定的中文标题锚点。
- 输出镜像目录到 `site/`，并生成 `site/index.html`。
- 把 `source-snapshots/` 复制到 `site/source-snapshots/`，保证 HTML 站点自包含。
- `todo` 技能在全库里显示为不可点击的“待翻译”，不生成空页面；章节只能链接已完成的技能页。
- `build` 不访问网络，不修改 Markdown。

### 10.4 `check` 的内容

`npm run check`（日常模式）：

1. `sources.json` 字段完整，技能 ID 和文档 ID 唯一，`sourcePath` 非空，`snapshotPath` 存在。
2. 每个 `todo` 记录允许没有译文页；`draft` 和 `complete` 记录必须有译文页。
3. `book.json` 的 `catalog` 与 `sources.json` 的 101 个技能一一对应，不重不漏。
4. 已存在译文页的 frontmatter 与 `sources.json` 一致。
5. 已存在译文页包含来源框，来源框链接格式正确，英文快照存在且哈希匹配。
6. 已存在译文页与快照从第一个 H1 开始比较，标题数、代码块数一致，`> 译者注：` 块不计数。
7. 所有已生成 HTML 的站内链接指向存在的文件或锚点；`todo` 技能在全库里显示为不可点击的“待翻译”。
8. 生成的 HTML 与提交的 `site/` 一致；不一致则提示重新构建。
9. 不发起网络请求。来源链接只校验格式，不校验 HTTP 可达性。

`npm run check:release`（发布模式）：

1. 包含日常模式的全部检查。
2. 101 个技能和 22 篇附属文档全部为 `complete`，不能有 `todo`、`draft` 或 `needs-resync`。
3. 不允许 `TODO`、`[待翻译]`、空正文或其他占位内容。
4. 每篇译文都有完整来源框和可打开的英文快照。
5. 全书目录、索引、上一篇/下一篇、交叉链接全部可用。

`npm run check:sources`：

- 默认用 `sourceSha256` 对比仓库内快照，不访问网络。
- 加 `--upstream` 时再对比 `opensrc/` 下的 `gstack/`、`mattpocock_skills/`；上游变化时报告 `needs-resync`，不自动改稿。

## 11. Git 与变更记录

### 11.1 仓库

- 在 `/home/agent/workspace/study/skills` 初始化独立 git 仓库，分支 `main`。
- `opensrc/gstack/` 与 `opensrc/mattpocock_skills/` 保持独立仓库，不加入根仓库索引。
- 首次提交包含重写后的根 `AGENTS.md`、设计文档、`light_skills/` 骨架、来源清单、英文快照、术语表、构建脚本和许可证。
- 根 `AGENTS.md` 从“上游仓库维护指南”改为“Skills Book 贡献指南”：说明两个上游是只读来源、产物在 `light_skills/`、构建与提交规则、来源同步规则。上游仓库的介绍保留为“来源 checkout”一节，不再把 `light_skills/` 描述成空目录。

### 11.2 提交粒度

- 一个技能一篇译文，或一个完整章节，单独提交。
- 同一逻辑变更的 Markdown、来源元数据、英文快照、生成的 HTML、`CHANGELOG.md` 放在同一个 commit，保证仓库任意时点都可构建。
- 每个 commit 都必须通过 `npm run check`。未完成的技能保持 `todo`，不会让仓库变红；发布标签必须通过 `npm run check:release`。
- 不把无关改动混进同一个 commit。
- 批量同步上游时，可以按项目或按主题分多个 commit，每个 commit 说明同步范围和原因。

### 11.3 提交说明

格式：

```text
<type>(<scope>): <中文摘要>

来源：<项目> <commit/ref>
原因：<为什么改>
验证：<跑了什么检查>
```

示例：

```text
feat(catalog/gstack): 翻译 office-hours

来源：gstack 8d95013 / v1.91.226.0
原因：产品追问主题的试点篇，用于确定长文译名和版式。
验证：npm run check
```

### 11.4 `CHANGELOG.md`

按日期组织，中文，面向人阅读：

```markdown
## 2026-10-29

### 新增
- 初始化 Skills Book 工程，确定“主题主书 + 全量附录”结构。
- 新增 gstack/office-hours 译文。来源 gstack 8d95013。原因：试点篇，用于校准产品追问类文本的译法。
```

每个阶段结束时更新。同步上游时写清旧版本、新版本、受影响技能和重译原因。

## 12. 里程碑

### M0 设计确认

完成本设计文档，经用户确认后进入实施。

### M1 工程骨架

- 根目录 `git init`。
- 建立 `light_skills/` 目录、`package.json`、构建与校验脚本。
- 生成 101 条技能记录和 22 条附属文档记录，建立 `book.json` 的完整目录和技能归属。
- 复制 123 份英文原文快照到 `source-snapshots/`。
- 重写根 `AGENTS.md` 为本书的贡献指南。
- 写 `GLOSSARY.md`、`TRANSLATION.md`、`NOTICE.md`、`README.md`。
- 复制两个上游的 MIT 许可证。
- 提交：`chore: 初始化 Skills Book 工程`，验证 `npm run check`。

### M2 试点与第一份学习资料

- 翻译 `gstack/office-hours`、`mattpocock/grilling`、`mattpocock/tdd`，以及 `tdd` 的 `tests.md`、`mocking.md` 附属文档。
- 写“产品追问：office-hours 与 grilling”对照章。
- 生成 HTML，完成一版可读的试点。
- 用户确认译名、语气、版式和来源框。
- 打标签 `v0.1.0`，验证 `npm run check`。
- 这是第一份可交付的学习资料，但不是全书完成。

### M3 全量翻译

- 按部和主题分批翻译剩余 98 个 `SKILL.md` 和 20 篇 mattpocock 附属文档。
- 每篇单独提交，逐批跑 `npm run check`。
- 每批完成后更新 `CHANGELOG.md`。
- 全量完成后跑 `npm run check:release`，打标签 `v0.5.0`。

### M4 主书章节

- 写完导读、八个研发阶段部和全库附录，共约 31 章，补对照表、选择指南和交叉链接。
- 每章链接到全库译文，不重复整篇内容。
- 审核全书术语、事实和链接。
- 打标签 `v0.9.0`。

### M5 发布版

- 完成打印样式、移动端检查、可选搜索索引。
- 补齐许可证、来源说明和完整变更记录。
- 跑 `npm run check:release`，抽查译文。
- 打标签 `v1.0.0`。

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 101 篇译文风格不一致 | 读起来像多人拼稿 | 先试点，建立术语表和样式指南；批量时共享同一份规范 |
| 上游更新导致译文过期 | 来源失准 | `sources.json` 固定 commit 和哈希；`check:sources` 显式报告变化 |
| gstack 生成文件漂移 | 翻译了错误版本 | 只翻译提交后的 `SKILL.md`，记录版本和 commit；不碰模板和 sections |
| Markdown 与 HTML 不一致 | 读者看到旧内容 | HTML 提交到 git；`check` 重建并比对 |
| 长文翻译漏段 | 信息缺失 | 标题数、代码块数、来源框自动校验；人工抽查 |
| 版权与归属不清 | 不能公开 | 保留 MIT 声明；每页有来源；公开前再定书稿许可证 |
| 范围膨胀到所有 docs | 项目失控 | 只翻 `SKILL.md` 和 mattpocock 同目录必读文档；gstack docs 只做章节引用 |
| 目录结构以后加项目要重做 | 维护成本高 | ID、`sources.json`、`book.json` 从第一天就按多项目设计 |

## 14. 假设与待定

已假设：

- 读者以中文技术读者为主，先服务个人学习，再考虑公开出版。
- “全部翻译”指全部 101 个非测试 `SKILL.md`，加上 22 篇 mattpocock 同目录必读文档；不包含脚本、模板、测试和完整 docs 站点。
- gstack 的 4 个 OpenClaw 变体和 1 个 capy 变体进入全库，但不一定各自拥有主书章节。
- 书稿自身的内容许可证暂不在第一版决定；上游 MIT 声明必须保留。
- 英文原文快照随书提交，使仓库自包含；快照不是译文，也不改变上游许可证。
- 根 `AGENTS.md` 会重写为本书的贡献指南，因为旧内容把 `light_skills/` 描述为空目录，与新的仓库用途冲突。

待定但不阻塞实施：

- 是否在 M5 加全文搜索。
- 是否把 mattpocock 的 bucket README 作为附录资料翻译。
- 是否把 gstack 的 `docs/skills.md` 深潜内容作为第二版扩展。

## 15. 验收清单

- [ ] 根目录 git 已初始化，两个上游仓库被忽略，英文快照已提交。
- [ ] `sources.json` 覆盖 101 个技能和 22 篇附属文档，字段完整。
- [ ] `book.json` 的 `catalog` 覆盖全部 101 个技能，每个技能只出现一次；章节引用可以多对多。
- [ ] 每篇译文有来源框，frontmatter 与 `sources.json` 一致。
- [ ] 源文快照与译文的标题数、代码块数一致，译者注不计入。
- [ ] 日常 `npm run check` 在每个 commit 通过；发布时 `npm run check:release` 通过。
- [ ] `site/index.html` 可直接打开，目录、上一篇/下一篇、站内链接可用。
- [ ] `CHANGELOG.md` 用中文记录每个阶段的变更和原因。
- [ ] 上游 MIT 许可证与归属说明已保留。
- [ ] 试点经用户确认后才进入全量翻译。

## 16. 设计决定记录

这些决定来自设计评审，目的是让实施者不需要再次猜测。

| 问题 | 决定 | 理由 |
|---|---|---|
| 每个 commit 是否都要通过全量检查 | 日常 `npm run check` 允许 `todo`；发布用 `npm run check:release` | 逐篇提交时全书尚未完成，不能要求 101 篇同时存在；但每个 commit 仍要可构建、无坏链 |
| 技能是否必须有主书章节 | 不要求。`catalog` 唯一即可，章节引用多对多 | 约 40 个工具型技能不需要单独成章；全库负责完整覆盖，主书负责主线 |
| 附属文档是否算技能 | 不算。它们是 `documents`，有独立 ID、来源记录和页面 | 避免把 101 变成 123，避免目录和统计混淆 |
| 书仓库是否自包含 | 自包含。英文原文快照进入 `source-snapshots/` | 只克隆本书也能离线校验、核对和追溯，不依赖同级上游 checkout |
| 译者注是否会破坏结构校验 | 只允许 `> 译者注：` 引用块，且不含标题或代码围栏；校验时忽略 | 保留补充背景的空间，同时让结构对照可自动执行 |
| 原文 frontmatter 怎么处理 | 原文保存在快照；译文页只保留翻译后的 description、invocation 和来源字段 | 读者需要“做什么、谁能调用”，不需要把机器配置混进书稿 |
| mattpocock 的版本怎么标 | 用 `v1.3.1-47-g5beb35b`，同时记录完整 commit | 当前 commit 在 `v1.3.1` 之后 47 个提交，标成 `v1.3.1` 会指错版本 |
| 根 `AGENTS.md` 是否重写 | 重写为本书贡献指南，上游说明保留为“来源 checkout”一节 | 旧文件把 `light_skills/` 说成空目录，会误导后续 agent |