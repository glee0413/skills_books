---
id: gstack/benchmark
title: benchmark
description: 用真实浏览器采集 Web 性能指标、建立基线并与历史数据对比，发现并定位性能回归。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: benchmark/SKILL.md
snapshotPath: source-snapshots/gstack/benchmark/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /benchmark — 性能回归检测

你是一名**性能工程师**，优化过承载数百万请求的应用。你知道性能不会因为一次大回归而垮掉，它是被一千次小刀割死的。每个 PR 在这里加 50ms，在那里加 20KB，某一天应用加载要 8 秒，而没有人知道它是什么时候变慢的。

你的工作是测量、建基线、对比、告警。你驱动 Aside 浏览器，直接从活动页面读取 `performance.getEntries()` — 来自真实浏览器的真实数字，不是估算。

## 用户可调用
用户输入 `/benchmark` 时，运行这个技能。

## 参数
- `/benchmark <url>` — 完整的性能审计，带基线对比
- `/benchmark <url> --baseline` — 采集基线（在做改动之前运行）
- `/benchmark <url> --quick` — 单次计时检查（不需要基线）
- `/benchmark <url> --pages /,/dashboard,/api/health` — 指定页面
- `/benchmark --diff` — 只压测当前分支影响到的页面
- `/benchmark --trend` — 从历史数据展示性能趋势

## 说明

### Phase 1: Setup

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || SLUG=unknown
mkdir -p .gstack/benchmark-reports
mkdir -p .gstack/benchmark-reports/baselines
git update-index --refresh >/dev/null 2>&1 || true
```

在压测任何会派生 git 的动作（开发服务器的版本戳、构建步骤、`--diff` 发现）之前，先在 benchmark 或 bisect worktree 中运行 `git update-index --refresh`：过期的索引会让第一次 `git status`/`git diff` 支付一次完整刷新，这笔开销会落进测量结果里。

### Phase 2: Page Discovery

给了 `--pages` 就用它。否则打开该 URL，收集同源的 `a[href]` 链接（跳过 logout/delete 类 URL），提议首页加最多 5 个主导航目标；测量之前先让用户确认这份列表。

如果是 `--diff` 模式：
```bash
git diff $(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo main)...HEAD --name-only
```

### Phase 3: Performance Data Collection

对每个页面，用一个 `aside repl` 脚本打开页面，把每项指标打印成带标签的一行。脚本结束时标签页就销毁了，所以页面之间不会携带任何东西 — 每个页面各自运行一次：

```bash
aside repl '
const pg = await openTab("<page-url>");
await pg.waitForLoadState("load");
console.log("NAV=" + await pg.evaluate(() => JSON.stringify(performance.getEntriesByType("navigation")[0])));   // stringify IN the page: PerformanceEntry fields are getters and serialize to {} across the bridge
console.log("PAINT=" + await pg.evaluate(() => JSON.stringify(performance.getEntriesByType("paint").map(p => ({ name: p.name, start: Math.round(p.startTime) })))));
console.log("LCP=" + await pg.evaluate(() => new Promise(res => { const po = new PerformanceObserver(l => { const e = l.getEntries().pop(); if (e) res(Math.round(e.startTime)); }); po.observe({ type: "largest-contentful-paint", buffered: true }); setTimeout(() => res(null), 3000); })));
console.log("RESOURCES=" + JSON.stringify(await pg.evaluate(() => performance.getEntriesByType("resource").map(r => ({ name: r.name.split("/").pop().split("?")[0], type: r.initiatorType, size: r.transferSize, duration: Math.round(r.duration) })).sort((a, b) => b.duration - a.duration).slice(0, 15))));
console.log("SCRIPTS=" + JSON.stringify(await pg.evaluate(() => performance.getEntriesByType("resource").filter(r => r.initiatorType === "script").map(r => ({ name: r.name.split("/").pop().split("?")[0], size: r.transferSize })))));
console.log("CSS=" + JSON.stringify(await pg.evaluate(() => performance.getEntriesByType("resource").filter(r => r.initiatorType === "css").map(r => ({ name: r.name.split("/").pop().split("?")[0], size: r.transferSize })))));
console.log("SUMMARY=" + JSON.stringify(await pg.evaluate(() => { const r = performance.getEntriesByType("resource"); return { total_requests: r.length, total_transfer: r.reduce((s, e) => s + (e.transferSize || 0), 0), by_type: Object.entries(r.reduce((a, e) => { a[e.initiatorType] = (a[e.initiatorType] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]) }; })));
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

`NAV=` 是导航计时条目，`PAINT=` 是绘制条目（FCP 在这里），`LCP=` 是最大内容绘制的开始时间（若页面在 3 秒内没有发出 LCP 条目则为 `null`），`RESOURCES=` 是最慢的 15 个资源，`SCRIPTS=` / `CSS=` 是打包产物清单，`SUMMARY=` 是请求数、总传输量和按类型分组的请求数。缺少 `GSTACK_STEP_OK`，或出现以 `[error` 开头的行，说明页面没加载起来 — 记为失败，而不是慢页面。

从带标签的行里提取关键指标（除非另有说明，都用 `NAV=`）：
- **TTFB**（首字节时间）：`responseStart - requestStart`
- **FCP**（首次内容绘制）：`PAINT=` 里的 `first-contentful-paint` 条目
- **LCP**（最大内容绘制）：`LCP=` 行（若页面没有发出 LCP 条目则为 `null` — 记为缺失，不是 0）
- **DOM Interactive**：`domInteractive - startTime`
- **DOM Complete**：`domComplete - startTime`
- **Full Load**：`loadEventEnd - startTime`

加载时间会随网络抖动。用户想要稳定数字时，每个页面跑 3 次脚本，取每项指标的中位数。

### Phase 4: Baseline Capture (--baseline mode)

把指标保存到基线文件：

```json
{
  "url": "<url>",
  "timestamp": "<ISO>",
  "branch": "<branch>",
  "pages": {
    "/": {
      "ttfb_ms": 120,
      "fcp_ms": 450,
      "lcp_ms": 800,
      "dom_interactive_ms": 600,
      "dom_complete_ms": 1200,
      "full_load_ms": 1400,
      "total_requests": 42,
      "total_transfer_bytes": 1250000,
      "js_bundle_bytes": 450000,
      "css_bundle_bytes": 85000,
      "largest_resources": [
        {"name": "main.js", "size": 320000, "duration": 180},
        {"name": "vendor.js", "size": 130000, "duration": 90}
      ]
    }
  }
}
```

写入 `.gstack/benchmark-reports/baselines/baseline.json`。
同时在旁边保留一份不可变的 `{UTC-timestamp}-baseline.json` 供趋势分析使用。没有 `--baseline` 时，绝不覆盖用于对比的基线；当前指标改为在 Phase 9 保存。

### Phase 5: Comparison

如果基线存在，就把当前指标与它对比：
没有基线时，只报告绝对测量值和预算，把对比标记为不可用，并建议跑一次 `--baseline`。缺失的指标保持 N/A。基线为零时百分比变化为 N/A；绝对时间阈值仍然适用。

```
PERFORMANCE REPORT — [url]
══════════════════════════
Branch: [current-branch] vs baseline ([baseline-branch])

Page: /
─────────────────────────────────────────────────────
Metric              Baseline    Current     Delta    Status
────────            ────────    ───────     ─────    ──────
TTFB                120ms       135ms       +15ms    OK
FCP                 450ms       480ms       +30ms    OK
LCP                 800ms       1600ms      +800ms   REGRESSION
DOM Interactive     600ms       650ms       +50ms    OK
DOM Complete        1200ms      1350ms      +150ms   OK
Full Load           1400ms      2100ms      +700ms   REGRESSION
Total Requests      42          58          +16      WARNING
Transfer Size       1.2MB       1.8MB       +0.6MB   REGRESSION
JS Bundle           450KB       720KB       +270KB   REGRESSION
CSS Bundle          85KB        88KB        +3KB     OK

REGRESSIONS DETECTED: 4
  [1] LCP doubled (800ms → 1600ms) — likely a large new image or blocking resource
  [2] Total transfer +50% (1.2MB → 1.8MB) — check new JS bundles
  [3] JS bundle +60% (450KB → 720KB) — new dependency or missing tree-shaking
  [4] Full load +700ms (1400ms → 2100ms) — inspect the slowest resources
```

**回归阈值：**
- 计时指标：增加 >50% 或绝对值增加 >500ms = REGRESSION
- 计时指标：增加 >20% = WARNING
- 打包体积和总传输量：增加 >25% = REGRESSION
- 打包体积和总传输量：增加 >10% = WARNING
- 请求数：增加 >30% = WARNING（没有单独的回归阈值）
先判 REGRESSION 再判 WARNING；否则为 OK。负的增量是改善。

### Phase 6: Slowest Resources

```
TOP 10 SLOWEST RESOURCES
═════════════════════════
#   Resource                  Type      Size      Duration
1   vendor.chunk.js          script    320KB     480ms
2   main.js                  script    250KB     320ms
3   hero-image.webp          img       180KB     280ms
4   analytics.js             script    45KB      250ms    ← third-party
5   fonts/inter-var.woff2    font      95KB      180ms
...

RECOMMENDATIONS:
- vendor.chunk.js: Consider code-splitting — 320KB is large for initial load
- analytics.js: Load async/defer — blocks rendering for 250ms
- hero-image.webp: Add width/height to prevent CLS, consider lazy loading
```

### Phase 7: Performance Budget

对照业界预算检查：
对每项可用指标，达到或超过预算即 FAIL，处于 90% 到不足 100% 之间为 WARNING，其余为 PASS。缺失的指标为 N/A 并排除在外。按低于预算（PASS 或 WARNING）的比例评级：A = 全部，B = 至少三分之二，C = 至少一半，D = 不足一半，N/A = 一项都没测。

```
PERFORMANCE BUDGET CHECK
════════════════════════
Metric              Budget      Actual      Status
────────            ──────      ──────      ──────
FCP                 < 1.8s      0.48s       PASS
LCP                 < 2.5s      1.6s        PASS
Total JS            < 500KB     720KB       FAIL
Total CSS           < 100KB     88KB        PASS
Total Transfer      < 2MB       1.8MB       WARNING (90%)
HTTP Requests       < 50        58          FAIL

Grade: B (4/6 passing)
```

### Phase 8: Trend Analysis (--trend mode)

加载历史基线文件并展示趋势：

```
PERFORMANCE TRENDS (last 5 benchmarks)
══════════════════════════════════════
Date        FCP     LCP     Bundle    Requests    Grade
2026-03-10  420ms   750ms   380KB     38          A
2026-03-12  440ms   780ms   410KB     40          A
2026-03-14  450ms   800ms   450KB     42          A
2026-03-16  460ms   850ms   520KB     48          B
2026-03-18  480ms   1600ms  720KB     58          B

TREND: Performance degrading. LCP doubled in 8 days.
       JS bundle growing 50KB/week. Investigate.
```

### Phase 9: Save Report

写入 `.gstack/benchmark-reports/{date}-benchmark.md` 和 `.gstack/benchmark-reports/{date}-benchmark.json`。

## 重要规则

- **测量，不要猜。** 用真实的 performance.getEntries() 数据，不是估算。
- **基线是根本。** 没有基线，你能报告绝对数字，但发现不了回归。始终鼓励采集基线。
- **用相对阈值，不用绝对阈值。** 2000ms 的加载时间对复杂仪表盘没问题，对落地页糟透了。对照**你自己的**基线比较。
- **第三方脚本是上下文。** 标出它们，但用户没法让 Google Analytics 变快。建议要集中在第一方资源上。
- **打包体积是先行指标。** 加载时间随网络变化。打包体积是确定性的。要虔诚地跟踪它。
- **只读。** 产出报告。除非明确要求，不要修改代码。