---
id: gstack/openclaw/retro
title: gstack-openclaw-retro
description: 按周生成工程复盘：统计提交历史、工作时段、测试比例与热点文件，并覆盖每位贡献者的表现与成长点。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: openclaw/skills/gstack-openclaw-retro/SKILL.md
snapshotPath: source-snapshots/gstack/openclaw/retro/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 每周工程复盘

生成一份完整的工程复盘，分析提交历史、工作模式和代码质量指标。它感知团队：先识别运行命令的当前用户，再分析每位贡献者，给出逐人的肯定和成长机会。

## 参数

- 默认：最近 7 天
- `24h`：最近 24 小时
- `14d`：最近 14 天
- `30d`：最近 30 天
- `compare`：当前窗口与之前等长窗口对比

## 说明

解析参数确定时间窗口。默认 7 天。所有时间都应使用用户的**本地时区**报告。

**对齐到午夜的窗口：** 对"天"为单位的情况，计算本地午夜的绝对起始日期。例如今天是 2026-03-18、窗口为 7 天时，起始日期是 2026-03-11。git log 查询用 `--since="2026-03-11T00:00:00"`。对"小时"为单位的情况，用 `--since="N hours ago"`。

---

### Step 1：收集原始数据

先拉取 origin 并识别当前用户：

```bash
git fetch origin main --quiet
git config user.name
git config user.email
```

`git config user.name` 返回的名字就是**"你"** …… 正在读这份复盘的人。其他作者都是队友。

运行下面**所有** git 命令（它们相互独立）：

```bash
# All commits with timestamps, subject, hash, author, files changed
git log origin/main --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# Per-commit test vs total LOC breakdown with author
git log origin/main --since="<window>" --format="COMMIT:%H|%aN" --numstat

# Commit timestamps for session detection and hourly distribution
git log origin/main --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# Files most frequently changed (hotspot analysis)
git log origin/main --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn

# PR numbers from commit messages
git log origin/main --since="<window>" --format="%s" | grep -oE '[#!][0-9]+' | sort -t'#' -k1 | uniq

# Per-author file hotspots
git log origin/main --since="<window>" --format="AUTHOR:%aN" --name-only

# Per-author commit counts
git shortlog origin/main --since="<window>" -sn --no-merges

# Test file count
git ls-files 2>/dev/null | grep -E '(\.test\.|\.spec\.|_test\.|_spec\.)' | wc -l

# Test files changed in window
git log origin/main --since="<window>" --format="" --name-only | grep -E '\.(test|spec)\.' | sort -u | wc -l
```

---

### Step 2：计算指标

算出并在摘要里呈现这些指标：

- **合入 main 的提交数：** N
- **贡献者：** N
- **已合并 PR：** N
- **总插入行数：** N
- **总删除行数：** N
- **净增代码行数：** N
- **测试代码行（插入）：** N
- **测试代码比例：** N%
- **版本范围：** vX.Y.Z → vX.Y.Z
- **活跃天数：** N
- **识别出的工作时段：** N
- **每会话小时平均代码行：** N

然后紧接着给出**按作者的排行榜**：

```
Contributor         Commits   +/-          Top area
You (garry)              32   +2400/-300   browse/
alice                    12   +800/-150    app/services/
bob                       3   +120/-40     tests/
```

按提交数从多到少排序。当前用户始终排第一，标为 "You (name)"。

---

### Step 3：提交时间分布

按本地时间展示每小时直方图：

```
Hour  Commits  ████████████████
 00:    4      ████
 07:    5      █████
 ...
```

识别：
- 高峰时段
- 死区
- 双峰模式（早上/晚上）还是连续分布
- 深夜编码聚集（晚上 10 点之后）

---

### Step 4：工作时段检测

用相邻提交之间 **45 分钟间隔** 作为阈值来检测会话。

给会话分类：
- **深度会话**（50 分钟以上）
- **中等会话**（20-50 分钟）
- **微会话**（少于 20 分钟，单次提交）

计算：
- 总活跃编码时间
- 平均会话长度
- 每活跃小时代码行数

---

### Step 5：提交类型分布

按约定式提交前缀（feat/fix/refactor/test/chore/docs）分类。用百分比条展示：

```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
```

如果 fix 比例超过 50% 就标出来…… 这信号说明"快速交付、快速修复"，可能意味着审查有缺口。

---

### Step 6：热点分析

展示改动最多的前 10 个文件。标出：
- 被改 5 次以上的文件（折腾热点）
- 热点列表里的测试文件与生产文件
- VERSION/CHANGELOG 的出现频率

---

### Step 7：PR 规模分布

估算 PR 规模并分桶：
- **小**（少于 100 行）
- **中**（100-500 行）
- **大**（500-1500 行）
- **超大**（1500 行以上）

---

### Step 8：专注度评分 + 本周之船

**专注度评分：** 触及改动最多的那个顶层目录的提交所占百分比。越高 = 工作越聚焦。越低 = 上下文切换越分散。

**本周之船：** 窗口内代码行数最多的单个 PR。突出 PR 编号、改动行数，以及它为什么重要。

---

### Step 9：团队成员分析

对每位贡献者（包括当前用户）计算：

1. **提交与代码行** …… 总提交数、插入、删除、净代码行
2. **专注区域** …… 触碰最多的目录/文件（前 3）
3. **提交类型构成** …… 其个人的 feat/fix/refactor/test 分布
4. **会话模式** …… 什么时候写代码（高峰时段）、会话数
5. **测试纪律** …… 其个人的测试代码比例
6. **最大交付** …… 其单个影响最大的提交或 PR

**对当前用户（"你"）：** 最深的处理。包含所有会话分析、时间模式、专注度评分。用第一人称叙述。

**对每位队友：** 用 2-3 句话说明他们交付了什么以及他们的模式。然后：

- **肯定**（1-2 件具体的事）：锚定在真实提交上。不要说"干得好"…… 说清到底哪里好。
- **成长机会**（1 件具体的事）：框定为升级，不是批评。锚定在真实数据上。

**如果是单人仓库：** 跳过团队拆解。

**AI 协作：** 如果提交带有 `Co-Authored-By` AI trailer，把"AI 辅助提交"作为单独指标统计。

---

### Step 10：逐周趋势（窗口 ≥ 14 天时）

按周分桶并展示趋势：
- 每周提交数（总数和逐人）
- 每周代码行
- 每周测试比例
- 每周 fix 比例
- 每周会话数

---

### Step 11：连续天数跟踪

从今天往回数，统计至少 1 次提交的连续天数：

```bash
# Team streak
git log origin/main --format="%ad" --date=format:"%Y-%m-%d" | sort -u

# Personal streak
git log origin/main --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

两者都展示：
- "团队交付连续天数：47 天"
- "你的交付连续天数：32 天"

---

### Step 12：加载历史并对比

检查 `memory/` 里是否有以前的复盘记录：

如果存在以前的复盘，加载最近一份并计算差值：

```
                    Last        Now         Delta
Test ratio:         22%    →    41%         ↑19pp
Sessions:           10     →    14          ↑4
LOC/hour:           200    →    350         ↑75%
Fix ratio:          54%    →    30%         ↓24pp (improving)
```

如果没有以前的复盘，注明"首次记录复盘，下周再跑一次就能看到趋势。"

---

### Step 13：保存复盘历史

把 JSON 快照保存到 `memory/retro-YYYY-MM-DD.json`，包含指标、作者、版本范围、连续天数和可用于发帖的摘要。

---

### Step 14：撰写叙述

**面向 Telegram 的格式**（要点列表、加粗，最终输出里不要 Markdown 表格）。

结构：

**可发帖摘要**（第一行）：
> Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d

然后是小节：

- **摘要** …… 关键指标
- **与上次复盘的对比** …… 差值（首次复盘时跳过）
- **时间与会话模式** …… 团队何时写代码、会话长度、深度与微型
- **交付速度** …… 提交类型、PR 规模、修复链检测
- **代码质量信号** …… 测试比例、热点、折腾度
- **专注与亮点** …… 专注度评分、本周之船
- **你的一周** …… 对当前用户的个人深度剖析
- **团队拆解** …… 逐队友分析，含肯定 + 成长（单人就跳过）
- **团队三大成果** …… 影响最大的交付
- **三件可改进的事** …… 具体、可执行、锚定在提交上
- **下周三个习惯** …… 小、实用、现实（采纳成本低于 5 分钟）

---

## 对比模式

当用户说 "compare" 时：
- 跑当前窗口的复盘
- 跑之前等长窗口的复盘
- 并排呈现指标，用箭头显示改善/退步
- 对最大变化做简短叙述

---

## 重要规则

- **所有时间用本地时区。** 绝不设置 `TZ`。
- **按 Telegram 格式。** 用要点和加粗。最终输出里避免 Markdown 表格。
- **肯定要锚定在提交上。** 不说清哪里好，就绝不说"干得好"。
- **成长点要锚定在数据上。** 没有证据就不批评。
- **保存历史。** 每份复盘都保存到 `memory/` 以便跟踪趋势。
- **完成状态：**
  - DONE …… 复盘已生成，历史已保存
  - DONE_WITH_CONCERNS …… 已生成但数据缺失（例如没有可对比的旧复盘）
  - BLOCKED …… 不在 git 仓库里，或窗口内没有提交