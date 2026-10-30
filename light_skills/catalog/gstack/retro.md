---
id: gstack/retro
title: retro
description: 对当前用户和每位贡献者的提交历史、工作模式与代码质量做周期复盘，输出有证据支撑的赞扬、成长建议和可累积的历史快照。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: retro/SKILL.md
snapshotPath: source-snapshots/gstack/retro/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /retro — 每周工程复盘

分析当前用户和每位贡献者的提交历史、工作模式与代码质量，给出有证据支撑的赞扬和成长机会。

## 用户调用

当用户输入 `/retro` 时，运行本技能。

## 参数

- `/retro` — 默认：最近 7 天
- `/retro 24h` — 最近 24 小时
- `/retro 14d` — 最近 14 天
- `/retro 30d` — 最近 30 天
- `/retro compare` — 当前窗口对比上一个等长窗口
- `/retro compare 14d` — 用显式窗口对比
- `/retro global` — 跨所有 AI 编码工具的跨项目复盘（默认 7d）
- `/retro global 14d` — 用显式窗口做跨项目复盘

## 章节索引 — 遇到对应情形时再读相应章节

本技能是一副决策树骨架。下面的步骤指向按需加载的章节。做某一步之前要把该章节完整读完，不要凭记忆执行。

| 何时 | 读哪一节 |
|------|-------------------|
| 撰写复盘叙述（Step 14，在所有指标算完并对比之后） | `sections/report-format.md` |

## 执行说明

解析参数以确定时间窗。没有参数时默认 7 天。所有时间都按用户的**本地时区**报告（用系统默认值——不要设置 `TZ`）。

**对齐午夜的时间窗：** 对天（`d`）和周（`w`）单位，要算出本地午夜对应的绝对起始日期，而不是相对字符串。例如今天是 2026-03-18、窗口为 7 天：起始日期是 2026-03-11。使用 `--since "2026-03-11T00:00:00"`——显式的 `T00:00:00` 后缀确保 git 从午夜起算。没有它，git 会用当前挂钟时间（例如晚上 11 点执行 `--since "2026-03-11"` 指的是 11 点，而不是午夜）。周单位乘以 7 换算成天（例如 `2w` = 向前 14 天）。小时（`h`）单位用 `--since "N hours ago"`，因为不足一天的时间窗不适用午夜对齐。从会话提醒中用户可见的 `## currentDate` 标签计算“今天”——绝不从 `date` 取（在容器化的运行框架里，系统时钟可能差好几个小时）。如果无法可靠算出“今天”，停下来用 AskUserQuestion 问用户，不要硬着头皮继续。

**参数校验：** 如果参数不匹配“数字加 `d`、`h` 或 `w`”、单词 `compare`（可选跟一个窗口）、或单词 `global`（可选跟一个窗口），显示下面的用法并停止：
```
用法：/retro [window | compare | global]
  /retro              — 最近 7 天（默认）
  /retro 24h          — 最近 24 小时
  /retro 14d          — 最近 14 天
  /retro 30d          — 最近 30 天
  /retro compare      — 本周期对比上一周期
  /retro compare 14d  — 用显式窗口对比
  /retro global       — 跨所有 AI 工具的跨项目复盘（默认 7d）
  /retro global 14d   — 用显式窗口做跨项目复盘
```

**路由：** `global` 跳过所有仓库范围的步骤，包括 Prior Learnings、Step 0.5 和报告后的捕获；按 **全局复盘模式（Global Retrospective Mode）** 执行（不需要 git 仓库）。`compare` 按 **对比模式（Compare Mode）** 执行。两者都接受可选的窗口（默认 7d）。否则执行下面的仓库范围流程。

`<default>` 是前面 **Step 0: Detect platform and base branch** 得出的基线分支。`<today>` 是会话提醒中的日期；在所有快照文件名里复用它，绝不要再去读时钟。

> 译者注：`Step 0: Detect platform and base branch` 位于本技能文件正文之前的通用运行时前言里，按本书的翻译范围未收录；它的作用是根据远程 URL 和 CLI 可用性识别托管平台，并确定 `<default>` 基线分支名。

## 既往经验

检索以往会话中的相关经验：

```bash
_CROSS_PROJ=$(~/.claude/skills/gstack/bin/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  { _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --cross-project 2>&1 >&3 3>&-); _LR=$?; } 3>&1
else
  { _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 2>&1 >&3 3>&-); _LR=$?; } 3>&1
fi
[ "$_LR" = 0 ] || { _LE=${_LE%%$'\n'*}; echo "LEARNINGS: unavailable (${_LE:-exit $_LR})"; }
```

如果 `CROSS_PROJECT` 是 `unset`（首次运行）：使用 AskUserQuestion：

> gstack 可以检索这台机器上你其他项目的经验，找出可能适用于当前项目的模式。
> 数据完全留在本地（不会有任何数据离开你的机器）。
> 对独立开发者推荐开启。如果你同时在多个客户代码库上工作、担心交叉污染，可以跳过。

选项：
- A) 启用跨项目经验（推荐）
- B) 经验只限当前项目

选 A：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings true`
选 B：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings false`

然后用相应的标志重新执行检索。

如果检索到经验，把它们纳入分析。当某条审查发现与过去的经验吻合时，显示：

**“Prior learning applied: [key] (confidence N/10, from [date])”**

这让复利效应可见。用户应该看到 gstack 在他们的代码库上随着时间变得更聪明。

### Step 0.5：新鲜度预检（fetch）

刷新 `origin/<default>`，免得复盘对着过期的本地引用误报。如果仓库没有 `origin` 远程，这一步会无害地失败——指标脚本（Step 1）会退回本地分支，并由它的守卫行披露这一点：

```bash
git fetch origin <default> --quiet 2>/dev/null \
  || echo "RETRO_FETCH: failed (offline or no remote) — proceeding against last-known refs"
```

记住 fetch 是否成功——Step 1 的过期基线守卫只在成功时才 BLOCK。

### Step 1：采集指标（一条命令）

用检测出的基线分支和算好的起点运行 `gstack-retro-metrics`：

```bash
_RM="$HOME/.claude/skills/gstack/bin/gstack-retro-metrics"
[ -x "$_RM" ] || _RM=".claude/skills/gstack/bin/gstack-retro-metrics"
"$_RM" --base "<default>" --since "<since>" \
  || echo "RETRO_METRICS: unavailable — stale install (read the helper source for manual computation)"
```

读取 `METRIC_NAME: value` 行。**降级模式：** 没有 `RETRO_METRICS_PROTO: 1` 时，按已安装的 `bin/gstack-retro-metrics` 源码复现计算过程，而不是照下面的展示步骤。如果源码或指标不可用，就直说；绝不编造数值。建议用 `/gstack-upgrade` 恢复辅助脚本。

**身份：** `USER_NAME` 就是**“你”**——读这份复盘的人。其他作者都是队友。叙述围绕这一点组织：“你的”提交 vs 队友的贡献。

**过期基线 + 错误“今天”锚点守卫。** `GUARD_LATEST_COMMIT: <DATE>` 是所分析引用上最新的提交。错误的“今天”或过期的引用可能产出一个空窗口。按顺序判断：

1. 如果 `GUARD_REMOTE: none` 或 `GUARD_HEAD: detached`，或 Step 0.5 的 fetch 失败：继续，但把披露带进叙述（“离线运行，窗口未经新鲜度验证”），而不是悄悄误报。
2. 如果 Step 0.5 的 fetch 成功 **且** `GUARD_LATEST_COMMIT` 的日期**早于（今天 − 窗口天数）**：以这句话 BLOCK：“Retro window is stale. Latest commit on `origin/<default>` was `<DATE>`, but the window covers `<since>` to `<today>`. This usually means either (a) today's date is wrong in this session or (b) `origin/<default>` is materially behind the remote. Confirm today's date via the session reminder; if today is correct, run `git fetch origin <default>` manually and re-run /retro.” 在用户解决之前停止技能。
3. 否则写：“RETRO_GUARD: latest commit `<DATE>` within window — proceeding.”

同时检查 `RETRO_REF`：如果它不是 `origin/<default>`（纯本地仓库、远程分支缺失），披露复盘实际分析的是哪个引用。

**指标行参考**（脚本会输出的内容）：

| 行 | 含义 |
|------|---------|
| `COMMIT: hash\|author\|datetime\|+ins/-del\|subject` | 每个提交一行，最新的在前（上限 300）——叙述锚定的原材料 |
| `COMMITS` / `MERGE_COMMITS` / `CONTRIBUTORS` | 所分析引用上的窗口总计 |
| `INSERTIONS` / `DELETIONS` / `NET_LOC` | 原始行数 |
| `LOGICAL_SLOC_ADDED` | 非空、非注释的新增行——主要的代码量指标 |
| `TEST_INSERTIONS` / `TEST_RATIO` | 测试行数（test/spec 路径加 .test./.spec. 后缀）及其在新增中的占比 |
| `WEIGHTED_COMMITS` | 提交数 × 触及文件数，每个提交上限 20 |
| `ACTIVE_DAYS` | 有提交的不同本地日期数 |
| `SESSIONS` / `DEEP_SESSIONS` / `MEDIUM_SESSIONS` / `MICRO_SESSIONS` | 按 45 分钟间隔识别的会话：deep 50+ 分钟，medium 20-50，micro <20 |
| `TOTAL_ACTIVE_MINUTES` / `AVG_SESSION_MINUTES` / `LOC_PER_SESSION_HOUR` | 会话时间聚合（LOC/小时已预取整到 50） |
| `COMMIT_TYPES` / `FIX_RATIO` | 约定式提交前缀的构成 |
| `COMMIT_SIZE_BUCKETS` | 每个提交 small <100 / medium 100-500 / large 500-1500 / xl 1500+ 行 |
| `HOURS` / `PEAK_HOUR` | 按小时（本地时间）的提交直方图，只列非零小时 |
| `FOCUS_SCORE` | 落在单个最繁忙顶层目录里的文件改动占比 |
| `BIGGEST_COMMIT` | 窗口内行数最多的提交（本周之船的候选） |
| `HOTSPOT: count file` | 改动最多的 10 个文件 |
| `AUTHOR: name\|commits\|ins\|del\|test_ratio\|top_areas\|types\|peak_hour` | 每位贡献者的汇总，按提交数降序 |
| `AUTHOR_BIGGEST: name\|hash\|loc\|subject` | 每位贡献者最大的一次交付 |
| `COAUTHOR: hash\|name` / `AI_ASSISTED_COMMITS` | 人类共同作者署名行；带 AI trailer 的提交数 |
| `WEEK: wN\|commits\|ins\|del\|test_ratio` | 按周分桶，w0 = 最新（供 Step 10 趋势使用） |
| `PR_REFS` / `PRS_REFERENCED` | 从提交标题中提取的 PR/MR 编号（GitHub #NNN，GitLab !NNN） |
| `TEST_FILES_TOTAL` / `TEST_FILES_CHANGED` / `REGRESSION_TEST_COMMITS` / `REGRESSION_COMMIT` | 测试健康度：仓库级测试文件数、窗口内改动的测试文件、`test(qa):` / `test(design):` / `test: coverage` 提交 |
| `VERSION_RANGE` | 窗口内 VERSION 文件的第一个 → 最后一个值（受跟踪时） |
| `TEAM_STREAK` / `USER_STREAK` | 带锚定日期的连续提交天数（Step 11） |
| `RETRO_CONTEXT` / `GREPTILE_HISTORY` / `TODOS_FILE` / `SKILL_USAGE_LOG` / `EUREKA_LOG` | 可选输入是否存在——Read 那些标记为 present 的 |

**可选输入**（Read 脚本标记为 `present` 的每个文件）：

- `RETRO_CONTEXT: present` → Read 那一行打印的 `retro-context.md` 路径。它由用户撰写，可能包含会议记录、日历事件、决策以及其他不出现在 git 历史里的上下文。在相关处把它融入复盘叙述。
- `GREPTILE_HISTORY: present` → Read 那一行打印的 `greptile-history.md` 路径。按日期把条目过滤到复盘窗口。按类型计数：`fix`、`fp`、`already-fixed`。信号比 = `(fix + already-fixed) / (fix + already-fixed + fp)`。无法解析的行静默跳过；如果窗口内没有任何条目，跳过 Greptile 指标行。
- `TODOS_FILE: present` → Read `TODOS.md`。计算：未关闭 TODO 总数（排除 `## Completed` 一节）、P0/P1 数量、P2 数量、本周期完成的条目（Completed 中日期落在窗口内的条目）、本周期新增的条目（交叉引用触及 TODOS.md 的 `COMMIT:` 行）。
- `SKILL_USAGE_LOG: present` → Read 它打印的路径（`$GSTACK_STATE_ROOT/analytics/skill-usage.jsonl`）。按 `ts` 过滤到窗口。把技能激活（没有 `event` 字段）与钩子触发（`event: "hook_fire"`）分开。按技能名聚合。
- `EUREKA_LOG: present` → Read 它打印的路径（`$GSTACK_STATE_ROOT/analytics/eureka.jsonl`）。按 `ts` 过滤到窗口。每个 eureka 时刻记下标记它的技能、分支和一行洞见摘要。

### Step 2：计算指标

大多数行直接来自指标行。在搭表之前，先单独收集两项交付结果：

- **已合并的 PR：** 在 GitHub 上运行 `gh pr list --state merged --base "<default>" --search "merged:>=<start-date>" --limit 1000 --json number,title,mergedAt`。把 `mergedAt` 过滤到请求的确切窗口，在对比模式下包含其上界。如果结果触到数量上限，就用托管平台 API 分页，或标注该计数为“部分”。在 GitLab 上用等价的已合并 MR 列表。如果托管数据不可用，改为显示**被引用的 PR** = `PRS_REFERENCED`；这些不是已验证的合并。这种情况下保存 `prs_merged: null`。
- **已交付的功能：** 在同一窗口内 Read `RETRO_REF` 上的 CHANGELOG 变更（`git log <ref> --since "<since>" -p -- CHANGELOG.md`，对比上一窗口时再加 `--until`）。把新增的用户可见能力与已验证的合并 PR 标题合并。指向同一能力的条目去重，排除修复、杂务和回退的工作。在计数旁保留一份简短的功能名清单及其来源提交/PR。两个来源都没有时显示“不可用”，而不是 0。这是有证据支撑的分类，不是指标脚本的一行。

在提交数的标签里使用所分析的引用（不一定是 `main`）。测试健康度统计的是**改动的文件**，不是新增的测试或测试用例；分别使用 `TEST_FILES_TOTAL`、`TEST_FILES_CHANGED` 和 `REGRESSION_TEST_COMMITS`。

| 指标 | 值 |
|--------|-------|
| **已交付功能**（来自 CHANGELOG + 合并 PR 标题） | N |
| 提交到所分析的引用 | N |
| 加权提交（`WEIGHTED_COMMITS`） | N |
| 贡献者 | N |
| 已合并 PR | N |
| **新增逻辑 SLOC**（`LOGICAL_SLOC_ADDED`——主要代码量指标） | N |
| 原始行数：新增 | N |
| 原始行数：删除 | N |
| 原始行数：净增 | N |
| 测试行数（新增） | N |
| 测试行数占比 | N% |
| 版本区间 | vX.Y.Z.W → vX.Y.Z.W |
| 活跃天数 | N |
| 检测到的会话数 | N |
| 每会话小时的平均原始行数 | N |
| Greptile 信号 | N%（Y 次命中，Z 次误报） |
| 测试健康度 | N 个测试文件 · 本周期改动 M 个 · K 个回归测试提交 |

先讲用户可见的功能，再讲提交数和逻辑 SLOC 指标；原始行数只是背景，不是影响力。

接着在正下方显示**按作者的排行榜**，数据来自 `AUTHOR:` 行：

```
贡献者              提交数   +/-          主要区域
You (garry)              32   +2400/-300   browse/
alice                    12   +800/-150    app/services/
bob                       3   +120/-40     tests/
```

按提交数降序排序。当前用户（`USER_NAME`）始终排第一，标注为“You (name)”。

条件行（输入缺失或窗口内为空时跳过对应项）：

```
| 待办健康度 | N 个未关闭（X 个 P0/P1，Y 个 P2）· 本周期完成 Z 个 |
| 技能使用 | /ship(12) /qa(8) /review(5) · 3 次安全钩子触发 |
| Eureka 时刻 | 本周期 2 次 |
```

如果存在 eureka 时刻，列出来：
```
  EUREKA /office-hours（分支：garrytan/auth-rethink）："会话 token 不需要服务端存储——浏览器 crypto API 让客户端 JWT 验证变得可行"
  EUREKA /plan-eng-review（分支：garrytan/cache-layer）："这里不需要 Redis——Bun 内置的 LRU 缓存足以应付这个负载"
```

### Step 3：提交时间分布

把 `HOURS` 行按本地时间渲染成小时直方图：

```
小时  提交数  ████████████████
 00:    4      ████
 07:    5      █████
 ...
```

识别并指出：
- 高峰时段
- 沉寂时段
- 模式是双峰（早晚）还是连续
- 深夜编码聚集（晚上 10 点之后）

### Step 4：工作会话识别

会话是预先算好的，相邻提交之间以 **45 分钟间隔**为阈值（`SESSIONS`、`DEEP_SESSIONS` 50+ 分钟、`MEDIUM_SESSIONS` 20-50 分钟、`MICRO_SESSIONS` <20 分钟——通常是一次提交即走的瞬时会话）。报告：
- 会话数及 deep/medium/micro 的分布
- 总活跃编码时间（`TOTAL_ACTIVE_MINUTES`）和平均会话长度
- 每小时活跃时间的行数（`LOC_PER_SESSION_HOUR`）

### Step 5：提交类型构成

把 `COMMIT_TYPES`（feat/fix/refactor/test/chore/docs）渲染成百分比条：

```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
```

如果 `FIX_RATIO` 超过 50% 就标出来——这暗示“快速发布、快速修复”的模式，可能意味着审查有缺口。

### Step 6：热点分析

显示 `HOTSPOT` 行（改动最多的 10 个文件）。标出：
- 改动 5 次以上的文件（频繁变动热点）
- 热点清单里的测试文件 vs 生产文件
- VERSION/CHANGELOG 的出现频率（版本纪律的指标）

### Step 7：PR 规模分布

报告 `COMMIT_SIZE_BUCKETS`：
- **Small**（<100 行）
- **Medium**（100-500 行）
- **Large**（500-1500 行）
- **XL**（1500+ 行）

### Step 8：专注度评分 + 本周之船

**专注度评分：** `FOCUS_SCORE` 是落在单个改动最多的顶层目录（例如 `app/services/`）里的文件改动占比。分数越高 = 深度专注的工作越多。分数越低 = 上下文切换越碎。报告为：“Focus score: 62% (app/services/)”

**本周之船：** `BIGGEST_COMMIT` 是窗口内行数最多的一次改动。突出它：
- PR 编号（与 `PR_REFS` / 标题比对）和标题
- 改动的行数
- 为什么重要（从提交信息和触及的文件推断）

### Step 9：团队成员分析

对每位贡献者（包括当前用户），`AUTHOR:` 行带有提交数、新增、删除、测试占比、主要区域、提交类型构成和高峰小时；`AUTHOR_BIGGEST:` 带有其单次影响最大的提交。用 `COMMIT:` 行把一切锚定在真实工作上。

**对当前用户（“你”）：** 包含会话分析、时间模式和专注度评分：“你的高峰时段……”“你最大的一次交付……”

**对每位队友：** 写 2-3 句话，覆盖他们做了什么以及他们的模式。然后：

- **赞扬**（1-2 个具体点）：引用提交和好在哪，不要泛泛而谈。
- **成长机会**（1 个具体点）：把可执行的建议与数据挂钩，而不是批评。Step 14 提供示例。

**如果只有一位贡献者（单人仓库）：** 跳过团队拆解——这份复盘是私人的。

**共同作者署名：** `COAUTHOR:` 行带有人类 `Co-Authored-By:` trailer——把这些作者与主作者一起记在这次提交的名下。AI 共同作者（例如 `noreply@anthropic.com`）则计入 `AI_ASSISTED_COMMITS`——把“AI 辅助提交”当作一个单独指标跟踪，绝不算作团队成员。

### Step 10：周环比趋势（窗口 >= 14d 时）

如果时间窗是 14 天或更长，用 `WEEK:` 行（w0 = 包含最新提交的那一周）展示趋势：
- 每周提交数（总计；按作者从 `COMMIT:` 行统计）
- 每周行数
- 每周测试占比
- 每周修复占比

### Step 11：连续天数追踪

`TEAM_STREAK` 和 `USER_STREAK` 统计至少有 1 次提交的连续天数（完整历史，不截断），锚定在**最新提交日期**——不是今天，因为脚本从不信任系统时钟。对照会话提醒里的今天来解读：
- 如果锚定日期是今天或昨天，连续记录仍然有效：“团队交付连续 47 天”/“你的交付连续 32 天”
- 如果锚定日期更早，连续记录已中断：报告 0 天，并记下最后交付日。

### Step 11.5：捷径欠账账本

收集刻意留下的 `gstack-shortcut(...)` 标记——这是用户接受 Completeness ≤ 7 选项时留下的痕迹（见 AskUserQuestion 格式一节）。零命中是健康状态，不是失败：

```bash
grep -rn "gstack-shortcut(" . \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=vendor \
  --exclude-dir=.claude --exclude-dir=dist \
  --exclude="SKILL.md" --exclude="*.md.tmpl" 2>/dev/null \
  | grep -vE "gstack-shortcut\(dec-(<|\*)" || true
```

丢弃余下那些只是在记录或测试这套约定的命中（检查清单、解析器示例、测试）。只统计本仓库代码里真实的捷径。

每个命中一行账：`<file>:<line>, <简化了什么>。ceiling: <X>。upgrade: <Y>。`
- 标记带决策 id（`dec-<id>`）：与 `gstack-decision-search` 的输出做关联——账本条目是事实源；绝不把同一个标记和它重新浮现的决策重复计数。
- 没有 id 的标记：打上 `unlinked` 标签。
- 没有写升级触发条件的标记：打上 `no-trigger` 标签——这些正是会悄悄腐烂的。

用这句话结束本节：`N markers, M with no trigger.` 如果一条都没有：`No shortcut debt. Clean ledger.`

### Step 12：加载历史并对比

在保存新快照之前，先检查既往的复盘历史：

```bash
setopt +o nomatch 2>/dev/null || true  # zsh 兼容
ls -t .context/retros/*.json 2>/dev/null
```

**如果存在既往复盘：** 用 Read 工具加载 `window` 相同且最近的一份；如果没有匹配的，披露这一点并跳过历史增量。为可用的关键指标计算增量，并包含 **Trends vs Last Retro** 一节（在 `compare` 模式下改用刚算出的上一周期）：
```
                    上次        现在         增量
测试占比：          22%    →    41%         ↑19pp
会话数：            10     →    14          ↑4
LOC/小时：          200    →    350         ↑75%
修复占比：          54%    →    30%         ↓24pp（在改善）
提交数：            32     →    47          ↑47%
深度会话：          3      →    5           ↑2
```

**建议的落实情况：** 如果那份同窗口快照有 `recommendations` 键，就对照本窗口的提交、改动文件和指标，把每条既往建议评为 `addressed`、`partial` 或 `open`，并引用证据。在报告里渲染一行 **Recommendation follow-through**（例如“2 of 3 prior recommendations addressed”），然后每条一行给出结论。如果快照没有 `recommendations` 键，静默跳过。

**如果没有任何既往复盘：** 跳过对比一节，并追加：“First retro recorded — run again next week to see trends.”

### Step 13：保存复盘历史

在算完所有指标（包括连续天数）并加载任何既往历史用于对比之后，用 Step 14 的格式起草可发推的摘要和“3 Things to Improve”条目，然后保存 JSON 快照。Step 14 的叙述必须复用这份摘要和这些条目，一字不改。`streak_days` 是 Step 11 得出的有效**团队**连续天数（中断时为 0）；个人连续天数放进 `user_streak_days`。

```bash
mkdir -p .context/retros
```

确定今天下一个未用的序号（把会话提醒的日期代入 `<today>`）：
```bash
setopt +o nomatch 2>/dev/null || true  # zsh 兼容
today="<today>"
next=1
while [ -e ".context/retros/${today}-${next}.json" ]; do next=$((next + 1)); done
# Save as .context/retros/${today}-${next}.json
```

用 Write 工具按这个 schema 保存 JSON 文件：
```json
{
  "date": "2026-03-08",
  "window": "7d",
  "metrics": {
    "commits": 47,
    "contributors": 3,
    "prs_merged": 12,
    "insertions": 3200,
    "deletions": 800,
    "net_loc": 2400,
    "test_loc": 1300,
    "test_ratio": 0.41,
    "active_days": 6,
    "sessions": 14,
    "deep_sessions": 5,
    "avg_session_minutes": 42,
    "loc_per_session_hour": 350,
    "feat_pct": 0.40,
    "fix_pct": 0.30,
    "peak_hour": 22,
    "ai_assisted_commits": 32
  },
  "authors": {
    "Garry Tan": { "commits": 32, "insertions": 2400, "deletions": 300, "test_ratio": 0.41, "top_area": "browse/" },
    "Alice": { "commits": 12, "insertions": 800, "deletions": 150, "test_ratio": 0.35, "top_area": "app/services/" }
  },
  "version_range": ["1.16.0.0", "1.16.1.0"],
  "streak_days": 47,
  "user_streak_days": 32,
  "tweetable": "Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm",
  "recommendations": [
    { "category": "testing", "text": "稳定 test/fixtures/ 里那个大约每 4 次跑挂 1 次的 auth 夹具" }
  ],
  "greptile": {
    "fixes": 3,
    "fps": 1,
    "already_fixed": 2,
    "signal_pct": 83
  }
}
```

**始终包含 `recommendations`：** 每个“3 Things to Improve”条目一个对象，`category` 是一个小写单词，文本与条目原文一致。没有条目时写 `[]`；绝不用占位内容凑数。

**注意：** 只有当 `greptile-history.md`（`GREPTILE_HISTORY` 打印的路径）存在、且时间窗内有条目时才包含 `greptile` 字段。只有当 `TODOS.md` 存在时才包含 `backlog` 字段。只有当找到测试文件（`TEST_FILES_TOTAL` > 0）时才包含 `test_health` 字段。任何一项没有数据，就整个省略该字段。

测试文件存在时，把测试健康度数据写进 JSON：
```json
  "test_health": {
    "total_test_files": 47,
    "regression_test_commits": 3,
    "test_files_changed": 8
  }
```

TODOS.md 存在时，把待办数据写进 JSON：
```json
  "backlog": {
    "total_open": 28,
    "p0_p1": 2,
    "p2": 8,
    "completed_this_period": 3,
    "added_this_period": 1
  }
```

### Step 14：撰写叙述

> **STOP。** 在撰写复盘叙述之前（Step 14，在所有指标算完并对比之后），Read `~/.claude/skills/gstack/retro/sections/report-format.md` 并完整执行。
> 不要凭记忆——那一节才是本步骤的事实源。

交付仓库范围的报告之后，执行下面的经验捕获和结果保存步骤，然后停下。不要顺势滑进全局复盘模式。

## 捕获经验

如果你在本次会话中发现了不明显的模式、坑或架构洞见，为以后的会话记录下来：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"retro","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
```

**类型：** `pattern`（可复用的做法）、`pitfall`（不要做什么）、`preference`
（用户表述的偏好）、`architecture`（结构性决策）、`tool`（库/框架洞见）、
`operational`（项目环境/CLI/工作流知识）。

**来源：** `observed`（你在代码里发现的）、`user-stated`（用户告诉你的）、
`inferred`（AI 推断）、`cross-model`（Claude 和 Codex 都同意）。

**置信度：** 1-10。要诚实。你在代码里验证过的观察到的模式是 8-9。
你没把握的推断是 4-5。用户明确表述的偏好是 10。

**files：** 包含这条经验引用的具体文件路径。这能支持过期检测：如果这些文件后来被删除，这条经验可以被标记出来。

**只记录真正的发现。** 不要记录显而易见的事。不要记录用户已经知道的事。一个好测试：这条洞见能让以后的会话省时间吗？能，就记。

---

## 全局复盘模式（Global Retrospective Mode）

`/retro global [window]` 只走这个流程，并且可以在 git 仓库之外工作。

### Global Step 1：计算时间窗

与普通复盘相同的午夜对齐逻辑。默认 7d。`global` 之后的第二个参数就是窗口（例如 `14d`、`30d`、`24h`）。

### Global Step 2：运行发现脚本

按这条回退链定位并运行发现脚本：

```bash
DISCOVER_BIN=""
[ -x ~/.claude/skills/gstack/bin/gstack-global-discover ] && DISCOVER_BIN=~/.claude/skills/gstack/bin/gstack-global-discover
[ -z "$DISCOVER_BIN" ] && [ -x .claude/skills/gstack/bin/gstack-global-discover ] && DISCOVER_BIN=.claude/skills/gstack/bin/gstack-global-discover
[ -z "$DISCOVER_BIN" ] && which gstack-global-discover >/dev/null 2>&1 && DISCOVER_BIN=$(which gstack-global-discover)
[ -z "$DISCOVER_BIN" ] && [ -f bin/gstack-global-discover.ts ] && DISCOVER_BIN="bun --no-env-file --config=/dev/null run bin/gstack-global-discover.ts"
echo "DISCOVER_BIN: $DISCOVER_BIN"
```

如果找不到可执行文件，告诉用户：“Discovery script not found. Run `bun run build` in the gstack directory to compile it.”并停止。

运行发现脚本：
```bash
$DISCOVER_BIN --since "<window>" --format json 2>/tmp/gstack-discover-stderr
```

从 `/tmp/gstack-discover-stderr` 读取 stderr 作为诊断信息。从 stdout 解析 JSON 输出。

如果 `total_sessions` 是 0，说：“No AI coding sessions found in the last <window>. Try a longer window: `/retro global 30d`”并停止。

### Global Step 3：对每个发现的仓库运行 git log

对发现 JSON 的 `repos` 数组里的每个仓库，在 `paths[]` 中找第一个有效路径（目录存在且含 `.git/`）。没有有效路径就跳过该仓库并记下来。

**对纯本地仓库**（`remote` 以 `local:` 开头）：跳过 `git fetch`，使用本地默认分支。用 `git log HEAD` 代替 `git log origin/$DEFAULT`。

**对有远程的仓库：**

```bash
git -C <path> fetch origin --quiet 2>/dev/null
```

检测每个仓库的默认分支：先试 `git symbolic-ref refs/remotes/origin/HEAD`，再检查常见分支名（`main`、`master`），最后回退到 `git rev-parse --abbrev-ref HEAD`。把检测出的分支作为下面命令里的 `<default>`。

```bash
# 带统计的提交
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%H|%aN|%ai|%s" --shortstat

# 供会话识别、连续天数和上下文切换使用的提交时间戳
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%at|%aN|%ai|%s" | sort -n

# 每位作者的提交数
git -C <path> shortlog origin/$DEFAULT --since="<start_date>T00:00:00" -sn --no-merges

# 从提交信息中提取 PR/MR 编号（GitHub #NNN，GitLab !NNN）
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%s" | grep -oE '[#!][0-9]+' | sort -t'#' -k1 | uniq
```

对失败的仓库（路径已删除、网络错误）：跳过并记下“N repos could not be reached.”。

### Global Step 4：计算全局交付连续天数

对每个仓库取提交日期（上限 365 天）：

```bash
git -C <path> log origin/$DEFAULT --since="365 days ago" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

把所有仓库的所有日期取并集。从今天往回数——有多少连续的天数里，**任意**仓库至少有一次提交？如果连续天数到达 365 天，显示为“365+ days”。

### Global Step 5：计算上下文切换指标

用 Step 3 收集到的提交时间戳，按日期分组。对每个日期，统计当天有提交的不同仓库数。报告：
- 平均每天仓库数
- 每天最大仓库数
- 哪些天是专注的（1 个仓库）、哪些是碎片化的（3+ 个仓库）

### Global Step 6：各工具的生产力模式

从发现 JSON 分析工具使用模式：
- 哪个 AI 工具用于哪些仓库（独占 vs 共享）
- 每个工具的会话数
- 行为模式（例如“Codex 专用于 myapp，其他都用 Claude Code”）

### Global Step 7：聚合并起草叙述

先起草下面的报告，但暂不发布。在 Global Step 8 加载历史，把它的趋势表插到 **All Projects Overview** 之后，然后在 Global Step 9 保存完成的快照并交付报告。快照里复用起草好的可发推摘要。

先输出适合截图的**个人卡片**，再输出团队/项目拆解。

---

**可发推摘要**（第一行，放在一切之前）：
```
Week of Mar 14: 5 projects, 138 commits, 250k LOC across 5 repos | 48 AI sessions | Streak: 52d 🔥
```

## 🚀 你的一周：[user name] — [date range]

按 `git config user.name` 过滤各仓库数据并聚合个人总计。
卡片只包含该用户的统计，不含团队总计。只用左边框；
把名字填充到最长名字的宽度，绝不截断。

```
╔═══════════════════════════════════════════════════════════════
║  [USER NAME] — Week of [date]
╠═══════════════════════════════════════════════════════════════
║
║  [N] commits across [M] projects
║  +[X]k LOC added · [Y]k LOC deleted · [Z]k net
║  [N] AI coding sessions (CC: X, Codex: Y, Gemini: Z)
║  [N]-day shipping streak 🔥
║
║  PROJECTS
║  ─────────────────────────────────────────────────────────
║  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
║  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
║  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
║
║  SHIP OF THE WEEK
║  [PR title] — [LOC] lines across [N] files
║
║  TOP WORK
║  • [1-line description of biggest theme]
║  • [1-line description of second theme]
║  • [1-line description of third theme]
║
║  Powered by gstack
╚═══════════════════════════════════════════════════════════════
```

**个人卡片的规则：**
- 只显示用户有提交的仓库。跳过 0 提交的仓库。
- 按用户的提交数降序排列仓库。
- 加宽卡片以容纳完整仓库名；对齐各列。
- 行数用“k”表示千（例如“+64.0k”而不是“+64010”）。
- 角色：用户是唯一贡献者时为“solo”，有他人贡献时为“team”。
- 本周之船：该用户在**所有**仓库中行数最多的单个 PR。
- 重点工作：从提交信息综合出的 3 个主题，不是提交清单。
- 卡片必须不依赖上下文就能说明这个用户的一周。
- 这里**不要**包含团队成员、项目总计或上下文切换数据。

**个人连续天数：** 用该用户在**所有**仓库中的提交（按
`--author` 过滤）单独算出个人连续天数，与团队连续天数区分开。

---

## 全局工程复盘：[date range]

个人卡片之后是完整的团队/项目分析。

### 全部项目概览

| 指标 | 值 |
|--------|-------|
| 活跃项目 | N |
| 总提交数（所有仓库、所有贡献者） | N |
| 总行数 | +N / -N |
| AI 编码会话 | N（CC: X，Codex: Y，Gemini: Z） |
| 活跃天数 | N |
| 全局交付连续天数（任意贡献者、任意仓库） | 连续 N 天 |
| 每天上下文切换 | 平均 N（最大：M） |

### 逐项目拆解

对每个仓库（按提交数降序）：
- 仓库名（含占总提交的百分比）
- 提交数、行数、已合并 PR、头号贡献者
- 关键工作（从提交信息推断）
- 按工具的 AI 会话

**你的贡献**（每个项目内的小节）：
对每个项目，按 `git config user.name` 过滤，包含：
- 你的提交 / 总提交（含百分比）
- 你的行数（+新增 / -删除）
- 你的关键工作（只从**你的**提交信息推断）
- 你的提交类型构成（feat/fix/refactor/chore/docs 拆解）
- 你在该仓库最大的一次交付（行数最多的提交或 PR）

如果用户是唯一贡献者，说“Solo project — all commits are yours.”
如果用户在某仓库 0 提交（本周期没碰过的团队项目），
说“No commits this period — [N] AI sessions only.”并跳过拆解。

格式：
```
**Your contributions:** 47/244 commits (19%), +4.2k/-0.3k LOC
  Key work: Writer Chat, email blocking, security hardening
  Biggest ship: PR #605 — Writer Chat eats the admin bar (2,457 ins, 46 files)
  Mix: feat(3) fix(2) chore(1)
```

### 跨项目模式
- 跨项目的时间分配（百分比拆解，用**你的**提交而非总数）
- 聚合所有仓库的高峰生产力时段
- 专注日 vs 碎片日
- 上下文切换趋势

### 工具使用分析
按工具拆解并给出行为模式：
- Claude Code：N 次会话，跨 M 个仓库——观察到的模式
- Codex：N 次会话，跨 M 个仓库——观察到的模式
- Gemini：N 次会话，跨 M 个仓库——观察到的模式

### 本周之船（全局）
**所有**项目中影响最大的一次 PR。按行数和提交信息识别。

### 3 条跨项目洞见
全局视角能揭示、而任何单仓库复盘都看不到的东西。

### 下周的 3 个习惯
把完整的跨项目图景考虑进去。

---

### Global Step 8：加载历史并对比

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
setopt +o nomatch 2>/dev/null || true  # zsh 兼容
ls -t "$GSTACK_STATE_ROOT"/retros/global-*.json 2>/dev/null | head -5
```

**只与 `window` 值相同的既往复盘对比**（例如 7d 对 7d）。如果最近一份既往复盘的窗口不同，跳过对比并注明：“Prior global retro used a different window — skipping comparison.”

如果存在匹配的既往复盘，用 Read 工具加载。显示 **Trends vs Last Global Retro** 表，给出关键指标的增量：总提交数、行数、会话数、连续天数、每天上下文切换。

如果没有任何既往全局复盘，追加：“First global retro recorded — run again next week to see trends.”

### Global Step 9：保存快照

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/retros
```

确定今天下一个未用的序号，使用与 Global Step 1 相同的会话提醒日期：
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
setopt +o nomatch 2>/dev/null || true  # zsh 兼容
today="<today>"
next=1
while [ -e "$GSTACK_STATE_ROOT/retros/global-${today}-${next}.json" ]; do next=$((next + 1)); done
echo "RETRO_FILE: $GSTACK_STATE_ROOT/retros/global-${today}-${next}.json"
```

用 Write 工具把 JSON 保存到打印出的 `RETRO_FILE`：

```json
{
  "type": "global",
  "date": "2026-03-21",
  "window": "7d",
  "projects": [
    {
      "name": "gstack",
      "remote": "<detected from git remote get-url origin, normalized to HTTPS>",
      "commits": 47,
      "insertions": 3200,
      "deletions": 800,
      "sessions": { "claude_code": 15, "codex": 3, "gemini": 0 }
    }
  ],
  "totals": {
    "commits": 182,
    "insertions": 15300,
    "deletions": 4200,
    "projects": 5,
    "active_days": 6,
    "sessions": { "claude_code": 48, "codex": 8, "gemini": 3 },
    "global_streak_days": 52,
    "avg_context_switches_per_day": 2.1
  },
  "tweetable": "Week of Mar 14: 5 projects, 182 commits, 15.3k LOC | CC: 48, Codex: 8, Gemini: 3 | Focus: gstack (58%) | Streak: 52d"
}
```

---

## 对比模式（Compare Mode）

当用户运行 `/retro compare`（或 `/retro compare 14d`）：

1. 对当前窗口（默认 7d）执行 Step 0.5-1，使用午夜对齐的起始日期（与主复盘相同的逻辑——例如今天是 2026-03-18、窗口 7d，则 `--since "2026-03-11T00:00:00"`）
2. 对紧邻的等长窗口再运行一次 `gstack-retro-metrics`，同时使用 `--since` 和 `--until`（例如从 2026-03-11 起的 7d 窗口：`--since "2026-03-04T00:00:00" --until "2026-03-10T23:59:59"`）
3. 对每份数据集执行 Step 2-10 计算各窗口指标，把当前值和上一期值分开保存。Step 11-11.5 只对当前报告执行：连续天数使用完整历史，捷径账本扫描当前工作树，所以两者都不是上一窗口的指标。新鲜度守卫只作用于当前窗口；一个不活跃的上一窗口仍是有效的对比数据。对小时窗口，先取一个明确的结束时间戳，再为两个起点各减一次请求的小时数。git 包含 `--until`，所以上一窗口的结束用当前起点减 1 秒，避免边界提交被重复计数。
4. 用 **Current vs Prior Period** 表替代 Step 12 的已保存历史对比，覆盖提交数、逻辑 SLOC、测试占比、会话数和修复占比。显示绝对增量和百分比变化（占比类变化用百分点）；如果上一期值为零，绝对变化照报，百分比变化记为 N/A。在 Step 14 的叙述里突出最大的改善和退步。
5. 只对当前窗口执行 Step 13-14 和报告后的捕获；**不要**持久化上一窗口的指标。这种对比在首次运行时就可用，不依赖已保存的历史。

## 语气

- 鼓励但坦率，不哄人
- 具体、有据——始终锚定在真实的提交/代码上
- 跳过泛泛的赞扬（“干得好！”）——说清楚好在哪、为什么
- 把改进框定为升级，而不是批评
- **赞扬应该像你真会在 1:1 里说的话**——具体、配得上、真诚
- **成长建议应该像投资建议**——“这件事值得你花时间，因为……”而不是“你在这方面失败了……”
- 绝不在队友之间做负面比较。每个人的小节自成一体。
- 报告篇幅要匹配窗口和团队：每一节都带具体证据，无话可说的节就删掉，不要灌水
- 数据用 markdown 表格和代码块，叙述用散文
- 叙述直接输出到对话；唯一的报告文件是 JSON 快照（仓库复盘放在 `.context/retros/`，全局复盘放在 `$GSTACK_STATE_ROOT/retros/`）

## 重要规则

- 所有叙述输出都直接在对话里给用户。除了 JSON 快照，只有经验捕获和 gbrain 捕获步骤会写东西。
- 指标脚本分析的是 `origin/<default>`（不是可能过期的本地 main）；当 `RETRO_REF` 显示并非如此时，要披露
- 所有时间戳按用户本地时区显示（不要覆盖 `TZ`）
- 如果 `COMMITS: 0`，说出来并建议换一个窗口
- LOC/小时取整到最近的 50（脚本已预取整 `LOC_PER_SESSION_HOUR`）
- 把 merge commit 当作 PR 边界
- 不要读 CLAUDE.md 或无关文档——本技能是自包含的；CHANGELOG 和上面明确点名的可选输入是例外
- 首次运行（没有既往复盘）时优雅地跳过已保存历史对比；显式的 `compare` 模式仍会计算它的上一窗口
- **全局模式：** 不要求在 git 仓库内。快照保存到 `~/.gstack/retros/`（不是 `.context/retros/`）。优雅地跳过未安装的 AI 工具。只与窗口值相同的既往全局复盘对比。如果连续天数触到 365 天上限，显示为“365+ days”。