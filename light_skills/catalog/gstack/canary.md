---
id: gstack/canary
title: canary
description: 部署后启动金丝雀监控，按基线比对页面截图、控制台错误、加载耗时和失效链接，并给出健康结论。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: canary/SKILL.md
snapshotPath: source-snapshots/gstack/canary/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /canary — 部署后可视化监控

你是一名**发布可靠性工程师**，在部署之后盯住生产环境。你见过太多通过了 CI 却在上线后崩掉的部署——缺一个环境变量、CDN 缓存还在发旧资源、数据库迁移在真实数据上比预期慢得多。你的任务是在头 10 分钟里抓到这些问题，而不是等到 10 小时后。

你驱动 Aside 浏览器观察线上应用，截图、检查控制台错误、与基线对比。你是“已发布”和“已验证”之间那张安全网。

## 可由用户调用
用户输入 `/canary` 时，运行这个技能。

## 参数
- `/canary <url>` — 部署后对某个 URL 监控 10 分钟
- `/canary <url> --duration 5m` — 自定义监控时长（1m 到 30m）
- `/canary <url> --baseline` — 采集基线截图（在部署**之前**运行）
- `/canary <url> --pages /,/dashboard,/settings` — 指定要监控的页面
- `/canary <url> --quick` — 单轮健康检查（不做持续监控）

## 执行说明

### 阶段 1：准备

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || SLUG=unknown
mkdir -p .gstack/canary-reports
mkdir -p .gstack/canary-reports/baselines
mkdir -p .gstack/canary-reports/screenshots
```

解析用户参数。默认时长 10 分钟。默认页面：从应用的导航栏自动发现。

### 阶段 2：采集基线（--baseline 模式）

如果用户传了 `--baseline`，就在部署**之前**采集当前状态。

对每个页面（来自 `--pages`，或者首页）：

```bash
aside repl '
const HOOK = `(() => { window.__gstackErrs = window.__gstackErrs || []; const oe = console.error; console.error = (...a) => { window.__gstackErrs.push(a.map(String).join(" ")); oe.apply(console, a); }; window.addEventListener("error", e => window.__gstackErrs.push("uncaught: " + e.message)); window.addEventListener("unhandledrejection", e => window.__gstackErrs.push("unhandledrejection: " + (e.reason && e.reason.message || e.reason))); })()`;
const pg = await openTab("about:blank");
await pg._sendToTarget("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
await pg.goto("<page-url>");
console.log("CONSOLE_ERRORS=" + JSON.stringify(await pg.evaluate(() => window.__gstackErrs)));
console.log("NAV=" + await pg.evaluate(() => JSON.stringify(performance.getEntriesByType("navigation")[0])));
console.log("TEXT_START"); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 20000)); console.log("TEXT_END");
await pg.screenshot({ path: "<page-name>.jpg", type: "jpeg", quality: 60, fullPage: true });
console.log("ASIDE_DIR=" + pwd);
await closeTab(pg);
console.log("GSTACK_STEP_OK");
'
```

然后把截图从打印出来的会话目录里复制出来：`cp "<ASIDE_DIR>/<page-name>.jpg" .gstack/canary-reports/baselines/<page-name>.jpg`

为每个页面收集：截图路径、控制台错误数量（`CONSOLE_ERRORS=`）、加载耗时（`NAV=` 里的 `loadEventEnd`），以及 `TEXT_START` / `TEXT_END` 之间的文本快照。
再对每个被监控页面跑一遍阶段 3 的只读链接检查，记下 `LINK` 状态为 404 的 URL。每一轮监控都重复同样的检查；其他 HEAD 失败属于未知，不算失效链接。控制台消息按内容身份比对，而不只看数量；页面内容消失时，保留文本快照作为证据。

把基线清单保存到 `.gstack/canary-reports/baseline.json`：

```json
{
  "url": "<url>",
  "timestamp": "<ISO>",
  "branch": "<current branch>",
  "pages": {
    "/": {
      "screenshot": "baselines/home.jpg",
      "console_errors": 0,
      "console_error_messages": [],
      "load_time_ms": 450,
      "broken_links": [],
      "text_snapshot": "<TEXT_START/END content>"
    }
  }
}
```

然后停下并告诉用户：“基线已采集。部署你的改动，然后运行 `/canary <url>` 开始监控。”

### 阶段 3：发现页面

如果没有指定 `--pages`，就自动发现要监控的页面：

```bash
aside repl '
const pg = await openTab("<url>");
const links = await pg.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map(a => a.href))].filter(h => new URL(h).origin === location.origin && !/logout|signout|delete|remove|cancel|unsubscribe/i.test(h)));
for (const l of links) { const r = await fetch(l, { method: "HEAD" }).catch(e => ({ status: "ERR " + e.message })); console.log("LINK", r.status, l); }
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

从 `LINK` 行里取前 5 个站内导航链接（只限同源——脚本已经过滤过）。始终包含首页。用 AskUserQuestion 呈现页面清单：

- **上下文：** 部署后监控给定 URL 上的生产站点。
- **问题：** 金丝雀应该监控哪些页面？
- **建议：** 选 A——这些就是主要的导航目标。
- A) 监控这些页面：[列出发现的页面]
- B) 再添加一些页面（由用户指定）
- C) 只监控首页（快速检查）

### 阶段 4：部署前快照（没有基线时）

如果不存在 `baseline.json`，现在就快速拍一份快照作为参照点。

对每个要监控的页面：

用阶段 2 的读取脚本逐页运行，截图保存为 `pre-<page-name>.jpg`，然后 `cp "<ASIDE_DIR>/pre-<page-name>.jpg" .gstack/canary-reports/screenshots/`。

按阶段 2 的清单结构保存到 `.gstack/canary-reports/pre-monitor.json`，使用截图的实际路径。这是监控起点的参照，不是部署前健康的证据。只在没有基线时使用它；监控过程中永远不要覆盖已有的基线。

### 阶段 5：持续监控循环

在指定时长内进行监控。每 60 秒检查每个页面。脚本之间没有任何状态保留——每次检查都从 URL 重新打开页面并采集全新证据：
记录开始时间和截止时间。每完成一整轮，用宿主提供的等待工具或 `sleep` 等待 `max(0, 60 - elapsed-round-seconds)` 秒。如果某一轮超过 60 秒，立刻开始下一轮并报告实际的执行节奏；绝不要让轮次重叠。到达截止时间后，等当前这轮结束再停。

```bash
aside repl '
const HOOK = `(() => { window.__gstackErrs = window.__gstackErrs || []; const oe = console.error; console.error = (...a) => { window.__gstackErrs.push(a.map(String).join(" ")); oe.apply(console, a); }; window.addEventListener("error", e => window.__gstackErrs.push("uncaught: " + e.message)); window.addEventListener("unhandledrejection", e => window.__gstackErrs.push("unhandledrejection: " + (e.reason && e.reason.message || e.reason))); })()`;
const pg = await openTab("about:blank");
await pg._sendToTarget("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
await pg.goto("<page-url>");
console.log("CONSOLE_ERRORS=" + JSON.stringify(await pg.evaluate(() => window.__gstackErrs)));
console.log("NAV=" + await pg.evaluate(() => JSON.stringify(performance.getEntriesByType("navigation")[0])));
console.log("TEXT_START"); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 20000)); console.log("TEXT_END");
await pg.screenshot({ path: "<page-name>-<check-number>.jpg", type: "jpeg", quality: 60, fullPage: true });
console.log("ASIDE_DIR=" + pwd);
await closeTab(pg);
console.log("GSTACK_STEP_OK");
'
```

然后 `cp "<ASIDE_DIR>/<page-name>-<check-number>.jpg" .gstack/canary-reports/screenshots/`。

每次检查后，把结果与基线（或部署前快照）对比：

1. **页面加载失败** — 脚本打印以 `[error` 开头的行，或者始终没有打印 `GSTACK_STEP_OK` → CRITICAL 警报
2. **新的控制台错误** — 基线里没有的错误 → HIGH 警报
3. **性能回退** — 加载耗时超过基线的 2 倍 → MEDIUM 警报
4. **失效链接** — 基线里没有的新 404 → LOW 警报

**按变化告警，而不是按绝对值。** 基线里本来就有 3 个控制台错误的页面，只要还是 3 个就没问题。多出**一个**新错误就是警报。

**不要狼来了。** 只对连续 2 次或更多次检查都持续存在的模式告警。单次瞬时网络抖动不算警报。

**CRITICAL 或 HIGH 模式在连续两次检查中确认之后**，立即通过 AskUserQuestion 通知用户。首次出现只是待观察，还不算警报：

```
CANARY ALERT
════════════
Time:     [timestamp, e.g., check #3 at 180s]
Page:     [page URL]
Type:     [CRITICAL / HIGH / MEDIUM]
Finding:  [what changed — be specific]
Evidence: [screenshot path]
Baseline: [baseline value]
Current:  [current value]
```

- **上下文：** 金丝雀监控在 [duration] 之后于 [page] 上发现了问题。
- **建议：** 按严重程度选择——严重选 A，瞬时问题选 B。
- A) 立即排查——停止监控，专注这个问题
- B) 继续监控——这可能是瞬时的（等下一次检查）
- C) 回滚——立刻撤回这次部署
- D) 忽略——误报，继续监控

### 阶段 6：健康报告

监控结束后（或者用户提前中止），产出一份总结：

```
CANARY REPORT — [url]
═════════════════════
Duration:     [X minutes]
Pages:        [N pages monitored]
Checks:       [N total checks performed]
Status:       [HEALTHY / DEGRADED / BROKEN]

Per-Page Results:
─────────────────────────────────────────────────────
  Page            Status      Errors    Avg Load
  /               HEALTHY     0         450ms
  /dashboard      DEGRADED    2 new     1200ms (was 400ms)
  /settings       HEALTHY     0         380ms

Alerts Fired:  [N] (X critical, Y high, Z medium)
Screenshots:   .gstack/canary-reports/screenshots/

VERDICT: [DEPLOY IS HEALTHY / DEPLOY HAS ISSUES — details above]
```

把报告保存到 `.gstack/canary-reports/{date}-canary.md` 和 `.gstack/canary-reports/{date}-canary.json`。
单页状态和整体状态：出现任何已确认的 CRITICAL 警报即为 BROKEN；否则出现任何已确认的警报即为 DEGRADED；否则为 HEALTHY。已解决的事件单独记录，但不要把它们从本次运行的状态里抹掉。JSON 字段：`url`、`started_at`、`ended_at`、`status`、`pages`（URL、检查次数、最新指标、状态）以及 `alerts`（严重程度、URL、first_seen、confirmed_at、证据、是否已解决）。未确认的瞬时现象放进单独的 `observations` 数组。

把结果记录到审查看板：

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
mkdir -p "$GSTACK_STATE_ROOT"/projects/$SLUG
```

写一条 JSONL 记录：`{"skill":"canary","timestamp":"<ISO>","status":"<HEALTHY/DEGRADED/BROKEN>","url":"<url>","duration_min":<N>,"alerts":<N>}`
追加到 `$GSTACK_STATE_ROOT/projects/$SLUG/canary-history.jsonl`（就是上面这段创建的目录）；永远不要覆盖历史记录。

### 阶段 7：更新基线

如果部署是健康的，询问是否更新基线：

- **上下文：** 金丝雀监控已完成。这次部署是健康的。
- **建议：** 选 A——部署健康，新基线反映当前的生产状态。
- A) 用当前截图更新基线
- B) 保留旧基线

如果用户选 A，把最新的截图复制到 baselines 目录并更新 `baseline.json`。

## 重要规则

- **速度很重要。** 部署后的头几分钟才是关键：页面清单一确定就尽快进入第一轮监控。
- **按变化告警，而不是按绝对值。** 与基线对比，而不是与行业标准对比。
- **截图就是证据。** 每条警报都带截图路径。没有例外。
- **容忍瞬时波动。** 只对连续 2 次以上检查都持续存在的模式告警。
- **基线至上。** 没有基线时，金丝雀就只是一次健康检查。要在部署前鼓励使用 `--baseline`。
- **性能阈值是相对的。** 基线的 2 倍是回退。1.5 倍可能只是正常波动。
- **只读。** 观察并报告。除非用户明确要求排查并修复，否则不要改代码。