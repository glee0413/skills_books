---
id: gstack/ship
title: ship
description: 全自动发布工作流：合并基础分支、跑测试、审查 diff、递增版本号、更新 CHANGELOG、提交、推送并创建 PR。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: ship/SKILL.md
snapshotPath: source-snapshots/gstack/ship/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# Ship：全自动发布工作流

STOP 会阻止推进，直到所述的修复/恢复路径被清除；没有这样的路径时，结束本次尝试。
在继续之前，逐个回答每个 AskUserQuestion。
常规授权从不会豁免这些门禁，也不会豁免它们所需的用户决策。

**常规工作不需要确认：**包括未提交的改动、在 Step 12 下选择 MICRO/PATCH、起草 CHANGELOG 和提交、标记已完成的 TODO 以及自动修复发现的问题。
当 Step 7 的覆盖率达标时，报告剩余缺口并验证生成的测试，无需再次询问。Step 15 会提交这些测试。

**路线：**整合（1–3）→ 测试与审查（4–11.5）→ 准备发布（12–15）→ 验证冻结的内容（16）→ 推送并发布（17–21）。
每次新的调用都会重复 Step 1–16，包括两次审查和文档审计。
Step 12、17 和 19 用于防止重复递增版本、重复推送和重复创建 PR，而不是防止验证。

### 在步骤之间保留状态

在产品目录树之外保留一份私有的 Markdown **调用记录**，并保存它的绝对路径；记录使用下列标题，以便暂停的运行可以恢复：
- **Release：**版本号、`BUMP_LEVEL`、已审查的目录树和尝试次数。
- **Decisions：**每次批准的发现、涉及文件和被授权的动作。只在同一范围内复用它；修复从不重置或扩大批准范围。
- **Reviews：**句柄、原始 start token、终态、输出和排队的修复。
- **Checks：**命令/标签、结果/计数、时间戳、日志和消耗的输入。
- **Documentation：**候选/id、已用尝试次数、已接受的哈希或具名的阻塞例外。
- **Next steps：**一份有序的工作清单，并标记当前步骤。

**回执（receipt）**是一次检查的命令、结果和所消耗内容的已保存证据。
一次审查的 **start token** 是 `gstack-review-log --start` 在读取 diff 之前返回的不透明值。为 Step 9 保留 `REVIEW_START`，为 Step 11 的每次尝试保留单独的 `PASS_START`，为设计保留 `DESIGN_START`。每次检查都用它自己的原始 token 收尾；`--finish` 会自动盖住绑定字段。绝不借用或替换 token。
`gstack-wtree` 打印的是覆盖已跟踪文件和未被忽略的未跟踪文件的 Git 树哈希，不是 commit ID。用 `git diff <old-tree> <new-tree>` 比较这些快照。

### Ship 控制流

运行 /ship 的你（**父级**）掌握推进权；子任务返回的是证据，不是继续推进的许可。遵循已保存的工作清单：

1. 按顺序从 Step 1–21 开始，包括 6.5、11.5 和 14.5。只有当前项的各个门禁都清除后才推进。
2. 把一次修复展开成单独的步骤，插入到仍未完成的工作之前。这替换了当前项，其结果的记录仍然保留。
   只有当目标步骤还不是下一个待办步骤时才追加它。
3. 遇到另一次修复时，重复规则 2，同时不丢弃待办工作。
   已保存的清单优先于修复内部的常规“下一步”语句。
   一个范围绝不追加未列出的步骤。

**示例：**Step 11 的修复把 `9 → 10 → 11` 插入到 11.5 之前。如果之后 Step 9 的修复又影响到 6–8，清单就变成 `5 → 6 → 7 → 8 → 9 → 10 → 11 → 11.5`。
未受影响的发布步骤随后继续。修复期间 STOP 和 AskUserQuestion 门禁依然生效。

在整个调用过程中保持同样的尝试计数。以 Step 14 结束的范围不会进入 Step 14.5。包含 Step 14.5 的范围进入它已有的审计决策，而不是无条件发起新的审计；它的“初始加一”上限永不重置。
被允许的修复在本次调用中继续，不重启 /ship。

---

## 章节索引 — 在对应情形出现时阅读每一节

这个技能是一具决策树骨架。下面的步骤指向按需阅读的章节。执行某一步之前，先完整阅读对应章节；不要凭记忆工作。

| 何时 | 阅读这一节 |
|------|-------------------|
| 对 Apple 应用请求 App Store/TestFlight 分发（`.xcodeproj`、`.xcworkspace` 或 app 类 Swift 包）——在分支门禁之前、于 Step 0.9 阅读；Apple 仓库落地请求走常规流水线 | `sections/apple-release.md` |
| 运行测试套件，以及（若提示词文件有变更）评测套件（Step 4-6） | `sections/tests.md` |
| 在免费测试通过后提前开 PR，以便并行进行 Greptile 审查（Step 6.5） | `sections/greptile-early.md` |
| 付费评测用例失败，或免费套件的某个分片失败（Step 5-6）——从测试章节开始读；先做诊断性重跑，再走一次门禁 | `sections/measure.md` |
| 审计 diff 的测试覆盖率（Step 7） | `sections/test-coverage.md` |
| 审计计划完成度、验证情况和范围漂移（Step 8） | `sections/plan-completion.md` |
| 落地前审查与专家分派（Step 9） | `sections/review-army.md` |
| 在 Fix-First 之前做探索性 QA（Step 9.2.1） | 使用 `sections/review-army.md` 中的 QA Read 指令 |
| 复用被明确跳过的共享代码建议（Step 9.3） | `sections/shared-code-reuse.md` |
| 在已有 PR 时处理 Greptile 审查意见（Step 10） | `sections/greptile.md` |
| 对抗性审查与经验捕获（Step 11） | `sections/adversarial.md` |
| 撰写 CHANGELOG 条目（Step 13） | `sections/changelog.md` |
| 在最终提交/验证之前审计文档（Step 14.5），每次 ship 都要做 | `sections/documentation.md` |
| 准备标题，并用已验证的文档结果创建或更新 PR/MR（Step 18-19） | `sections/pr-body.md` |
| Step 19 打印了 CAPY_PR: on（Capy 会话，GSTACK_CAPY=1）——组装 PR 正文之前阅读 | `sections/capy-pr.md` |
| 把分支交给协调者而不是开 PR（--no-pr 或自动化通道；Step 18） | `sections/handoff.md` |

---

## Step 0：识别平台与基础分支

首先，从远端 URL 识别 git 托管平台：

```bash
git remote get-url origin 2>/dev/null
```

- 如果 URL 包含 "github.com" → 平台为 **GitHub**
- 如果 URL 包含 "gitlab" → 平台为 **GitLab**
- 否则，检查 CLI 是否可用：
  - `gh auth status 2>/dev/null` 成功 → 平台为 **GitHub**（涵盖 GitHub Enterprise）
  - `glab auth status 2>/dev/null` 成功 → 平台为 **GitLab**（涵盖自托管）
  - 两者都不成功 → **unknown**（只用 git 原生命令）

确定这个 PR/MR 的目标分支；如果还没有 PR/MR，则用仓库的默认分支。在后续所有步骤中把结果当作“基础分支”。

**如果是 GitHub：**
1. `gh pr view --json baseRefName -q .baseRefName`——成功就用它
2. `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`——成功就用它

**如果是 GitLab：**
1. `glab mr view -F json 2>/dev/null` 并提取 `target_branch` 字段——成功就用它
2. `glab repo view -F json 2>/dev/null` 并提取 `default_branch` 字段——成功就用它

**git 原生回退（平台未知，或 CLI 命令失败）：**
1. `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'`
2. 如果失败：`git rev-parse --verify origin/main 2>/dev/null` → 使用 `main`
3. 如果失败：`git rev-parse --verify origin/master 2>/dev/null` → 使用 `master`

如果全部失败，回退到 `main`。

打印识别出的基础分支名。在后续每一个 `git diff`、`git log`、`git fetch`、`git merge` 和 PR/MR 创建命令里，凡是说明中提到“基础分支”或 `<default>` 的地方，都替换成识别出的分支名。

---

`<base>` 表示识别出的分支名，用于 fetch/辅助脚本参数；`origin/<base>` 是它用于比较的远端跟踪引用。Step 1 会 fetch 它。



## Step 0.9：识别 Apple 目标

如果请求的是 App Store/TestFlight 分发，寻找 `.xcodeproj`、`.xcworkspace` 或 Swift app 产物。阅读 `Package.swift` 及其入口，以区分 app 与库/CLI。如果仍不清楚，用 AskUserQuestion 确认目标，并等待答案后再选择发布路径。
对确认是 app 的情况，**STOP，并先阅读
`~/.claude/skills/gstack/ship/sections/apple-release.md`**。商店分发通过该适配器从当前分支继续，包括干净的基础分支。
下面的分支门禁和仓库落地流水线仅适用于仓库落地请求，包括发生在 Apple 仓库上的请求。

## Step 1：起飞前检查

1. 把当前分支保存为 `<branch-name>`。如果位于基础分支或仓库默认分支，**中止**：“你正在基础分支上。请从特性分支发布。”

2. 运行 `git status`（绝不用 `-uall`）。未提交的改动总是包含在内；不要询问。

3. 在查看 diff 之前运行 `git fetch origin <base>`。如果 fetch 失败，STOP：
   报告错误，先恢复访问权限。然后查看
   `git diff origin/<base> --stat`、status 中的未跟踪文件，以及
   `git log origin/<base>..HEAD --oneline`。

4. 用下面的看板展示历史就绪情况，然后结束 Step 1。
   以往的 CLEAR 审查或看板跳过，永不替代 Step 9 的门禁。

## 审查就绪看板

在起飞前检查中，读取审查日志和配置以展示就绪情况；Step 9 会运行新的落地前审查。

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

**1. 选择要展示的记录。**下面每一行都用最新的一条记录。
不要用超过 7 天的记录来清除某一行，也绝不用更早的成功替代更新的失败。ship 指标不是审查记录。

| 行 | 取以下最新者 | 状态后缀 |
|---|---|---|
| Eng Review | `review` 或 `plan-eng-review` | (DIFF) 或 (PLAN) |
| CEO Review | `plan-ceo-review` | — |
| Design Review | `plan-design-review` 或 `design-review-lite` | (FULL) 或 (LITE) |
| Adversarial | `adversarial-review` 或旧版 `codex-review` | — |
| Outside Voice | 来自 CEO 或 Eng 审查的 `codex-plan-review` | — |

保留每条记录的 host、source、outside_provider、outside_status 和 phase。
历史来源 "claude" 是原生子代理；"claude-code" 是外部 CLI。
不要根据今天的运行框架推断旧的提供方或未知模型。原生结果不能填补缺失、已禁用或已跳过的外部覆盖。

**来源归属：**若有记录的 `via` 就把它追加到后缀（"CLEAR (PLAN via /autoplan)"）；没有则保留 "CLEAR (PLAN)" 或 "CLEAR (DIFF)"。在看板下方，按工作流运行和阶段分组展示 `autoplan-voices` 和 `design-outside-voices`。展示每个阶段的提供方和 outside_status；保留部分覆盖的情况。这些细节不能清除 Eng Review。

**2. 在给出结论之前检查新鲜度。**

- **内容优先规则：**对 `review`、`adversarial-review`、`codex-review`、
  ship 阶段审查和 `design-review-lite`，使用 `review_freshness.status`
  并展示它的 `reason`。CURRENT 表示一次已完成的干净审查，其开始与结束的
  内容指纹都等于当前的 `---WTREE---` 指纹。
  STALE 或 UNVERIFIED 不能清除 Eng Review。缺少 `review_freshness`，
  包括只有日志的旧记录，意味着 UNVERIFIED。绝不用 HEAD 相等或提交距离
  作为 diff 证据的替代，即使提交数为零也不行。
  展示已记录的 cycles、completed/converged 字段，以及缺失的来源/阶段
  覆盖。未知的覆盖不是通过。
- **计划记录**（plan-ceo-review、plan-eng-review、plan-design-review 和
  codex-plan-review）使用 7 天窗口，而不是工作树指纹。
  如果存在 `plan_sha256`，可以比较计划文件并报告不一致。
  把记录的提交与 `---HEAD---` 比较；如果不同，运行
  `git rev-list --count STORED_COMMIT..HEAD` 并报告
  “Note: {skill} review from {date} may be stale — {N} commits since review”。
  命令失败意味着 UNKNOWN，按过期处理；没有提交跟踪时，建议重跑。所有审查都
  最新时省略这些提示。

**3. 给出历史结论。**CLEARED 要求选中的 Eng Review 为 `clean`、在 7 天以内且
在步骤 2 下是新鲜的。否则报告 NOT CLEARED 及其缺失、过期或存在未决问题的原因。
没有 Eng Review 记录时，说明“没有保存的 Eng Review：运行只读 /plan-eng-review 打印的 `PERSIST:` 行，或重跑它”（docs/troubleshooting.md#plan-eng-review-not-persisted）。如果 `skip_eng_review` 为 true，Eng Review 展示
“SKIPPED (global)”，而本看板为 CLEARED。
这个结论绝不跳过 Step 9 及其发现、批准和收敛门禁。即使历史为 NOT CLEARED 也继续 Step 1。

其他行提供的是背景信息，不能替代 Eng Review：
- 产品/业务或范围决策建议做 CEO Review，常规修复或清理不建议。
- UI/UX 工作建议做 Design Review，后端、基础设施或纯提示词工作不建议。
- 对抗性审查总是包含一次原生检查。可用且已启用的外部挑战作为补充；
  200 行以上的 diff 还会走结构化的 P1 门禁。
- Outside Voice 是 CEO/Eng 审查之后默认开启的计划审查。`codex_reviews`
  会禁用这个额外步骤。提供方失败时使用原生回退并记录缺失的外部覆盖；
  这一行永不作为发布的门禁。

**4. 展示看板。**把缺失、过期、禁用或不可用的结果显示为显式状态，绝不显示为 CLEAR。把新鲜的 `clean` 结果显示为 CLEAR，把
`issues_open` 显示为 ISSUES OPEN，同时不改变已存的状态。

**REVIEW READINESS DASHBOARD**

步骤 1 中的每个条目占一行。只有 Eng Review 标记为必需。

| Review | Runs | Last run | Status | Required |
|---|---:|---|---|---|
| {行与后缀} | {计数} | {时间戳或 —} | {实际状态与原因} | {yes/no} |

VERDICT: {CLEARED 或 NOT CLEARED} — {原因}

状态为 `unverified` 或 `unavailable` 的外部审查属于覆盖缺失，绝不是通过。

对 200 行以上的 diff（`git diff origin/<base> --stat | tail -1`），建议
`/plan-eng-review` 或 `/autoplan`。

对 Design Review：运行 `source <(~/.claude/skills/gstack/bin/gstack-diff-scope <base> 2>/dev/null)`。如果 `SCOPE_FRONTEND=true` 且没有设计审查记录，提示：“Design Review 未运行 — Step 9 包含轻量检查；如需完整视觉审计可考虑 /design-review。”

不询问，继续 Step 2；Step 9 会应用审查门禁。

---

## Step 2：分发流水线检查

检查新的独立产物（CLI 二进制、包、工具）的分发，已部署的 Web 服务不算。

1. 列出候选分发路径：
   ```bash
   git diff origin/<base> --diff-filter=A --name-only | grep -E '(^|/)(cmd/[^/]+/main\.go|bin/[^/]+|Cargo\.toml|setup\.py|package\.json)$' | head -5
   ```
   把 Step 1 status 中匹配的未跟踪文件也算进来。逐个阅读匹配项：
   单独一个新的 `package.json` 或 `Cargo.toml` 不是可发布产物；
   还要检查已有清单中新声明的二进制或包导出。只有当确实存在新的
   可分发包时才设门禁。

2. 如果检测到新产物，检查是否有发布工作流：
   ```bash
   ls .github/workflows/ 2>/dev/null | grep -iE 'release|publish|dist'
   grep -qE 'release|publish|deploy' .gitlab-ci.yml 2>/dev/null && echo "GITLAB_CI_RELEASE"
   ```

3. **有新产物但没有流水线：**AskUserQuestion：“合并之后，没有发布流水线
   用户就无法下载这个产物。”
   - A) 现在就加上该平台的发布工作流
   - B) 推迟，在 Step 14 记一条 P1 分发 TODO
   - C) 不需要：仅内部/Web 使用，已由现有部署覆盖

4. **如果选 A：**按仓库的 CI 惯例添加打包/发布配置。
   先询问未知的目标、仓库或访问凭据；绝不臆造凭据。
   针对该产物再检查一遍，并把工作流纳入测试和审查。
   在 `/ship` 期间不要发布正式版本。
5. 否则不加流水线，继续。

---

## Step 3：合并基础分支（在测试之前）

合并 Step 1 中 fetch 到的基础引用，使测试和审查覆盖整合后的代码：

```bash
git merge origin/<base> --no-edit
```

**合并冲突：**简单冲突自动解决（VERSION、schema.rb、CHANGELOG 顺序）。对复杂或有歧义的冲突，**STOP**，展示冲突的选项，用 AskUserQuestion 决定解决方式，并等待答案后再编辑或继续。

**如果已经是最新：**静默继续。

**Ship 策略：**`~/.claude/skills/gstack/bin/gstack-ship-policy show-effective --base <base>`
（docs/ship-policy.md）；它的 `ship:` 行约束 Step 12、16 和提交历史。

如果整合改动了 Step 2 检查过的产物或分发配置，就用合并后的内容重做 Step 2（包括其中的决策），然后做 Step 4。

---

> **STOP。**在运行测试套件以及（若提示词文件有变更）评测套件（Step 4-6）之前，阅读 `~/.claude/skills/gstack/ship/sections/tests.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在免费测试通过后为并行的 Greptile 审查提前开 PR（Step 6.5）之前，阅读 `~/.claude/skills/gstack/ship/sections/greptile-early.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在审计 diff 的测试覆盖率（Step 7）之前，阅读 `~/.claude/skills/gstack/ship/sections/test-coverage.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在审计计划完成度、验证情况和范围漂移（Step 8）之前，阅读 `~/.claude/skills/gstack/ship/sections/plan-completion.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在落地前审查与专家分派（Step 9）之前，阅读 `~/.claude/skills/gstack/ship/sections/review-army.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在已有 PR 时处理 Greptile 审查意见（Step 10）之前，阅读 `~/.claude/skills/gstack/ship/sections/greptile.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在对抗性审查与经验捕获（Step 11）之前，阅读 `~/.claude/skills/gstack/ship/sections/adversarial.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

## Step 11.5：绑定审查

1. **选出两次审查。**运行 `~/.claude/skills/gstack/bin/gstack-review-read`。
   选出本次调用最终的 Step 9.4 记录（`skill:"review"`、`via:"ship"`）
   和 Step 11 的原生记录（`skill:"adversarial-review"`）。把每条记录对应到它保存的
   句柄、原始 token 和来源；拒绝外部提供方或更旧的记录。
2. **比较它们的内容。**要求原生记录的 `review_binding.state`
   为 `verified`。三份快照必须一致：它的 `wtree`、Step 9.4 的
   `review_binding.start_wtree` 和 `review_binding.end_wtree`。不一致或缺少
   记录/字段会阻塞发布准备：报告 **Review records missing or mismatched**，
   并在 Step 12 之前插入 `9 → 10 → 11 → 11.5`。在 11.5 处绑定新记录。
   绝不把新 token 挂到旧工作上。
3. **保留任何 QA 例外。**一个具名的探测风险例外可能让 Step 9.4 的
   根 `wtree` 缺失；条目 2 仍然比较它的开始/结束快照。内容一致
   不代表失败或未运行的探测就算通过。保留 Step 9.4 的不完整标记
   和用户的例外。
4. **保存证据。**保存两条记录和与之一致的 **reviewed tree**，供
   Step 16 使用。继续 Step 12。

## Step 12：版本号递增（自动决策）

条目 3 需要 `BUMP_LEVEL`：复用本次调用已保存的级别。否则 FRESH 在条目 2 中选择它，ALREADY_BUMPED 在条目 1 中推导它。

`ship: queue_mode stamp-at-merge` 会替换条目 1–4。

1. **分类状态**——纯读取，从不写入：
   ```bash
   bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-version-bump classify --base <base>
   ```
   把 JSON 中的 `baseVersion` 保存为 `BASE_VERSION`，然后读取 `state` 并分派：
   - **FRESH** → 使用已记录的级别，或在条目 2 中选择级别，然后检查队列并写入。
   - **ALREADY_BUMPED** → 保持 `NEW_VERSION=currentVersion`。如果缺少 `BUMP_LEVEL`，
     就取 `baseVersion` 到 `currentVersion` 之间第一个变化的组件
     （major/minor/patch/micro；不存在的第四段视为零）。继续条目 3，
     而不是再做一次自动递增。
   - **DRIFT_STALE_PKG** → 运行 `gstack-version-bump repair`，然后重新分类。
     成功则按 ALREADY_BUMPED 处理，包括它的队列检查；失败则停止。
     仅靠修复永不再次递增版本。
   - **DRIFT_UNEXPECTED** → STOP：package.json 与 VERSION 不一致，而 VERSION
     与基础分支一致。先处理这处手工编辑，再重新分类。
   - **NO_VERSION** → 逐字打印 `notice`，并在不做版本变更的情况下 ship：跳过
     Step 12 的剩余部分和 Step 13 的 CHANGELOG 条目，绝不创建 VERSION，在 Step 18 使用
     无前缀的标题，并在 Step 20 记录 `"version":null`。
   - **退出码 2** → STOP 并展示 stderr：所配置的版本文件缺失、为空、
     不可读或格式错误。修复它或它的固定配置，然后重新分类。绝不用 `0.0.0.0` 顶替。

2. **根据 diff 决定递增级别**（由 agent 判断）：
   - **MICRO**：少于 50 行，琐碎的调整/配置。**PATCH**：50 行以上，没有功能信号。
   - **MINOR**：出现任何功能信号（新路由/页面、迁移、模块）或 500 行以上时询问。
     **MAJOR**：出现里程碑或破坏性变更时询问（`ship: bump patch` 永不询问）。
     AskUserQuestion：带理由的推荐级别、更小的级别，或取消。
     等待；取消会在发布写入或推送之前停止，并保留现有工作。
   用小写的 `BUMP_LEVEL` 保存。声称的版本号可以把下一个可用号往前推，
   但不能改变已选的 MICRO/PATCH/MINOR/MAJOR 级别。

3. **队列感知的挑选：**
   ```bash
   QUEUE_JSON=$(bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-next-version --base <base> --bump "$BUMP_LEVEL" --current-version "$BASE_VERSION" 2>/dev/null || echo '{"offline":true}')
   CANDIDATE_VERSION=$(echo "$QUEUE_JSON" | jq -r '.version // empty')
   ```
   **先判定是否合格：**要求工具输出成功，且版本号非空并有效。
   `offline:false` 合格；`offline:true` 只有在带 `fallback:"git"` 时才算合格。
   离线输出缺少该回退、命令失败、输出格式错误或版本号为空
   都不可用，即使其中含有看起来像版本号的字符串。

   **不完整**（`complete:false`）：`unknown_claims` 中的 PR 未被读取；挑选可能
   撞车。重跑条目 3 一次；仍然不完整则 AskUserQuestion：使用它（推荐；
   Version Gate CI 会重读队列）还是停止。

   - **可用候选：**打印警告和已声称的队列。FRESH 设置 `NEW_VERSION=CANDIDATE_VERSION`。
     ALREADY_BUMPED 把它与 `currentVersion` 比较：若不同，询问是重新递增
     （刷新 CHANGELOG/PR 标题）还是保持当前值（CI 会拒绝冲突）。
     只有获得批准才改变既有版本。按 `branch` 和 `version` 检查 JSON 的
     `active_siblings`；持有 `>= NEW_VERSION` 的兄弟分支需要做出选择：
     越过它，或结束本次尝试并同步。
   - **没有可用候选：**打印 queue-unverified。FRESH 用本地 `BUMP_LEVEL`
     算术；ALREADY_BUMPED 保持 `currentVersion`。绝不用空候选。

4. **写入递增**（FRESH，或获得批准的重新递增）：
   ```bash
   bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-version-bump write --version "$NEW_VERSION" --regen-digest --changelog CHANGELOG.md
   ```
   它会写入 VERSION、清单和锁文件，并把 `## [Unreleased]` 移到 NEW_VERSION 下
   以供 Step 13 使用。退出码 2 表示什么都没写：展示 stderr，停止。
   退出码 3 是半写入：重新分类并对 DRIFT_STALE_PKG 执行 `repair`。

   `--regen-digest` 只在 `scripts/gen-agents-digest.ts` 和已提交的 `agents-digest/gstack-AGENTS.md` 都存在时才运行它；如果
   `agentsDigest` 为 false，运行 `bun --no-env-file --config=/dev/null scripts/gen-agents-digest.ts` 并把摘要随递增一起暂存。推送之前，
   验证已提交的摘要与所选 VERSION 的生成结果一致。

5. **在版本已写入之后记录发布决策**，包括获得批准的 ALREADY_BUMPED
   重新递增。跳过未变化的版本和只修清单的修复。
   ```bash
   ~/.claude/skills/gstack/bin/gstack-decision-log '{"decision":"Ship NEW_VERSION (BUMP_LEVEL)","rationale":"WHY","scope":"repo","source":"skill","confidence":9}' 2>/dev/null || true
   ```
   替换 `NEW_VERSION`、`BUMP_LEVEL` 和一行 `WHY`（范围或破坏性变更信号）；尽力而为。

> **STOP。**在撰写 CHANGELOG 条目（Step 13）之前，阅读 `~/.claude/skills/gstack/ship/sections/changelog.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

## Step 14：TODOS.md（自动更新）

阅读 `~/.claude/skills/gstack/review/TODOS-format.md`。

**1. 打开或创建：**阅读根目录的 `TODOS.md`。用户明确选择“add TODO”即授权
用 `# TODOS` 和 `## Completed` 创建它。否则若文件缺失，询问：A) 创建一个
按组件/优先级组织的 TODOS.md，B) 跳过。选跳过则直接到条目 5。

**2. 组织方式：**使用组件标题、`**Priority:**` P0–P4，以及底部的 `## Completed`。
如果结构混乱，询问：A) 重组并保留全部内容
（推荐），B) 保持原样。

**3. 添加已批准的推迟项：**
- Step 2：把已批准的分发后续工作作为 P1 加入，写上缺失的流水线和受影响的产物。
- Step 8：把每个已批准的 P1 计划推迟项加入，带 `Deferred from plan: {plan file path}` 和缺失的工作。
- Step 5：保留已写入的 P0 测试失败条目；按失败和来源去重，补上缺失的已批准条目，并附错误输出和分支。
绝不把被砍掉的范围变成 TODO，也绝不臆造未经批准的后续工作。复用匹配的条目而不是重复创建。

**4. 检测已完成的 TODO：**把标题、文件和行为与
`git diff origin/<base>`、未跟踪文件和 `git log origin/<base>..HEAD --oneline` 对比。
把已证实的完成项移到 `## Completed`，并标注 `**Completed:** vX.Y.Z (YYYY-MM-DD)`；
不确定的条目保持未完成。

**5. 保存摘要：**报告新增、推迟、完成、剩余数量和创建/重组情况。如果创建被拒绝或写入失败，给出警告，并在 Step 19 的 PR 摘要中带上未保存的后续工作；绝不说它们已经保存。TODO 写入失败不阻塞流程。

---

## Step 14.5：文档审计（每次 ship 都做）

**文档同步不变量：**每次 ship 都在最终提交/验证/发布之前分派 /document-release 子代理，包括重跑、已推送的分支、已有 PR 和纯文档改动。
没有改动意味着审计被执行过，而不是被跳过；报告该节已验证的结果。

> **STOP。**在最终提交/验证之前审计文档（Step 14.5）时，每次 ship 都要阅读 `~/.claude/skills/gstack/ship/sections/documentation.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

## Step 15：提交（可二分的小块）

做出可二分的提交；如果已经提交过，继续 Step 16。绝不创建空提交。

1. 把改动与它们的测试、配置/路由、视图和 Step 14.5 的文档归在一起；
   迁移可以单独成一次提交。少于 4 个文件、总计不足 50 行时可以合成一次提交。
2. 按依赖顺序排列：基础设施 → 模型/服务 → 控制器/视图。
   每次提交都能独立工作（没有断裂的导入或缺失的代码）。
   把 VERSION + CHANGELOG + TODOS.md 放在功能提交之后。
3. 使用 `<type>: <summary>`（feat/fix/chore/refactor/docs）和一段简短的正文；修复
   用户点名的 issue 时加上 `Fixes: #<n>` 尾注。只有最后的
   VERSION/CHANGELOG 提交才带发布版本号和共同作者尾注。不要打 Git tag：

```bash
git commit -m "$(cat <<'EOF'
chore: bump version and changelog (vX.Y.Z.W)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Step 16：验证门禁

**铁律：没有新鲜的验证证据，就不做完成声明。**

按顺序运行阶段 1–5；下面的恢复说明指出从哪里续跑。验证期间或之后内容
发生变化，就从阶段 1 重新开始，并在 Step 17 之前完成全部五个阶段。保持内容不变的提交会让证据继续有效。

### 1. 结束写入者并准备产物

检查写入者句柄，包括文档子任务。在另一个写入者运行之前，确认它已终止
或已正常结束；仅有超时或取消的确认就意味着 STOP，直到确认完成。

在项目说明、清单、构建文件和 CI 中找到已声明的生成/构建命令。运行它们并保存结果。如果没有，记录为不适用并写明检查过的来源。缺少前置条件或构建失败会阻止 ship：
报告 **Build failed or prerequisite missing**，附上命令、错误和所需的修复。绝不臆造替代命令。
**如果被阻塞：**修复它，然后重复阶段 1。通过后继续
到阶段 2；在那里把任何内容修复视为行为变更。

### 2. 选择变更路径

用 `~/.claude/skills/gstack/bin/gstack-wtree` 抓取当前目录树。把
`git diff <reviewed-tree> <current-tree>` 与 Step 12 之前保存的快照对比。
缺少快照会阻塞这次比较，与 HEAD 是否相等无关。

按这个顺序对比较结果分类：

1. **行为、测试或构建输入发生变化：**提示词/模板算作行为。
   把 `5–11.5 → 12–14 → 16` 插入到待办的 Step 17 之前，然后停止本步骤。
   这次修复排除 Step 14.5，因为重建可能改变生成的文档。
   Step 16 从阶段 1 重新开始：重建并再次比较，之后由阶段 3 判断
   文档新鲜度。后续修复沿用同一份工作清单。
2. **只有作者的文档或发布元数据发生变化：**保留 Step 8 的原始子任务
   报告和计数。用已记录的验证方式复查受影响的计划项，
   并把当前证据追加到调用记录中。如果某个分类不再成立，只运行 Step 8 的审计和
   决策门禁，然后回到 Step 16 阶段 1。绝不自己编辑子任务的计数。
3. **没有变化，或仅文档的检查仍然支持该计划：**继续到阶段 3，
   不做新的代码审查。

### 3. 判定文档的新鲜度

把所选发布路径、生成产物和文档/模板的基线与哈希，与 Step 14.5 保存的值比较。以往调用的
审计或风险决策永远不算数。

| 结果 | 动作 |
|---|---|
| 本次调用中被接受的审计与所有输入一致 | 继续到阶段 4。 |
| 用户接受的具名文档风险覆盖同一批准范围和确切内容，且不可豁免的门禁清除 | 继续到阶段 4；保留 `Documentation: blocked`、其原因和不完整的范围。 |
| 缺失、过期或被阻塞 | 使用下面的恢复流程。绝不悄悄刷新哈希。 |

报告变化的输入、阻塞点和已用尝试次数：

- **还有一次尝试，且有变化的输入或可用的修复：**在 Step 17 之前插入
  `14.5 → 15 → 16`。使用带现有计数的 Blocked 恢复流程。
  在 Step 15 之前验证结果，然后重启 Step 16 阶段 1。
- **否则：**STOP，除非用户接受
  那个具体的具名文档风险，且所有不可豁免的门禁都清除（按
  Step 14.5 的 Blocked 恢复规则）。内容未变且已批准则进入阶段 4；
  修复过的内容进入阶段 1。

绝不运行第三次审计。子任务返回不等于接受。

### 4. 验证冻结的候选版本

在验证和推送期间冻结输入。运行已声明的文档/链接/生成文件
检查；报告任何不可用的检查。

**输入一致时复用检查。**比较该检查已保存和当前的消耗文件、夹具、依赖和执行参数的哈希或完整字节。
依赖变化或未知时需要重跑。对模型评判者，比较完整的
展开请求、评分标准、参数和构建器/运行时依赖。引用原始
命令、结果/计数、时间戳和日志，绝不重新采样。强制审查仍然要运行。

**也要检查每条测试泳道的回执。**使用它实际的 Step 5 标签/命令：
`--label <lane> --expect-cmd '<exact Step 5 command>'`。检查自那次运行以来的变化；
`--allow-paths` 只豁免发布元数据。仅改 `package.json` 版本号的编辑
可以算数；脚本、依赖和运行时配置的改动需要实跑测试。
不确定的编辑不能被豁免。文档、TODO 改动、新增/生成的测试和修复
会让证据变成 STALE，即使没有新的代码审查。只有在所有允许的编辑都是发布元数据时，
才使用这个示例：

```bash
~/.claude/skills/gstack/bin/gstack-evidence check --label tests --expect-cmd '<tests>' --label vitest --expect-cmd '<vitest>' --max-age 24 --allow-paths CHANGELOG.md,VERSION,package.json,agents-digest/gstack-AGENTS.md
```

| 回执结果 | 下一步动作 |
|---|---|
| FRESH（退出码 0） | 引用标签、退出码、时间戳、日志和 `tests_ran`。 |
| STALE/MISSING：内容、命令或时间变化，或没有已证实的运行 | 运行 `~/.claude/skills/gstack/bin/gstack-evidence run --label <lane> -- '<command>'`，读取结果并复查一次。按下面的说明处理失败。 |
| ZERO-RUN：回执的 `tests_ran` 为 0 | 等同 STALE：该泳道什么也没证明。用 Step 5 的 ZERO-RUN 分诊（按失败泳道处理），绝不当作 FRESH，即使退出码为 0。 |
| `tests_ran: unknown` | 不阻塞：保留退出码 0 的结论，引用该泳道时写 `count unavailable`。绝不记成 ZERO-RUN，也不记成有计数的通过。 |
| 只有回执的存储/回读失败 | 用成功运行的证据独立证明最终内容未变、命令相同且时限有效。引用它确切的命令、退出码、时间戳和日志，标注 **ledger unavailable**，绝不用 FRESH。没有这些证明时，按 STALE/MISSING 处理。 |

没有测试泳道时：要求 Step 5 对最终内容给出明确的未测试范围批准，
或者运行 Step 5–15（包括无测试的决策），然后回到 Step 16 阶段 1。
报告这个缺口，绝不用 FRESH；构建必须通过。

**新增、变化或未被豁免的测试失败：**停止发布。运行 Step 5–15，
从 Step 5 的分诊开始，然后回到 Step 16 阶段 1。如果在阶段 5 报告时
才发现失败，同样适用这个恢复流程。重新进入 Step 14.5 时
保留它已有的审计计数；它不授权第三次尝试。

### 5. 先报告，再推送

只提交 Step 15 之后仍未提交、且已批准并已验证的发布改动，
包括生成产物；使用它的分组规则；绝不创建空提交。
保留无关的用户文件。

贴出构建/文档/测试结果。豁免只可用于同样的、已验证的既有失败和已批准范围；引用实际的批准和失败
计数，绝不用 FRESH 或全绿。新增、变化或未被豁免的测试失败按
阶段 4 的恢复流程处理，然后才发布。

然后是诚实清单，两行，来自 Step 9 最新的 `Gate edits:` 行
及其记录：
- 对每个门禁发现：`gate`、路径、处置（`kept`/`restored`/`open`）、
  `reason` 和记录器盖章的 `actor`。如果没有，则写覆盖行
  （`none detected (...)`、`partial (...)` 或 `UNAVAILABLE — ...`）。
- 每条测试泳道的 `tests_ran`（N、ZERO-RUN 或 `count unavailable`）。
以审计者的姿态写这份报告：本次会话自身的门禁编辑是供读者审视的证据，
不是需要辩护的立场；被保留的门禁只陈述理由，别的都不写。否则继续 Step 17。

---

## Step 17：推送

**凭据推送前守卫——在推送之前运行：**

```bash
_REDACT_PREPUSH=$(~/.claude/skills/gstack/bin/gstack-config get redact_prepush_hook 2>/dev/null || echo "false")
_HOOK_PATH=$(git rev-parse --git-path hooks/pre-push 2>/dev/null || echo "")
_HOOK_STATE="missing"
if [ -e "$_HOOK_PATH" ] || [ -L "$_HOOK_PATH" ]; then
  _HOOK_STATE="unmanaged"
  if [ -f "$_HOOK_PATH" ] && [ ! -L "$_HOOK_PATH" ] && grep -Fqx '# gstack-redact pre-push (managed)' "$_HOOK_PATH" 2>/dev/null; then
    _HOOK_STATE="managed"
  fi
fi
_HOOKS_DIR=$(git rev-parse --git-path hooks 2>/dev/null || echo "")
_HOOKS_IN_GIT_DIR="no"
_HOOKS_CONFIG_STATUS=0
git config --get core.hooksPath >/dev/null 2>&1 || _HOOKS_CONFIG_STATUS=$?
if [ -n "$_HOOK_PATH" ] && [ -n "$_HOOKS_DIR" ] && [ "$_HOOKS_CONFIG_STATUS" = "1" ] && [ ! -L "$_HOOKS_DIR" ]; then
  _HOOKS_IN_GIT_DIR="yes"
fi
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_PREPUSH_PROMPTED=$([ -f "$GSTACK_STATE_ROOT/.redact-prepush-prompted" ] && echo "yes" || echo "no")
if [ "$_REDACT_PREPUSH" = "true" ] && [ "$_HOOKS_IN_GIT_DIR" = "yes" ] && [ "$_HOOK_STATE" != "unmanaged" ]; then
  ~/.claude/skills/gstack/bin/gstack-redact install-prepush-hook || exit $?
fi
echo "REDACT_PREPUSH: $_REDACT_PREPUSH"
echo "HOOK_STATE: $_HOOK_STATE"
echo "HOOKS_IN_GIT_DIR: $_HOOKS_IN_GIT_DIR"
echo "PREPUSH_PROMPTED: $_PREPUSH_PROMPTED"
```

按回显的值分派：

1. **`REDACT_PREPUSH: true`**——这段代码安装或刷新受管理的
   钩子，保留 `pre-push.local` 和完整的 stdin。安装器失败时，
   在推送前 STOP。`HOOKS_IN_GIT_DIR: no`：不要安装；
   请求手动集成。`HOOK_STATE: unmanaged`：只有当钩子是默认目录中
   正常的、非符号链接的文件且没有 `pre-push.local` 时，才征询同意；
   否则请求手动集成。悬空的符号链接属于未管理。绝不覆盖任何一方的策略。
2. **`REDACT_PREPUSH` 不为 true 且 `PREPUSH_PROMPTED: no`**——一次性
   提议（整机只提一次）。AskUserQuestion：

   > gstack 可以安装一个按仓库生效的 git pre-push 钩子，阻止包含凭据
   > （API key、token、私钥）的推送。它是护栏而非强制手段——
   > `GSTACK_REDACT_PREPUSH=skip` 可以绕过它。
   > 要为你发布所用的仓库安装它吗？

   选项：
   - A) 是——安装凭据守卫（推荐）
   - B) 否——不要再问

   如果选 A：运行 `~/.claude/skills/gstack/bin/gstack-config set redact_prepush_hook true`
   然后重新运行上面的代码，并应用同样的目录和未管理钩子规则。
   如果选 B：运行 `~/.claude/skills/gstack/bin/gstack-config set redact_prepush_hook false`。
   无论选哪个答案之后都**总是**执行（问题失败时绝不执行；下次必须重新提议）：
   ```bash
   GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
   touch "$GSTACK_STATE_ROOT/.redact-prepush-prompted"
   ```
3. **之前已拒绝**——不作评论地继续。

**针对已就绪的既有 PR/MR 存在未决门禁发现：**当 Step 9 留下状态为 `open` 的门禁
发现时，在推送前查找 `<branch-name>` 对应的开放 PR/MR
（`gh pr list --head <branch-name> --state open --json number,isDraft`；GitLab
`glab mr list --source-branch <branch-name> --output json`，读取 `draft`）。查找
失败会在此 STOP。如果存在且不是草稿：

1. 前导信息回显了 `SESSION_KIND: spawned` 或 `headless`：**推送前 STOP。**
   报告未决的门禁发现（`gate`、路径）和该 PR/MR；不推送、不声称
   已发布。之后由人来处置。
2. 否则 AskUserQuestion 一次：A) 现在就解决这些未决项——在 Step 17 之前插入 `9 → 10 →
   11 → 11.5 → 12 → 13 → 14 → 14.5 → 15 → 16`；B) 带 `Gate edits: N open` 横幅
   按就绪状态发布。把 B 作为人类授权的发布记录到调用记录中；Step 19 会读取它。绝不把就绪的 PR 改成草稿。

新 PR 或已有的草稿无需提问：Step 19 会创建或保持草稿。

**幂等检查：**检查分支是否已经推送且为最新。

```bash
LOCAL=$(git rev-parse HEAD) || exit 1
REMOTE_REF=$(git ls-remote --heads origin refs/heads/<branch-name>) || {
  echo "STATUS: BLOCKED — cannot verify remote branch; restore access before pushing"
  exit 1
}
REMOTE=$(printf '%s\n' "$REMOTE_REF" | awk '{print $(1)}')
REMOTE=${REMOTE:-none}
echo "LOCAL: $LOCAL  REMOTE: $REMOTE"
[ "$LOCAL" = "$REMOTE" ] && echo "ALREADY_PUSHED" || echo "PUSH_NEEDED"
```

`ALREADY_PUSHED`：跳过推送，继续 Step 18。否则带上游跟踪推送：

```bash
git push -u origin <branch-name>
```

**如果推送失败，STOP。**不做 Step 19，也不声称已发布。报告错误：
- **非快进推送：**fetch 并查看远端，然后按 Step 3 的
  冲突规则合并。返回 Step 17 之前先运行 Step 5–16。绝不改写历史。
- **认证、钩子或网络失败：**修复原因，然后即使内容未变也要重跑 Step 16，
  之后再回到 Step 17。绝不绕过失败的门禁。
绝不 force-push。只有推送成功或已确认 `ALREADY_PUSHED` 才继续。

继续 Step 18。推送之后不再运行任何文档写入者。

---

## Step 18：准备发布元数据

先在识别出的平台上查找 `<branch-name>` 对应的开放 PR/MR：

- GitHub：`gh pr list --head <branch-name> --state open --json number,title,url`
- GitLab：`glab mr list --source-branch <branch-name> --output json`（默认就是 open）。

空数组意味着新建；匹配到一条则提供已有的标题/身份。
查找失败或有歧义的匹配会 **STOP** 等待处理，绝不意味着没有 PR。
保存结果供 Step 19 复查。

pr-body 节根据该结果准备标题，然后发布；
`--no-pr` 或自动化通道走 handoff 节。

> **STOP。**在准备标题并用已验证的文档结果创建或更新 PR/MR（Step 18-19）之前，阅读 `~/.claude/skills/gstack/ship/sections/pr-body.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

> **STOP。**在把分支交给协调者而不是开 PR（--no-pr 或自动化通道；Step 18）之前，阅读 `~/.claude/skills/gstack/ship/sections/handoff.md` 并完整执行。
> 不要凭记忆工作——那一节才是这一步的事实来源。

## Step 20：持久化 ship 指标

通过 `gstack-review-log` 为 `/retro` 记录指标；它自行处理项目/分支路径、
JSON 校验、存储和同步，且**不接受路径参数**。

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"ship","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","coverage_pct":COVERAGE_PCT,"coverage_schema":2,"coverage_pct_value":COVERAGE_PCT_VALUE,"weak_gaps":WEAK_GAPS,"tests_extended":TESTS_EXTENDED,"tests_rejected":TESTS_REJECTED,"regression_proof":REGRESSION_PROOF,"plan_items_total":PLAN_TOTAL,"plan_items_done":PLAN_DONE,"verification_result":"VERIFY_RESULT","version":"VERSION","branch":"'"$(git rev-parse --abbrev-ref HEAD)"'"}'
```

从更早的步骤中替换：
- **COVERAGE_PCT**：Step 7 图表中的整数百分比；null/未确定记为 -1
- **COVERAGE_PCT_VALUE**：Step 7 的 `coverage_pct_value`（门禁的 X）作为整数，缺失或被忽略时为 `null`
- **WEAK_GAPS**、**TESTS_EXTENDED**、**TESTS_REJECTED**：Step 7 的 `weak_gaps`、`tests_extended` 和 `tests_rejected` 的计数（键缺失或被忽略时为 0）
- **REGRESSION_PROOF**：来自 Step 7 的 `{"red_at_head":N,"base_green":N,"base_unavailable":N}`，缺失时为 `null`
- **PLAN_TOTAL**：Step 8 中提取的计划项总数（没有计划文件时为 0）
- **PLAN_DONE**：Step 8 中 DONE + CHANGED 项的数量（没有计划文件时为 0）
- **VERIFY_RESULT**："pass"、"fail" 或 "skipped"，在 Step 9 执行完 Step 8.1 的验证清单后设置
- **VERSION**：Step 12 的 `NEW_VERSION`；在 NO_VERSION 下为 `null`（不加引号）

分支由 shell 提供。无需确认即可运行。

---

## Step 21：plan-tune 可发现性提示（仅首次成功 ship）

在一次成功的 ship 之后，每台机器只展示一次这个不阻塞的 /plan-tune 提示：

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_NUDGE_MARKER="$GSTACK_STATE_ROOT/.plan-tune-nudge-shown"
_QT=$(~/.claude/skills/gstack/bin/gstack-config get question_tuning 2>/dev/null || echo "false")
if [ ! -f "$_NUDGE_MARKER" ] && [ "$_QT" = "false" ]; then
  echo ""
  echo "gstack can learn from your AskUserQuestion answers. Run /plan-tune to opt in"
  echo "— it captures which prompts you find valuable vs noisy and (with hooks installed)"
  echo "auto-decides your never-ask preferences."
  mkdir -p "$GSTACK_STATE_ROOT" && touch "$_NUDGE_MARKER"
fi
```

标记文件或已启用的 question_tuning 会抑制它；删除标记即可重新启用。

---

## 章节自检（完成之前）

列出适用的章节索引条目，并确认每一节都已阅读。如果你是凭
记忆工作的，STOP，阅读对应章节并重做那一步。使用 `gstack-version-bump`；绝不要
自己手写 VERSION/package.json。

---

## 重要规则

遵循编号门禁及其明确的例外。

- **绝不 force push。**只用普通的 `git push`。
- **提前开的 Greptile PR 保持开放。**Step 6.5 开启它之后若停下，草稿会
  保持开放并留一条说明原因的评论（greptile-early 节）；绝不关闭它。
- **使用所配置版本文件的格式**（VERSION 为 4 段）；在 NO_VERSION 下，
  绝不臆造一个。
- **Step 7 会生成覆盖率测试。**它们必须在提交前通过。绝不提交失败的测试。