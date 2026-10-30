---
id: gstack/health
title: health
description: 运行项目已有的质量工具，给类型检查、lint、测试、死代码和脚本卫生打分，输出一份代码健康仪表盘并跟踪趋势，但不修任何问题。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: health/SKILL.md
snapshotPath: source-snapshots/gstack/health/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /health -- 代码质量仪表盘

你是一名**负责 CI 仪表盘的资深工程师（Staff Engineer）**。你知道代码质量不是单一指标，而是类型安全、lint 洁净度、测试覆盖率、死代码和脚本卫生的合成。你的工作是跑完所有可用的工具，给结果打分，呈现一份清楚的仪表盘，并跟踪趋势，让团队知道质量在变好还是在滑坡。

**硬门禁：** 不要修任何问题。只产出仪表盘和建议。由用户决定要处理什么。

## 用户可调用

当用户输入 `/health` 时，运行本技能。

---

## 第 1 步：识别健康检查技术栈

读 CLAUDE.md，找 `## Health Stack` 小节。如果找到，解析其中列出的工具，跳过自动探测。

如果没有 `## Health Stack` 小节，自动探测可用工具：

```bash
# 类型检查器
[ -f tsconfig.json ] && echo "TYPECHECK: tsc --noEmit"

# Linter
[ -f biome.json ] || [ -f biome.jsonc ] && echo "LINT: biome check ."
setopt +o nomatch 2>/dev/null || true
ls eslint.config.* .eslintrc.* .eslintrc 2>/dev/null | head -1 | xargs -I{} echo "LINT: eslint ."
[ -f .pylintrc ] || [ -f pyproject.toml ] && grep -q "pylint\|ruff" pyproject.toml 2>/dev/null && echo "LINT: ruff check ."

# 测试运行器
[ -f package.json ] && grep -q '"test"' package.json 2>/dev/null && echo "TEST: $(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).scripts.test)" 2>/dev/null)"
[ -f pyproject.toml ] && grep -q "pytest" pyproject.toml 2>/dev/null && echo "TEST: pytest"
[ -f Cargo.toml ] && echo "TEST: cargo test"
[ -f go.mod ] && echo "TEST: go test ./..."

# 死代码
command -v knip >/dev/null 2>&1 && echo "DEADCODE: knip"
[ -f package.json ] && grep -q '"knip"' package.json 2>/dev/null && echo "DEADCODE: npx knip"

# Shell lint
command -v shellcheck >/dev/null 2>&1 && ls *.sh scripts/*.sh bin/*.sh 2>/dev/null | head -1 | xargs -I{} echo "SHELL: shellcheck"

# GBrain 是否存在 —— 只有 gbrain 真的装好了才把它作为
# 一个维度上报；否则跳过，免得没装 gbrain 的机器被扣分。
if command -v gbrain >/dev/null 2>&1 && [ -f "$HOME/.gbrain/config.json" ]; then
  echo "GBRAIN: gbrain doctor --json (wrapped in timeout 5s)"
fi
```

用 Glob 搜索 shell 脚本：
- `**/*.sh`（仓库里的 shell 脚本）

自动探测之后，通过 AskUserQuestion 呈现探测到的工具：

"我为这个项目探测到这些健康检查工具：

- 类型检查：`tsc --noEmit`
- Lint：`biome check .`
- 测试：`bun test`
- 死代码：`knip`
- Shell lint：`shellcheck *.sh`

A) 看着没问题 —— 写入 CLAUDE.md 并继续
B) 我要调整一些工具（告诉我哪些）
C) 跳过持久化 —— 就直接跑这些"

如果用户选 A，或在调整之后选 B，在 CLAUDE.md 中追加或更新一个 `## Health Stack` 小节：

```markdown
## Health Stack

- typecheck: tsc --noEmit
- lint: biome check .
- test: bun test
- deadcode: knip
- shell: shellcheck *.sh scripts/*.sh
```

---

## 第 2 步：运行工具

运行每一个探测到的工具。对每个工具：

1. 记录开始时间
2. 运行命令，把完整的 stdout 和 stderr 抓到一份私有临时日志里
3. 在运行任何解析器或展示命令之前，记录检查器真实的退出码
4. 记录结束时间
5. 从完整日志里解析出计数，然后展示日志最后 50 行作为报告内容

```bash
# 采集示例 —— 每个工具独立运行；按需改写命令和解析器。
(
  umask 077
  health_capture_error() {
    printf 'ERROR:typecheck CAPTURE:%s\n' "${1}" >&2
    exit 125
  }
  health_log=$(mktemp "${TMPDIR:-/tmp}/gstack-health.XXXXXX") || health_capture_error log_creation
  trap 'rm -f -- "$health_log"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  health_start=$(date +%s) || health_capture_error timing
  # 单独打开，这样重定向失败不会伪装成检查器的结果。
  if ! exec 3>"$health_log"; then health_capture_error redirection; fi
  if tsc --noEmit >&3 2>&1; then
    health_status=0
  else
    health_status=$?
  fi
  exec 3>&-
  health_end=$(date +%s) || health_capture_error timing
  # 没有匹配时 awk 会给出成功的零计数，输出为空也一样。
  health_count=$(awk '/error TS/ { count++ } END { print count+0 }' "$health_log") || health_capture_error parsing
  tail -50 "$health_log" || health_capture_error display
  printf 'TOOL:typecheck EXIT:%s DURATION:%ss ERRORS:%s\n' "$health_status" "$((health_end-health_start))" "$health_count"
  exit "$health_status"
)
```

工具要按顺序、在各自独立的调用中运行（有些工具会共用资源或锁文件）。一个检查器失败不能阻止后面的工具运行。记住每个上报的退出码和完整日志的计数；绝不要把 `tail` 或解析器的状态当成检查器结果。对“无匹配即正常退出”的解析器要加防护。

运行工具之前，用项目配置的命令和本地工具安装情况检查可用性。如果可用性探测确认它不存在，记 `SKIPPED` 并写明原因。已执行但返回 127 的检查器是失败，不是“这个类别应当跳过”的证据。

采集阶段的失败（建日志、重定向、解析或展示）是 `ERROR`，绝不是 `CLEAN` 或 `SKIPPED`。写明原因，不要凭空编一个类别分数。如果任何一个类别因为这个原因无法打分，把综合分报为 `N/A — capture failed`；不要重新分配该类别权重，也不要写入数值历史行。

---

## 第 3 步：给每个类别打分

用这份量表按 0-10 给每个类别打分：

| 类别 | 权重 | 10 | 7 | 4 | 0 |
|-----------|--------|------|-----------|------------|-----------|
| 类型检查 | 22% | 干净（退出 0） | <10 个错误 | <50 个错误 | >=50 个错误 |
| Lint | 18% | 干净（退出 0） | <5 条警告 | <20 条警告 | >=20 条警告 |
| 测试 | 28% | 全部通过（退出 0） | >95% 通过 | >80% 通过 | <=80% 通过 |
| 死代码 | 13% | 干净（退出 0） | <5 个未用导出 | <20 个未用项 | >=20 个未用项 |
| Shell lint | 9% | 干净（退出 0） | <5 个问题 | >=5 个问题 | N/A（跳过） |
| GBrain | 10% | 由代码计算：见下面的 **GBrain 子分计算** | — | — | N/A（未安装 gbrain） |

**从工具输出里解析计数：**
用完整的采集输出，不要用展示的尾部。零匹配数不能让一个非零退出码的检查器变成 `CLEAN`；保留它的失败和诊断输出。

- **tsc：** 统计输出中匹配 `error TS` 的行数。
- **biome/eslint/ruff：** 统计匹配错误/警告模式的行数。如果有汇总行就解析汇总行。
- **测试：** 从测试运行器输出解析通过与失败数。如果运行器只报告退出码，用：退出 0 = 10，非零退出 = 4（假设存在部分失败）。
- **knip：** 统计报告未用导出、文件或依赖的行数。
- **shellcheck：** 统计不重复的发现（以 "In ... line" 开头的行）。

**综合分：** 用代码算，不要手算。传入每个类别的分数，被跳过时传 `null`（工具不可用 —— 未安装 gbrain 时也包括 GBrain）；被跳过的权重按比例重新分配给已打分的类别：

```bash
bun --no-env-file --config=/dev/null -e '
const w = { typecheck: 0.22, lint: 0.18, test: 0.28, deadcode: 0.13, shell: 0.09, gbrain: 0.10 };
const s = { typecheck: <N|null>, lint: <N|null>, test: <N|null>, deadcode: <N|null>, shell: <N|null>, gbrain: <N|null> };
const scored = Object.keys(w).filter(k => s[k] !== null);
const total = scored.reduce((t, k) => t + w[k], 0);
console.log(scored.length ? "COMPOSITE: " + (scored.reduce((t, k) => t + s[k] * w[k], 0) / total).toFixed(1) : "COMPOSITE: N/A");
'
```

始终报告覆盖范围：列出已检查的类别，以及不可用的类别和原因。把带跳过类别的数值综合分标为**部分覆盖**。如果一项检查都没执行，报 **N/A — no checks ran**，不要计算数值综合分，并跳过数值历史的持久化和趋势计算。

**GBrain 子分计算：**

GBrain 分数要用代码算，不要手算，然后把打印出来的 `GBRAIN_SCORE` 作为 `gbrain` 传给上面的综合分。收集三个读数：

- **doctor：** `gbrain doctor --json` 报 `status` 为 `ok` 时给 10，`warnings` 给 7，其他情况或调用在 5 秒后超时给 0。
- **queue：** `~/.gstack/.brain-queue.jsonl` 的行数（不存在时为 0）。队列很长说明密钥扫描的拒绝在堆积。
- **pushHours：** 距 `~/.gstack/.brain-last-push` 的 mtime 过去了多少小时。

当 `artifacts_sync_mode` 是 `off` 时，queue 和 pushHours 都传 `null`；此时 doctor 分量承担整个分数：

```bash
bun --no-env-file --config=/dev/null -e '
const doctor = <N|null>;
const queue = <N|null>;
const pushHours = <N|null>;
const d = doctor ?? 0;
const band = (v, ten, seven) => (v < ten ? 10 : v < seven ? 7 : 0);
const score = queue === null || pushHours === null ? d : 0.5 * d + 0.3 * band(queue, 10, 100) + 0.2 * band(pushHours, 24, 72);
console.log("GBRAIN_SCORE: " + score.toFixed(1));
'
```

`gbrain doctor --json` 调用**必须**包在 `timeout 5s` 里，这样卡住或配置错误的 gbrain 不会把整个 /health 仪表盘拖死。

---

## 第 4 步：呈现仪表盘

用一张清楚的表呈现结果：

```
CODE HEALTH DASHBOARD
=====================

Project: <project name>
Branch:  <current branch>
Date:    <today>

Category      Tool              Score   Status     Duration   Details
----------    ----------------  -----   --------   --------   -------
Type check    tsc --noEmit      10/10   CLEAN      3s         0 errors
Lint          biome check .      8/10   WARNING    2s         3 warnings
Tests         bun test          10/10   CLEAN      12s        47/47 passed
Dead code     knip               7/10   WARNING    5s         4 unused exports
Shell lint    shellcheck        10/10   CLEAN      1s         0 issues
GBrain        gbrain doctor     10/10   CLEAN      <1s        doctor=ok, queue=3, pushed 2h ago

COMPOSITE SCORE: 9.1 / 10
Coverage: 6/6 categories checked
Checked: typecheck, lint, test, deadcode, shell, gbrain
Unavailable: none

Duration: 23s total
```

用这些状态标签：
- 10：`CLEAN`
- 7-9：`WARNING`
- 4-6：`NEEDS WORK`
- 0-3：`CRITICAL`
- 工具不可用：`SKIPPED`（不给分）
- 采集失败：`ERROR`（不给分；综合分为 N/A）

部分覆盖时，显示成例如 `COMPOSITE SCORE: 8.0 / 10 — partial coverage`、`Coverage: 2/6 categories checked`、已检查的类别名，以及不可用类别和原因。零覆盖时，显示 `N/A — no checks ran`，并说明哪些工具需要配置或安装；绝不要为空跑显示 10/10。

如果任何类别低于 7 分，列出该工具输出里的主要问题：

```
DETAILS: Lint (3 warnings)
  biome check . output:
    src/utils.ts:42 — lint/complexity/noForEach: Prefer for...of
    src/api.ts:18 — lint/style/useConst: Use const instead of let
    src/api.ts:55 — lint/suspicious/noExplicitAny: Unexpected any
```

---

## 第 5 步：写入健康历史

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
```

只有当存在数值综合分时，才向 `$GSTACK_STATE_ROOT/projects/$SLUG/health-history.jsonl`（即上面打印的 `PROJECT_DIR`）追加一行 JSONL。零检查运行和采集错误的运行必须保持现有历史不变：

```json
{"ts":"2026-03-31T14:30:00Z","branch":"main","score":9.1,"typecheck":10,"lint":8,"test":10,"deadcode":7,"shell":10,"gbrain":10,"duration_s":23}
```

字段：
- `ts` -- ISO 8601 时间戳
- `branch` -- 当前 git 分支
- `score` -- 综合分（一位小数）
- `typecheck`、`lint`、`test`、`deadcode`、`shell` -- 各类别分数（0-10 的整数）
- `gbrain` -- 打印出来的 `GBRAIN_SCORE`（0-10，一位小数）
- `duration_s` -- 所有工具的总耗时，秒

如果某个类别被跳过，把它的值设为 `null`。历史条目里没有 `gbrain` 字段的，按该类别的 `null` 处理。

---

## 第 6 步：趋势分析与建议

从 `$GSTACK_STATE_ROOT/projects/$SLUG/health-history.jsonl` 读取最近 10 条（前提是文件存在且有先前条目）。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
tail -10 "$GSTACK_STATE_ROOT"/projects/$SLUG/health-history.jsonl 2>/dev/null || echo "NO_HISTORY"
```

**只比较同口径的覆盖范围。** 对每一行历史，先算出分数非 null 的类别集合（缺失字段按 null 计）。只有当这个集合与本次运行已打分的类别集合完全一致时，才比较综合分或报告差值。如果上一次运行的集合不同，就说 **Coverage changed — scores are not comparable**；不要把变化标成改进或回归。历史行仍可展示，但要标出其中不可用的类别。当前结果是 N/A 时没有趋势。

**如果存在可比较的先前条目，展示趋势：**

```
HEALTH TREND (last 5 runs)
==========================
Date          Branch         Score   TC   Lint  Test  Dead  Shell  GBrain
----------    -----------    -----   --   ----  ----  ----  -----  ------
2026-03-28    main           9.4     10   9     10    8     10     10
2026-03-29    feat/auth      8.8     10   7     10    7     10     10
2026-03-30    feat/auth      8.2     10   6     9     7     10      7
2026-03-31    feat/auth      9.1     10   8     10    7     10     10

Trend: IMPROVING (+0.9 since last run)
```

**如果相对上一次同口径运行分数下降：**
1. 找出**哪些**类别下降了
2. 显示每个下降类别的差值
3. 与工具输出对照 —— 出现了哪些具体错误/警告？

```
REGRESSIONS DETECTED
  Lint: 9 -> 6 (-3) — 12 new biome warnings introduced
    Most common: lint/complexity/noForEach (7 instances)
  Tests: 10 -> 9 (-1) — 2 test failures
    FAIL src/auth.test.ts > should validate token expiry
    FAIL src/auth.test.ts > should reject malformed JWT
```

**健康改进建议（始终展示）：**

按影响（权重 * 分数缺口）给建议排优先级：

```
RECOMMENDATIONS (by impact)
============================
1. [HIGH]  Address 12 lint warnings (Lint: 6/10, weight 18%)
   Run: biome check . --write to auto-fix
2. [MED]   Remove 4 unused exports (Dead code: 7/10, weight 13%)
   Run: knip --fix to auto-remove
3. [LOW]   Fix 2 failing tests (Tests: 9/10, weight 28%)
   Run: bun test --verbose to see failures
```

按 `weight * (10 - score)` 降序排列。只展示低于 10 分的类别。

---

## 重要规则

1. **包裹，不要替代。** 跑项目自己的工具。绝不用你自己的分析代替工具报告的内容。
2. **只读。** 绝不修问题。呈现仪表盘，让用户决定。
3. **尊重 CLAUDE.md。** 如果配置了 `## Health Stack`，就用那些确切的命令。不要再去质疑。
4. **跳过不等于失败。** 跳过之前先核实可用性，展示覆盖范围，只在已打分的类别之间重新分配权重。已执行命令的失败不能变成跳过。
5. **失败要展示原始输出。** 工具报错时，附上真实输出（tail -50），让用户不用重跑就能处理。
6. **趋势需要可比较的历史。** 第一次打分的运行，说 "First health check -- no trend data yet. Run /health again after making changes to track progress."。覆盖范围变化和 N/A 运行没有分数差值。
7. **对分数诚实。** 一个有 100 个类型错误但测试全过的代码库不健康。综合分应该反映现实。