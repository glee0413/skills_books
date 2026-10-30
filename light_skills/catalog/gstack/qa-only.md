---
id: gstack/qa-only
title: qa-only
description: 只读 QA：在选定的浏览器、API、CLI、任务、worker 或 webhook 界面上做探索，输出带证据的可复现缺陷报告，绝不修复代码或改动产品测试。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: qa-only/SKILL.md
snapshotPath: source-snapshots/gstack/qa-only/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /qa-only：只报告不修复的 QA 测试

探索选定的界面，并带着证据报告可复现的行为。
**绝不修复任何东西，也不改动产品测试。** 只写报告、证据和本次运行
独占的临时夹具；下文的附加规则（Additional Rules）界定了这些限制。

在共享章节里，**caller** 指的就是这个 /qa-only 工作流。权限由用户设定；
调用它的工作流可以进一步收紧。**Owned**（独占）指为本次运行创建、或明确
划归本次运行的资源，而不仅仅是“可写”。这两个词都不允许进行修复。

## 章节索引 — 遇到对应情形时再读相应章节

被指引时要把章节完整读完，不要凭记忆作答。

| 何时 | 读哪一节 |
|------|-------------------|
| 选择要测的界面，然后运行只报告探针（一次 Read 覆盖两者） | 相对于已安装的 `qa-only`/`gstack-qa-only` SKILL.md 目录的 `sections/exploratory.md` |
| 探针停止后整理最终报告 | 相对于已安装的 `qa-only`/`gstack-qa-only` SKILL.md 目录的 `sections/reporting.md` |

从“请求参数”开始，然后按顺序走下面的章节。

## 请求参数

**从用户请求中解析这些参数：**

| 参数 | 默认值 | 覆盖示例 |
|-----------|---------|-----------------:|
| Target | （从请求/仓库推断，或直接问） | 浏览器 URL、API 路由、CLI 命令、任务、worker 或 webhook |
| Mode | full | `--quick`、`--regression <previous-report-or-baseline>` |
| Output dir | `.gstack/qa-reports/` | `Output to /tmp/qa` |
| Scope | 选定的目标（或按 diff 划定） | `Focus on duplicate webhook delivery` |

功能探针要使用隔离的合成身份。浏览器会话按“浏览器准备”一节执行；
永远不要在聊天里索要凭据。

解析只记录请求，并不启动浏览器准备。如果同时给了 `--quick` 和
`--regression`，在准备或探针开始前让用户二选一。

**在没有显式范围的功能分支上：** 对改动过及相邻的行为做 diff 感知测试。
不要仅仅因为没给 URL 就去发现浏览器。

## 测试计划上下文

在本对话中寻找测试计划。如果本次会话已经知道项目的状态目录，在权限允许时
还要 Read 其中最新的 `*-test-plan-*.md`。不要仅仅为了找可选上下文就创建状态
或运行簿记辅助工具。
优先选择覆盖了更多所需契约的计划；并列时取更新的。
两者都不存在时，用 git diff 分析。

## 既往经验

只有当项目目录已经已知、且 caller 允许该 Read 时，才读取该项目既有的
learnings.jsonl。否则跳过这项可选查询。
不要在这里运行 gstack-learnings-search：它的 slug 辅助逻辑可能更新缓存。
不要修改配置、开启跨项目搜索或创建经验库。

把旧笔记当作线索，而不是证据。当某个 QA 发现与过去的经验吻合时，引用为
“Prior learning applied: [key] (confidence N/10, from [date])”并验证当前行为。
读取旧笔记从来不需要写新笔记。

## 选择界面与隔离

现在就加载共享的准备门禁（即下面的 exploratory STOP）：完成它的范围 Read 和
选定方法的 Read，等结果返回，再选定界面。把 charter、计时和探针留到
“运行选中的检查”；它的 §1 会复用“准备报告产物”中解析出的 REPORT_DIR。

> **STOP。** 在选择界面、运行只报告探针之前（一次 Read 覆盖两者），完整 Read 相对于已安装的 `qa-only`/`gstack-qa-only` SKILL.md 目录的 `sections/exploratory.md` 并照做。
> 使用本机已安装的路径，绝不要用产品工作目录或其他宿主上的资源。
> 如果缺失或无法读取，报告一个 QA 准备阻塞，并把受影响的探针标为 blocked；继续其他安全的探针（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

每个界面的方法都定义了 Full、Quick 和 Regression。模式标志作用于所有已选界面，
除非请求点名了某一个界面；其余界面按 Full 处理。
混合 Regression 时，参数是上一次的合并报告。先解析它的功能回放证据和浏览器
基线链接，再给每个方法各自的基线。
缺少基线只会阻塞该界面的回归覆盖，不阻塞独立检查。
混合运行时按用户给出的界面顺序，默认先功能后浏览器。
每个界面的计时从它的探针开始；做完一个界面再开始下一个。用户给出的绝对截止
时间是共享的；切换界面不会延长它。

## 准备报告产物

在写入前，先解析并保留用户提供的既往报告/基线路径及其证据链接。选择请求的输出
目录或 `.gstack/qa-reports`；不存在就创建。
只有当该目录为空时才把它用作 `REPORT_DIR`；否则另选一个全新的独占运行子目录。
用 UTC 的 `run-YYYYMMDDTHHMMSSZ`，冲突时加后缀。
所有本地报告、基线和证据都用这个目录。
绝不覆盖早先运行的产物。整理本次报告时，要保留本次运行的基线、
截图和探索笔记。

Caller 固定的产物路径和权限优先。一个既有的空目录如果已被 caller 确立为独占，
就不需要新的 shell 命令去重新验证；使用 caller 支持的接口和固定目的地。
如果在该权限范围内无法安全保留，报告一个输出阻塞；
不要扩大写权限，也不要悄悄把必需的产物改到别处。

对于 `{target}`，用浏览器主机名、CLI 可执行文件名，或具名的 API 服务/任务/
worker/webhook。把字母、数字和连字符以外的字符替换成连字符。混合目标用
`mixed-{project-label}`，仓库名按同样方式清洗；没有仓库名时用 `mixed-target`。
在报告里列出各个具体目标。

把 `REPORT_FILE` 设为 caller 指定的最终报告文件名，否则设为
`$REPORT_DIR/qa-report-{target}-{YYYY-MM-DD}.md`。charter 和最终发现都写这个
文件，不用旁挂文件。

## 浏览器准备（有条件）

**仅浏览器界面：** 加载它的准备章节；纯功能运行跳过本节。

完整 Read 相对于已安装的 `qa`/`gstack-qa` SKILL.md 目录的 `sections/browser-setup.md`。在本机已安装的 caller 技能旁边找 qa/gstack-qa。如果缺失或无法读取，报告一个 QA 准备阻塞，并把受影响的探针标为 blocked；继续其他安全的探针（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。不要用产品目录或其他宿主上的替代品。

---

## 运行选中的检查

使用上面已加载的共享章节；不要重启它的准备流程。
在它要求的 Read 完成、报告归属解析好之后，把 charter Write 进独占报告，并在
开始任何探针计时或基线之前等待 Write 成功返回。使用 `REPORT_FILE`。在探测前
写明每个预期结果、风险、入口、隔离方式和退出条件；绝不事后补造计划。
失败的基线契约保持失败。浏览器探针之前，源码/diff 读取只用来把改动映射到页面
和流程；存在 `TODOS.md` 时读它来识别已知缺陷。
在浏览器发现阶段，观察行为，不要靠读源码去诊断。

---

## 输出

### 组装报告

探针停止后，加载下面的收尾流程。顺序：exploratory 的 §4 标注与物化，然后
这个流程，最后 Write 最终报告。使用留存的证据；
本步骤不授权再做探针，也不重启已过期的计时。
不要预加载 reporting。为从误读中恢复：
如果已经读过，现在再发一次 Read 并等待其确认，即使工具报告内容未变。
不重复规则只覆盖准备阶段的 Read，不覆盖这次收尾 Read。

> **STOP。** 在探针停止后定稿报告之前，完整 Read 相对于已安装的 `qa-only`/`gstack-qa-only` SKILL.md 目录的 `sections/reporting.md` 并照做。
> 使用本机已安装的路径，绝不要用产品工作目录或其他宿主上的资源。
> 如果缺失或无法读取，报告一个 QA 准备阻塞，并把受影响的探针标为 blocked；继续其他安全的探针（独立的功能/静态检查）。缺失或不可读的资源会阻塞必需的 QA。

使用本机已安装的 QA 目录中的模板。混合运行时，在同一份报告里分开浏览器和功能
两节。
公共元数据只写一次：日期、分支/修订、caller/权限、模式、范围以及计时/停止原因。
在这段元数据之后、发现之前，把初始 charter 保留在 **Charters** 下。

- **浏览器：** `templates/qa-report-template.md`：目标、URL、框架、
  页面/截图数量、发现、健康/分类评分和回归对比。
- **功能：** `templates/functional-report-template.md`：原生工具/运行时、
  夹具归属、契约、发现、发现项/建议测试和清理。

每个建议测试都带一张价值卡；只有过得了这条线的才提出来：

**测试价值线。** 在编写或提出测试之前，复现出的缺陷已经回答了它保护什么、
什么条件下会失败；此外还要回答：

1. 现有覆盖为什么抓不到它？优先在已有的表驱动测试或共享夹具里加一行，而不是
   再造一个近似重复的测试。
2. 它是否需要生产侧接缝（导出、开关、包装、注入钩子），而没有任何生产调用方
   需要？如果需要，就改在真实的边界上测。

价值卡：`Value: protects=<...>; fails_when=<...>; why_new=<...>; seam=none; no_claim=<...>`（seam：`none` 或它的名字；`no_claim`：一句话说明通过并不能证明什么、以及哪些夹具或 mock 替代了什么，例如 `no_claim=provider acceptance (mocked provider; unit only)` 或 `no_claim=none beyond protects`；它绝不能豁免必需的实机检查）；每项在此处最多 160 个 UTF-8 字节（截断到 157 再加 `...`；写进 JSON 时保留完整值）。把它放在每个建议测试下面。上游缺少价值卡从不阻塞：自己推导；忽略不认识的字段。

示例：Value: protects=refundPayment rejects an empty reason; fails_when=the reason guard is removed or inverted; why_new=billing.test.ts covers processPayment only; seam=none; no_claim=provider acceptance (mocked provider; unit only)
驳回（covered_elsewhere）：“checkout renders”；checkout.e2e.ts:15 已覆盖它，所以扩展那个测试。

其余标题按界面嵌套，不要重复共享标题或元数据。
保留各界面特有的范围、计时和覆盖限制。
浏览器评分只适用于浏览器覆盖；绝不与功能结论混在一起。
每一节都要链接当前基线或回放证据和检查点；
功能回归的基线就是报告加回放证据。回归还要链接上一次的输入基线/报告；
缺少必需的回放输入会阻塞受影响的覆盖。既往基线不适用于 Full/Quick。
只报告模式下的修复/测试字段只能写建议或未运行状态，绝不声称做过修改。

### 写出经过检查的报告

在 reporting 流程的一致性检查之后，Write `REPORT_FILE` 和下面的项目副本。
这是报告的默认目的地；caller 更窄的权限或固定路径会覆盖它们。
不要创建被禁止的第二份副本。

项目副本使用本次会话已有的项目 slug 和状态目录。
如果未知、或在给定权限内不可写，把该副本报告为 blocked；仍然写出被允许的本地
报告。不要运行状态初始化辅助工具。
把相同内容写到 `$GSTACK_STATE_ROOT/projects/{slug}/{user}-{branch}-test-outcome-{datetime}.md`（本次会话解析出的状态根）。
从 `git config user.name`/`git branch --show-current` 取 `{user}`/`{branch}`
（回退值：`unknown-user`/`detached`）；按 `{target}` 的方式清洗。用 UTC 的 `YYYYMMDDTHHMMSSZ`。
如果该目的地已存在，另选一个带后缀的新文件名；绝不替换既往报告。

### 输出结构

`REPORT_DIR` 在整个运行中始终是报告根目录。纯浏览器和混合运行时，
把截图放在 `$REPORT_DIR/screenshots/`，浏览器基线放在 `$REPORT_DIR/baseline.json`。
共享循环的混合界面拆分只作用于计时和检查点：

| 运行 | 计时/检查点目录 |
|-----|----------------------------|
| 单界面（浏览器或功能） | `$REPORT_DIR` |
| 混合：浏览器探针 | `$REPORT_DIR/browser` |
| 混合：功能探针 | `$REPORT_DIR/functional` |

每个探针目录有自己的 `exploration-NNN.json` 序列、`annotations.json`
和物化步骤，并且只有在计时时才需要 `deadline.json`。Caller 固定的路径覆盖这套
布局。不要把 `REPORT_DIR` 改指到某个界面目录，也不要移动共享的浏览器产物路径。

## 附加规则（qa-only 专属）

1. **绝不修复缺陷，也不写产品测试。** 只查找和记录。功能目标允许必要的只读
    源码发现，浏览器发现则保持黑盒。不要通过任何工具修改产品代码、测试、依赖、
    配置或受跟踪的状态，包括 shell 写入、重命名、删除和先改后还原。
    绝不 commit、stash 或 bootstrap。建议的回归用例属于报告产物。
2. **在预检阶段，检查已记录的原生命令和测试基础设施。** 对浏览器目标，只为这项
    框架检查看文档，且要在发现之前。如果文档没有，报告缺失的覆盖和建议用例，
    不要安装任何东西。命令/服务不可用不是产品缺陷。绝不要从这个只报告的运行中
    调用 /qa 或其他技能。
    当浏览器应用的仓库可用、且没有记录任何框架时，说：
    “No test framework detected. Run `/qa` to bootstrap in a separate, user-authorized repair session.”
    功能目标保留这个缺口，不引入新框架。