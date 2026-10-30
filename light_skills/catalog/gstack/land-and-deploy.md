---
id: gstack/land-and-deploy
title: land-and-deploy
description: 接手 /ship 产出的 PR，通过就绪门禁后合并，监控部署并以金丝雀验证生产，最后给出带证据的落地报告。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: land-and-deploy/SKILL.md
snapshotPath: source-snapshots/gstack/land-and-deploy/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /land-and-deploy — 合并、部署、验证

作为**发布工程师（Release Engineer）**，接手 `/ship` 创建的 PR：检查就绪状态、带批准合并、监控部署、验证生产，并报告证据。

## 可由用户调用
当用户输入 `/land-and-deploy` 时，运行这个技能。

## 参数
- `/land-and-deploy` — 从当前分支自动检测 PR，不指定部署后 URL
- `/land-and-deploy <url>` — 自动检测 PR，并在该 URL 上验证部署
- `/land-and-deploy #123` — 指定 PR 编号
- `/land-and-deploy #123 <url>` — 指定 PR，并给出验证 URL

## 自动化与批准

自动执行只读检测和轮询。适用时，首次运行的设置确认（步骤 1.5）和
合并前批准（步骤 3.5）是强制的。遇到访问缺失、目标/状态未知、未批准的红灯、
CI 挂起或缺失、冲突、测试失败，一律停止。
出现任何合并错误之后，先读服务器状态，再决定是否停止。
失败、超时、staging 选择、回滚和可选清理走下面这些显式决策；任何批准都不能
覆盖阻塞项，也不能授权换一个修订版本。

## 语气与叙述

叙述进度，说清实际的 app/PR，并在提问之前解释利害。
首次运行：讲解每项检查做什么。已确认的运行：简短的状态更新。

---

## 分节索引 — 遇到对应情形时读取该节

这个技能是一副决策树骨架。下面的步骤指向按需读取的分节。执行某一步之前要
先把对应分节完整读完，不要凭记忆操作。

| 何时 | 读这一节 |
|------|-------------------|
| 运行首次演练校验 — 步骤 1.5 的检查返回 FIRST_RUN 或 CONFIG_CHANGED（CONFIRMED 时跳过） | `sections/first-run-validation.md` |
| 合并前就绪门禁（步骤 3.5）— 不可逆合并之前的最后一道检查 | `sections/readiness-gate.md` |
| 合并 PR 并检测部署策略（步骤 4-5） | `sections/merge-and-deploy.md` |

---

## 步骤 1：起飞前检查

告诉用户：“正在检查访问权限并找到你的 PR。”

1. 检查 GitHub CLI 认证：
```bash
gh auth status
```
如果未认证，**停止**；请用户运行 `gh auth login`，然后重试。

2. 把任何 URL 存为 `VERIFY_URL`（一次显式验证请求）。把 `PR_NUMBER`
设为 `#NNN` 参数里的数字，或者从当前分支检测一次：
```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner) || exit 1
if [ -z "$PR_NUMBER" ]; then
  PR_NUMBER=$(gh pr view --repo "$REPO" --json number -q .number) || exit 1
fi
PR_JSON=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json number,state,title,url,mergeable,baseRefName,headRefName,headRefOid,baseRefOid) || exit 1
PR_HEAD=$(printf '%s' "$PR_JSON" | jq -er .headRefOid) || exit 1
HEAD_BRANCH=$(printf '%s' "$PR_JSON" | jq -er .headRefName) || exit 1
BASE_BRANCH=$(printf '%s' "$PR_JSON" | jq -er .baseRefName) || exit 1
```
把这些值带过每一个新的 shell。之后每条命令都针对这个仓库和这个 PR，
绝不再依赖隐式的当前分支检测。查询失败意味着未知，而不是空 PR。
告诉用户选中的编号、标题、head → base 以及 head SHA。

3. 没有 PR：**停止**，建议 `/ship`。CLOSED：**停止**，请对方重新打开。MERGED：
**停止**，建议 `/canary <url>`；不要再次合并，也不要声称发生过部署。
只有 OPEN 才继续。在使用任何基于 HEAD 的证据之前，要求对应的干净检出：
```bash
LOCAL_HEAD=$(git rev-parse HEAD) || exit 1
LOCAL_BRANCH=$(git branch --show-current) || exit 1
LOCAL_STATUS=$(git status --porcelain) || exit 1
if [ "$LOCAL_HEAD" != "$PR_HEAD" ] || [ "$LOCAL_BRANCH" != "$HEAD_BRANCH" ] || [ -n "$LOCAL_STATUS" ]; then
  echo "LOCAL_TARGET_MISMATCH"
  exit 1
fi
git fetch "https://github.com/$REPO.git" "$BASE_BRANCH" || exit 1
BASE_SHA=$(git rev-parse FETCH_HEAD) || exit 1
SCOPE_RESULT=$(~/.claude/skills/gstack/bin/gstack-diff-scope "$BASE_SHA") || exit 1
eval "$SCOPE_RESULT"
```
不匹配时**停止**，请用户保存工作、检出/更新该 PR
分支，然后重跑。不要替他们切换、重置或暂存。合并之前保留 `BASE_SHA`、PR 的
提交列表和所有范围标记；清理之后 HEAD 可能改变。
未知范围不等于仅文档。`DOCS_ONLY=true` 要求 SCOPE_DOCS 且没有其他范围。

---

## 步骤 1.5：首次运行的演练校验

检查此前是否有设置确认，以及配置是否变化（这不是部署成功的证据）：

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
if [ ! -f "$GSTACK_STATE_ROOT"/projects/$SLUG/land-deploy-confirmed ]; then
  echo "FIRST_RUN"
else
  # 检查部署配置自确认以来是否变化
  SAVED_HASH=$(cat "$GSTACK_STATE_ROOT"/projects/$SLUG/land-deploy-confirmed 2>/dev/null)
  CURRENT_HASH=$(sed -n '/## Deploy Configuration/,/^## /p' CLAUDE.md 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
  # 同时哈希会影响部署行为的工作流文件
  WORKFLOW_HASH=$(find .github/workflows -maxdepth 1 \( -name '*deploy*' -o -name '*cd*' \) 2>/dev/null | xargs cat 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
  COMBINED_HASH="${CURRENT_HASH}-${WORKFLOW_HASH}"
  if [ "$SAVED_HASH" != "$COMBINED_HASH" ] && [ -n "$SAVED_HASH" ]; then
    echo "CONFIG_CHANGED"
  else
    echo "CONFIRMED"
  fi
fi
```

**如果 CONFIRMED：** 说“设置此前已确认。”转到步骤 2；不要读演练分节。

**如果 FIRST_RUN 或 CONFIG_CHANGED：** 读取并执行演练分节：

> **停止。** 在运行首次演练校验之前 — 步骤 1.5 的检查返回 FIRST_RUN 或 CONFIG_CHANGED（CONFIRMED 时跳过），读取 `~/.claude/skills/gstack/land-and-deploy/sections/first-run-validation.md` 并整体执行它。
> 不要凭记忆操作 — 那一节才是这一步的事实源。

选项 A 保存指纹并继续到步骤 2；B/C 停止。

---

## 步骤 2：合并前检查

告诉用户：“正在检查 CI 状态和合并就绪情况……”

```bash
~/.claude/skills/gstack/bin/gstack-ci-gate --repo "$REPO" --pr "$PR_NUMBER" --expect-head "$PR_HEAD" --registration-wait 60
```

它以这个 head 上的全部检查作为门禁条件，无论是否必需。依据第一行
`VERDICT <verdict> <sha>`（`<sha>` 必须是 `PR_HEAD`）行动，绝不要依据退出码。
认证/网络/schema 错误属于 ERROR，绝不是“没有必需检查”。
1. ERROR，或 `required=y|?` 的检查 FAIL：**停止**，展示输出。
2. 只有 `required=n` 的失败，或 NO_CHECKS（60 秒后重新轮询仍显示
   “no CI ran on `<sha>`”）：步骤 3.5 必须批准它。
3. PENDING：步骤 3。PASS：跳过步骤 3 的等待；
   继续到步骤 3.4，然后合并之前进步骤 3.5。

同时检查合并冲突：
```bash
gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeable -q .mergeable
```
如果 `CONFLICTING`：**停止**，先解决冲突。读取失败/UNKNOWN：**停止**，
就绪状态未建立。

---

## 步骤 3：等待 CI（若挂起）

按 4 分钟一轮轮询（shell 超时 300 秒），最多 15 分钟；记录等待情况：

```bash
~/.claude/skills/gstack/bin/gstack-ci-gate --repo "$REPO" --pr "$PR_NUMBER" --expect-head "$PR_HEAD" --wait 240
```

其他判定按步骤 2 处理。15 分钟仍 PENDING：列出仍在挂起的检查；
询问 A) 再等 15 分钟，B) 排除指名的 `required=n` 检查（步骤 3.5
逐项批准），或 C) 停止。

---

## 步骤 3.4：VERSION 漂移检测（工作区感知的 ship）

```bash
BRANCH_VERSION=$(git show "$PR_HEAD:VERSION" 2>/dev/null | tr -d '\r\n[:space:]')
BASE_VERSION=$(git show "$BASE_SHA:VERSION" 2>/dev/null | tr -d '\r\n[:space:]')
git fetch -q origin "$BASE_BRANCH"
read -r MODE CL < <(~/.claude/skills/gstack/bin/gstack-ship-policy show-effective --base "$BASE_BRANCH" --json |
  jq -r 'select(.valid).policy | "\(.queue_mode) \(.changelog)"')
Q=$(bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-next-version --base "$BASE_BRANCH" \
  --exclude-pr "$PR_NUMBER" --bump patch --current-version "$BASE_VERSION" 2>/dev/null || echo '{"offline":true}')
Q=$(echo "$Q" | jq -r --arg v "$BRANCH_VERSION" '[.claimed[]? | select(.version == $v).pr] as $c | if .no_version
  then "NO_VERSION" elif $c != [] then "STOP also claimed by #\($c[0])" elif .offline or (.complete | not)
  then "unavailable: claims unread" else "ok" end')
cl() { sed -n 's/^## \[\([^]]*\)\].*/\1/p' | head -2 | xargs; }
H=$(git show "$PR_HEAD:$CL" 2>/dev/null | cl); B=$(git show "$BASE_SHA:$CL" 2>/dev/null | cl)
V=$(awk -v a="$BASE_VERSION" -v b="$BRANCH_VERSION" 'BEGIN { r = "^[0-9]+[.][0-9]+[.][0-9]+([.][0-9]+)?$"
  if (a !~ r || b !~ r || split(a, x, ".") != (n = split(b, y, "."))) { print "bad"; exit }
  for (i = 1; i <= n && x[i] == y[i]; i++); if (i > n || y[i] < x[i]) { print "low"; exit }
  s = y[i] == x[i] + 1; for (j = i + 1; j <= n; j++) s = s && !y[j]; print s ? "one" : "up" }')
if [ "$Q" = NO_VERSION ]; then R=$Q
elif [ "$V" = bad ]; then R="unavailable: bad version"
elif [ "$MODE" = stamp-at-merge ]; then
  [ "$V" = one ] && { [ -z "$H" ] || [ "$H" = "$(echo $BRANCH_VERSION ${B%% *})" ]; } && R=ok || R="STOP stamp stale"
elif [ "$V" = low ]; then R="STOP base is at or above it"
elif [ -z "$MODE" ]; then R="unavailable: no policy"
else R=$Q; fi
echo "VERSION_CHECK: $R ($MODE: $BRANCH_VERSION, base $BASE_VERSION)"
```

- `NO_VERSION`：打印 `VERSION check: not applicable (<version_source.reason>)`；绝不
  期待带版本前缀的标题、CHANGELOG 版本头或 tag。
- `unavailable`：如实报告；继续到步骤 3.5（CI 的版本门禁是兜底）。
- `ok`：继续；更高的同级声明或 MICRO 升版不算漂移。
- `STOP stamp stale`（stamp-at-merge：不是 base 加一次升版，或者顶部 CHANGELOG 标题
  不是它、接着才是 base 的）：**停止**；在 PR 分支上运行 `gstack-restamp --next --base
  <base> --pr <n> --expect-base <BASE_SHA> --allow-repo-commands`，推送这个 stamp diff，
  等 CI，然后重跑。
- 其他 `STOP`：**停止**，说明“检测到 VERSION 漂移”、判定结果，并：从功能分支
  重跑 `/ship`（它的 ALREADY_BUMPED 路径会协调 VERSION、package.json、
  CHANGELOG 头和 PR 标题）。绝不在此自动升版或合并：重复版本可能
  覆盖另一个分支的发布说明。

---

> **停止。** 在合并前就绪门禁（步骤 3.5）之前 — 不可逆合并之前的最后一道检查，读取 `~/.claude/skills/gstack/land-and-deploy/sections/readiness-gate.md` 并整体执行它。
> 不要凭记忆操作 — 那一节才是这一步的事实源。

---

> **停止。** 在合并 PR 并检测部署策略（步骤 4-5）之前，读取 `~/.claude/skills/gstack/land-and-deploy/sections/merge-and-deploy.md` 并整体执行它。
> 不要凭记忆操作 — 那一节才是这一步的事实源。

---

## 步骤 6：等待部署（若适用）

除非是为回滚而来，否则设置 `TARGET=production` 和 `DEPLOY_SHA=MERGE_SHA`。使用
步骤 3.5/5 得到的部署事实；把状态和金丝雀健康分开保存。仅仅 URL 可访问，
不能证明这个修订版本已经部署。没有配置触发器时：不要自己发明一个。

### 策略 A：GitHub Actions 工作流

如果检测到部署工作流，找出由该合并提交触发的那次运行：

```bash
gh run list --repo "$REPO" --branch "$BASE_BRANCH" --limit 10 --json databaseId,headSha,status,conclusion,name,workflowName
```

匹配 `DEPLOY_SHA`、工作流和目标环境。如果还没有出现运行记录，在同一个
20 分钟期限内重复查询。另一个 SHA 上的同名匹配不是证据。

每 30 秒轮询一次：
```bash
gh run view <run-id> --repo "$REPO" --json status,conclusion
```

### 策略 B：平台 CLI（Fly.io、Render、Heroku）

如果 CLAUDE.md 里配置了部署状态命令（例如 `fly status --app myapp`），用它代替
GitHub Actions 轮询，或与之并用。

**Fly.io：** 检查配置的 app（不要执行 `fly deploy`）：
```bash
fly status --app {app} 2>/dev/null
```
找已启动的 Machine，以及绑定到 `DEPLOY_SHA` 的一次 release；只看时间是
不能作为证据的。

**Render：** 查看它针对所连接分支/修订版本的 release 记录，然后测可达性：
```bash
curl -sf {production-url} -o /dev/null -w "%{http_code}" 2>/dev/null
```
每 30 秒轮询一次。HTTP 200 只能证明可达，不能证明线上跑的是哪个 release。

**Heroku：** 查看最新 release：
```bash
heroku releases --app {app} -n 1 2>/dev/null
```

### 策略 C：自动部署平台（Vercel、Netlify）

当配置为在这次合并时自动部署，等 60 秒，检查 `DEPLOY_SHA` 对应的部署记录，
然后进步骤 7。没有记录意味着部署未验证，而不是成功。

### 策略 D：自定义部署钩子

只运行配置好的只读状态命令。检查它的退出码和修订版本输出；通用的健康检查
无法证明一次新部署。

已记录的命令触发器按步骤 5 的路线 2 执行：它从默认分支的检出目录运行，由用户
执行，或者在你获得用户显式批准后由你执行。退出码为零或 URL 可访问，本身都不是
修订版本的证据。

### 共同部分：计时与失败处理

记录部署开始时间。每 2 分钟展示一次进度：“部署仍在进行……（已过 {X} 分钟）。
对大多数平台来说这很正常。”

匹配的修订版本成功部署：记录 `DEPLOY_STATUS=PASSED`、耗时
和证据。继续到步骤 7；若没有可用 URL，则进步骤 5 的 URL 提问。

如果部署失败/取消：记录 `DEPLOY_STATUS=FAILED`，然后使用 AskUserQuestion：
- **重述背景：**“合并之后部署工作流失败了。代码已合并，但可能还没上线。我能做的是：”
- **建议：** 选 A，先调查再决定是否回退。
- A) 让我看看部署日志，弄清哪里出了问题
- B) 立即回退这次合并 — 回到上一个版本
- C) 仍然继续做健康检查 — 部署失败可能只是某一步抖动，站点也许实际上是好的

**A：** 读 `gh run view <run-id> --repo "$REPO" --log-failed`（或配置的平台
日志），总结原因和证据的局限，然后询问：回退（步骤 8）、检查健康（步骤 7），
还是以未验证状态收尾（步骤 9）。不做自动代码修改，也不自动重新部署。
**B：** 步骤 8。**C：** 有 URL 就进步骤 7，否则进步骤 5 的 URL 提问。金丝雀通过
永远不能抹掉 FAILED 的部署证据。

到 20 分钟时（包括等待运行记录出现的时间），询问：**A)** 再有限地等
20 分钟，**B)** 不做验证直接收尾。A 只重置等待期限并恢复同一套查询/轮询；
B 记录部署挂起/未知并进步骤 9。
状态查询失败属于未知：展示错误，并给出同样的有限等待或收尾选择，
不要编造成功。在回滚监控期间，失败只提供看日志或挂起报告，绝不第二次自动回退。

---

## 步骤 7：金丝雀验证（按需调整深度）

告诉用户确认或未确认的是哪个目标/修订版本，然后检查它的 URL。
如果浏览器不可用，记录 SKIPPED 并写明该目标的原因。
staging 选项 A 回到它的生产路线；C 直接进步骤 9，且不声称
STAGING VERIFIED。生产则带着不完整的健康证据进步骤 9。

使用此前保存的合并前范围，以及步骤 5 的优先级规则；URL/触发式部署路径
同样要验证仅文档改动。除非是从 staging 选项 A/C 进入，否则设置 `TARGET=production`。

| 差异范围 | 金丝雀深度 |
|------------|-------------|
| 仅 SCOPE_DOCS | 步骤 5 路由到这里时做冒烟检查；否则在那边跳过 |
| 仅 SCOPE_CONFIG | 冒烟：下面这个 Aside 脚本；`NAV=` 里的 `responseStatus` 必须是 200 |
| 仅 SCOPE_BACKEND | 控制台错误 + 性能检查 |
| SCOPE_FRONTEND（任意） | 完整：控制台 + 性能 + 截图 |
| 混合范围 | 完整金丝雀 |

**完整金丝雀序列** — 一个 `aside repl` 脚本做完整个检查（先挂控制台钩子，再加载，再取证据）：

```bash
aside repl '
const HOOK = `(() => { window.__gstackErrs = window.__gstackErrs || []; const oe = console.error; console.error = (...a) => { window.__gstackErrs.push(a.map(String).join(" ")); oe.apply(console, a); }; window.addEventListener("error", e => window.__gstackErrs.push("uncaught: " + e.message)); window.addEventListener("unhandledrejection", e => window.__gstackErrs.push("unhandledrejection: " + (e.reason && e.reason.message || e.reason))); })()`;
const pg = await openTab("about:blank");
await pg._sendToTarget("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
await pg.goto("<url>");
console.log("URL=" + pg.url());
console.log("CONSOLE_ERRORS=" + JSON.stringify(await pg.evaluate(() => window.__gstackErrs)));
console.log("NAV=" + await pg.evaluate(() => JSON.stringify(performance.getEntriesByType("navigation")[0])));
console.log("TEXT_START"); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 20000)); console.log("TEXT_END");
await pg.screenshot({ path: "post-deploy.jpg", type: "jpeg", quality: 60, fullPage: true });
const a = await annotatedScreenshot(pg);
await fs.writeFile(path.join(pwd, "post-deploy-annotated.png"), Buffer.from(a.base64Image, "base64"));
console.log("ASIDE_DIR=" + pwd);
await closeTab(pg);
console.log("GSTACK_STEP_OK");
'
```

然后把证据从打印出来的会话目录里复制出来：

```bash
mkdir -p .gstack/deploy-reports && cp "<ASIDE_DIR>/post-deploy.jpg" "<ASIDE_DIR>/post-deploy-annotated.png" .gstack/deploy-reports/
```

逐行读输出：

- `URL=` — 页面加载成功并留在站点上（不是跳转到错误页）。以 `[error` 开头的行，
  或者缺少 `GSTACK_STEP_OK`，都表示加载失败。
- `CONSOLE_ERRORS=` — 检查关键错误：包含 `Error`、`Uncaught`、`Failed to load`、`TypeError`、`ReferenceError` 的条目。忽略警告。
- `NAV=` — `responseStatus` 是文档的 HTTP 状态（Chromium PerformanceNavigationTiming）— 必须是 200。`loadEventEnd` 是页面加载耗时。检查它低于 10 秒。
- `TEXT_START` / `TEXT_END` — 核实页面有真实内容（不是空白，也不是通用错误页）。
- `post-deploy.jpg` 和带标注的 `post-deploy-annotated.png` 是证据。读取复制出来的截图，让用户直接看到它。

**健康评估：**
- 页面加载成功且状态为 200（`NAV=` 里的 `responseStatus`）→ PASS
- 没有关键控制台错误 → PASS
- 页面有真实内容（不是空白或错误屏）→ PASS
- 加载耗时低于 10 秒 → PASS

只评估所选深度要求的检查项；未执行的检查标记为 N/A。
所有必需检查通过：为该目标记录 HEALTHY。staging 按前面
步骤 5a 选定的 A/C 路线返回；生产进步骤 9。保留部署的不确定性。

如果任何一项失败：展示证据（截图路径、控制台错误、性能数字）。使用 AskUserQuestion：
- **重述背景：**“部署之后我在线上站点上发现了些问题。我看到的是：{具体问题}。这可能是临时的（缓存清理、CDN 传播），也可能真的是问题。”
- **建议：** 按严重程度选 — 严重（站点挂了）选 B，轻微（控制台错误）选 A。
- A) 暂时接受这些已观察到的问题 — 报告 DEGRADED，而不是健康
- B) 确实坏了 — 回退这次合并，回到上一个版本
- C) 让我再查一查 — 打开站点看日志，再决定

**A：** 记录 DEGRADED 和用户的确认，然后进步骤 9（不要悄悄从失败的 staging
继续做生产验证）。**B：** 步骤 8，且必须获得显式回滚批准。**C：** 检查页面/证据
和只读日志；总结发现，然后询问再做一次复查（重复步骤 7）、回滚（步骤 8），
还是以 DEGRADED 收尾（步骤 9）。这些调查绝不修改代码或重新部署。
当 `ROLLBACK=true` 时，失败保持为 ROLLBACK PENDING；只提供调查或报告，
不要再提供一次回退。同时检查 staging 和生产时，两者的截图要分开保存。

---

## 步骤 8：回滚（如需要）

只在用户显式选择回滚之后进入。说明这会追加反向提交；在回滚部署完成并通过
健康检查之前，生产并未恢复。
要求工作区干净，从 `REPO` 拉取 `BASE_BRANCH`，切到本地 base
并只快进到刚拉取的 tip。base 脏、已分叉或被占用：**停止**
并置为 ROLLBACK PENDING，绝不 reset/force 或丢弃工作。

检查实际落地的提交，而不只看请求的合并方式：
```bash
git show --no-patch --format='%H %P' "$MERGE_SHA"
```
- 两个父提交：确认父 1 是 base 侧历史，然后
  `git revert -m 1 "$MERGE_SHA" --no-edit`。
- 单父提交且**确认为 squash**：`git revert "$MERGE_SHA" --no-edit`。
- **Rebase 合并：** 确定这个 PR 实际落地的精确提交范围，并按从新到旧
  回退。单独的 `mergeCommit.oid` 只是最后一个提交，不是整个范围。
  范围/方式未知（包括外部合并），或其他父提交形态：**停止**
  并置为 ROLLBACK PENDING，请求人工回滚；不要猜。

冲突：停下，展示 `git status` 和尝试过的命令，把解决交给
用户。干净回退之后，记录 `REVERT_SHA` 并推送到选定的 base：
`git push "https://github.com/$REPO.git" "HEAD:refs/heads/$BASE_BRANCH"`。如果分支
保护拒绝了推送，保留这个提交，在那里创建 `revert/pr-<number>-<timestamp>`，
推送该分支，并针对 `BASE_BRANCH` 开一个回滚 PR。报告它的 URL 和
ROLLBACK PENDING；没有单独批准绝不合并它。其他推送错误以错误和挂起状态
停止，不要绕过保护。

成功推送 base 之后，设置 `ROLLBACK=true`、`TARGET=production`、
`DEPLOY_SHA=REVERT_SHA`，并把该修订版本的生产部署/健康重置为 UNKNOWN/SKIPPED。
原始/staging 证据分开保存。按步骤 6-7 监控，期间不要重置这些值。只有确认了回滚
部署并且生产金丝雀健康，才可以给出 REVERTED（在不需要部署的情况下，确认 base
上的回退也算）。所有不完整、失败、跳过或基于 PR 的回滚路径都
进步骤 9 并置为 ROLLBACK PENDING。在报告里保留原始合并 SHA。

---

## 步骤 9：部署报告

选择第一条匹配的判定；绝不要从合并或 HTTP 200 推断部署成功：

| 证据 | 判定 |
|----------|---------|
| 已请求回滚，但尚未在 base 上确认，也未在线上验证健康（适用部署时） | ROLLBACK PENDING |
| 按步骤 8 确认了回滚 | REVERTED |
| 任何被接受的目标健康失败 | DEGRADED |
| 用户选择仅 staging 且 staging 通过 | STAGING VERIFIED — PRODUCTION UNVERIFIED |
| 显式的无需部署确认，或步骤 5 的仅文档跳过 | MERGED — NO DEPLOY NEEDED |
| 匹配的生产部署 PASSED 且生产 HEALTHY | DEPLOYED AND VERIFIED |
| 匹配的生产部署 PASSED，但金丝雀被跳过/不可用 | DEPLOYED (UNVERIFIED) |
| 其他一切情况，包括部署失败/挂起/未知，即使旧站点仍然健康 | MERGED (UNVERIFIED) |

展示 **LAND & DEPLOY REPORT** 并保存 `.gstack/deploy-reports/{date}-pr{number}-deploy.md`
（`date` = UTC 的 YYYY-MM-DD）。内容包括 PR/标题/仓库、head → base、已批准的 head、
合并时间戳/SHA/方式/路径、首次运行状态、CI/审查状态和警告、
范围、分别列出的部署/staging/金丝雀结果及其证据链接/错误、控制台
数量、加载耗时、截图路径（未检查时为 N/A）、判定和下一步动作。
用秒记录演练、CI 等待、排队、部署、staging、金丝雀和总耗时；
跳过的阶段耗时为 0 并写明原因，绝不编造通过。内联审查记作
passed/skipped/not-needed；合并前停下的内联修复不能出现在这里。
回滚要包含 revert SHA 或 PR URL，以及未完成的工作。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p .gstack/deploy-reports
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
mkdir -p "$GSTACK_STATE_ROOT"/projects/$SLUG
```

向 `~/.claude/skills/gstack/bin/gstack-review-log '<JSON>'` 传一条 JSON 条目，
写入仪表盘的按分支 JSONL 日志。只有 DEPLOYED AND VERIFIED 或
MERGED — NO DEPLOY NEEDED 时 `status` 才是 SUCCESS；确认回滚时为 REVERTED，
其他情况为 INCOMPLETE。保留完整的 `verdict` 和各自独立的证据状态：
```json
{"skill":"land-and-deploy","timestamp":"<ISO>","status":"<SUCCESS/REVERTED/INCOMPLETE>","verdict":"<verdict>","pr":<number>,"merge_sha":"<sha>","merge_path":"<auto/direct/queue/external>","first_run":<true/false>,"deploy_status":"<PASSED/FAILED/PENDING/UNKNOWN/NOT_NEEDED>","verification":"<HEALTHY/DEGRADED/SKIPPED>","staging_status":"<VERIFIED/DEGRADED/SKIPPED/N/A>","review_status":"<observed status>","dry_run_s":<N>,"ci_wait_s":<N>,"queue_s":<N>,"deploy_s":<N>,"staging_s":<N>,"canary_s":<N>,"total_s":<N>}
```

---

## 步骤 10：建议后续动作

用平实的语言说明判定。已验证：改动已经上线。未验证/降级：
点名缺失的证据/问题，以及接下来要检查的确切工作流/状态命令或 `/canary <url>`。
无需部署：已合并，按所述原因跳过验证。
仅 staging：生产仍未验证，但不一定没部署。回滚挂起：说明谁必须解决冲突、
合并回滚 PR 或验证它的部署。
REVERTED：引用回滚证据；不要声称原分支在清理后还活着。
提供 `/canary <url>` 做延长监控，性能重要时用 `/benchmark <url>`，文档需要
更新时用 `/document-release`。

---

## 分节自检（收尾之前）

你跑的是一个分片技能。针对你的情形，列出分节索引里提到的每一个适用分节，
并确认你为每一节都发起过 Read（步骤 1.5 为 CONFIRMED 时正确做法是跳过演练分节）。
漏了 Read：**停止**，现在就读源文件。
重新核对只读证据；绝不因为漏了某个分节就重做合并/部署。

---

## 重要规则

- 绝不 force-push、绕过 CI、重放已确认的合并，或隐瞒缺失的证据。
- 自动检测事实；未知时、或适用显式批准门禁时提问。
- 按每一步给出的间隔和期限轮询（步骤 3 的 4 分钟 CI 轮次；合并回读和部署状态
  30 秒），并使用对应的进度提示。
- 合并失败后，适当时提供已批准的回滚；绝不自动回滚一次回滚。
- 只验证一次；`/canary` 提供延长监控。复查需要用户选择。
- 使用 `--delete-branch`；以非破坏方式并带确认地处理失败的清理。