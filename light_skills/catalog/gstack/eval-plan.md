---
id: gstack/eval-plan
title: eval-plan
description: 在花第一笔钱之前先把付费评测预注册、零成本干跑并做小规模定价试点，然后才请负责人批准完整运行。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: eval-plan/SKILL.md
snapshotPath: source-snapshots/gstack/eval-plan/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /eval-plan：预注册的付费评测

从一个评测想法到第一次计费调用之间隔着三步，顺序如下：预注册（什么算通过、什么会中止本次运行）、零成本干跑（在真实输入形状上跑通流水线，价格表里有数）、定价试点（每个实验组三条，用账单结算，带误差带外推）。到这时才请负责人批准完整运行。每一步都打印一行可 grep 的文本；父代理读的是这些行，不是这段散文。

用法：`/eval-plan [<prereg.md>] [--input <rows.jsonl>] [--arms <model,model>] [--cap <usd>] [--total <items>]`

## 边界

- 步骤 3 之前不花钱，步骤 3 里也只花账本允许的钱。账本拒绝的预留（`EVAL_BUDGET_EXHAUSTED`）会中止这一步；绝不重试来腾出空间，绝不拆分调用以钻到上限之下。
- 试点一开始，预注册文本就冻结：一次计费调用之后改动门槛、实验组、诱饵或停止规则，那是一个新的评测，需要新的预注册。
- 预注册中指定的留出集（held-out）不会被这个技能读取、粘贴进提示词或做摘要；干跑只读开发行。
- 准入是一个估计值。`lib/pricing.ts` 对标准文本 token 定价，不含缓存写入、工具费、服务层级与长上下文倍率、媒体 token 以及按席位计量的运行；实际成本在结算时对账，`unknown` 费用会留在每张花费表里可见。
- 在 `SESSION_KIND: unattended` 下，步骤 4 的批准会写成一条门禁项，运行以 `gate_pending` 结束；这个技能从不自行批准一次付费运行。

## 步骤 1：预注册

写（或打开）预注册文件。每一节都是必需的，必须填写；`<!-- -->` 里的引导不算内容：

| 章节 | 放什么 |
|---|---|
| Bars | 每个指标一行：名称、通过门槛、方向、未达标对决策意味着什么 |
| Arms | 每个实验组一行：模型 id（在价格表里）、设置、来自步骤 1b 的单条成本 |
| Decoys | 打分器必须拒绝或打低分的输入；多少条、怎么造的、一个诱饵通过能证明什么 |
| Stop rules | 花费上限、试点上未达的门槛、低于自身门槛的打分器、`budget_exhausted` |
| Held-out exposure | 计划涉及到的每个留出集：此前的暴露（哪些运行、哪些模型）、对它的预留 |

```bash
~/.claude/skills/gstack/bin/gstack-eval-plan prereg --init <path>
~/.claude/skills/gstack/bin/gstack-eval-plan prereg --check <path>
```

`PREREG: ok` 就继续。`PREREG: incomplete` 会点名缺失或为空的章节（`PREREG_INCOMPLETE`，退出码 1）；补齐后重跑。不要在预注册不完整时继续。

当摘要器要统计诊断项时，在冻结提交之前于 `## Diagnostics` 一节里声明它们：`summarizer: <command naming {fixture}>`、`fixture: <synthetic records file>`，每个诊断项一行 `| diagnostic | expected |`，写清 fixture 被设计为产出的数量。摘要器 stdout 的最后一行是一个 JSON 计数对象。然后运行 `prereg --check <path> --allow-repo-commands`。不带这个标志时，摘要器只会被列出，检查以退出码 3 结束。每条 `PREREG_DIAGNOSTIC:` 行必须都是 `ok`。`PREREG_DIAGNOSTIC_UNTESTED`（退出码 1）意味着某个计数、缺失的诊断项或未声明的诊断项与它的定义不符。冻结之前先修好它。

### 步骤 1b：实验组及其价格

```bash
~/.claude/skills/gstack/bin/gstack-eval-plan arms
```

实验组来自项目的模型规则（`gstack-models resolve --role eval-arms`），回退到仓库自己的策略文档（`--policy-doc <path>`），或来自用户点名的 `--arms <picked-models>`。每条 `ARM:` 行带有它的来源，以及按所述 token 估计的单条成本；`price=MISSING`（`EVAL_PRICE_MISSING`）表示这个模型在 `lib/pricing.ts` 里没有对应行：从供应商的定价页补上那一行，或者去掉这个实验组。把定价后的实验组抄进 Arms 一节。

当仓库提交了 `.gstack/eval-models.json`（allow、deny、各作用域清单，family 新的在前；gstack 里是 `docs/eval-models.md`）时，`arms`、`dry-run`、`pilot start` 和 `price-gate` 会为每个实验组打印一行 `EVAL_MODEL:`。冒烟运行传 `--scope smoke`；默认是 `full`。被拒绝的实验组（`EVAL_MODEL_DENIED`、`EVAL_MODEL_OLD_GENERATION`、`EVAL_MODEL_GENERATION_UNRESOLVED`）要被替换掉，绝不要争辩着放行。

## 步骤 2：零成本的 stub 模型干跑

用一个不花钱的 stub 模型，在真实开发行上跑通整条流水线：

```bash
~/.claude/skills/gstack/bin/gstack-eval-plan dry-run --input <path> --arms <picked-models> --retry-prompt <path> --out <outdir>
```

如果行的提示词字段不叫 `prompt`，加 `--fields <id>`；用 `--output-budget` 指定本次运行要用的预算。打印出来的检查清单必须全是 `ok`：

- `CHECK: price-table` —— 每个实验组都有价格行。
- `CHECK: output-budget` —— 达到或高于推理下限（8,192 token）；推理模型会用输出 token 思考，预算太小会截断打分器读到的答案。
- `CHECK: retry-prompt` —— 重试时实际发送的原文，逐字打印出来；没有文本的重试就是在同样的价格上重复同样的失败。
- `CHECK: reservation-fits-cap`（配合 `--cap <cap-usd>`）—— 一次调用，最大的行加上输出预算，定价后能塞进上限；上限容不下的预留，供应商会拒绝。
- `DRY_RUN_ROW:` 行指出缺少字段的行；去改行，不要改提示词。

`DRY_RUN_RESULT: pass` 会把 `dry-run.json` 写到 `--out`；其他任何结果下试点都拒绝启动（`EVAL_DRY_RUN_FAILED`）。

## 步骤 3：定价试点（n≈3）

```bash
~/.claude/skills/gstack/bin/gstack-eval-plan pilot start --out <outdir> --cap <cap-usd> --arms <picked-models> --dry-run <path>
```

`pilot start` 通过花费账本（`--out` 里的 `spend.json`）为每个实验组预留三次尝试：准入条件是 `spent + reserved + unknown + estimate <= cap`，在一把与任何并发 worker 共享的文件锁下判断。把每条 `PILOT_ATTEMPT:` 跑过项目自己的评测命令，然后用供应商用量字段里的实际成本结算它，如果该调用是按席位或按 CLI 计量的，就记 `unknown`：

```bash
~/.claude/skills/gstack/bin/gstack-eval-plan pilot settle --out <outdir> --attempt <attempt-id> --usd <usd|unknown>
~/.claude/skills/gstack/bin/gstack-eval-plan pilot report --out <outdir> --total <total-items> --workers <workers>
```

`pilot report` 打印花费表（`spent`、`reserved`、`unknown charges`、每个 worker 有一个在途调用时的最坏情况、相对上限的最坏超支）以及 `PILOT_PROJECTION:`——每条的平均成本、它的样本偏差、到 `--total` 条在各实验组上的外推，以及一个 95% 区间。在本次运行后续的每个门禁处都重新生成这张表。试点未达预注册里的某个门槛、`status=budget_exhausted`，或 `verdict=exceeds` 时，停下并报告，不要请求批准。

## 步骤 4：请求批准

从仓库的调用计划文件里，为计划中提到的每个付费门禁定价（会花钱的 benchmark 或 eval 命令）；什么都不会执行（gstack 里是 `docs/eval-calls.md`）。门禁命令是自由文本，所以它只能以文件形式到达定价器：

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
GATE_FILE=$(mktemp "${_GT:?}/gate-command.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "GATE_FILE: $GATE_FILE (name: ${GATE_FILE##*/})"
```

用你的文件写入工具把文本写进每一个打印出的文件（Claude Code 的 Write 工具需要先 Read 一次这个空文件），内容就是它应该原样出现的样子。这段文本永远不进 shell 命令、heredoc 或带引号的参数。如果写入失败或被拒绝，不要发送：打印原因、文件路径和下面的命令，让人工发送。

把准确的门禁命令写成一行，写进打印出的文件，然后为它定价：

```bash
GATE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<gate-file-name>"
~/.claude/skills/gstack/bin/gstack-eval-plan price-gate --gate-file "$GATE_FILE" --cap-usd <cap-usd>
```

每条 `GATE_PRICE:` 行都会进入这次请示。`EVAL_GATE_UNPRICED`、`EVAL_PLAN_STALE`、`EVAL_PRICE_MISSING` 或 `EVAL_GATE_OVER_CAP` 表示该门禁按当前定价不可批准；`--allow-unpriced "<reason>"` 只在负责人明确同意时使用。

按这个顺序呈现，前面不要加任何东西：`PILOT_PROJECTION:` 行、花费表、每个门禁的 `GATE_PRICE:` 行、试点各项门槛的结果、预注册里的停止规则。然后问一个问题，只在 `verdict=within` 时把外推方案标为推荐选项：

- A) 按外推成本运行 `<total-items>` 条（在上限内时推荐）
- B) 削减实验组或条数；先重新计算外推
- C) 就停在这里；把试点结果留作记录

在 `SESSION_KIND: unattended` 下，通过 `gstack-gate` 把问题写成一条 `approval` 门禁项，并以 `GSTACK_RESULT: skill=eval-plan status=gate_pending run=<outdir>` 结束。完整运行获批后，会把每一次尝试都结算进同一个账本，并在每个门禁处重新打印花费表；`budget_exhausted` 会中止它。

## Tier 3，P7 之后（暂不在本技能内）

以下每一项都在等多代理波次计划（P7）里的采用数字；每项一行，先让人知道形状：

- Instrument audit：冻结打分器之前，读完一个开发轮次里每一份失败的 transcript；检查生成世界中的重复标识符、像词的代码和泛化短语；做双向的变异测试。(tier 3, after P7)
- Steady state：快照时后台队列为空，队列深度作为门禁记录。(tier 3, after P7)
- Sealed paths：在计划里声明；技能拒绝从中引用，自查输出里是否含它们的 n-gram，并加一行来源说明。(tier 3, after P7)
- Off-machine persistence：长运行通过 `gstack-detach --sync-cmd <cmd> --sync-every <min>` 同步。(tier 3, after P7)
- Memory preflight：并发数乘以按进程测得的内存，超过 RAM 的 70% 就拒绝。(tier 3, after P7)
- Power tables：关于功效与风险的句子要引用已提交的功效输出，并附一张针对明显规则备选方案的敏感度表。(tier 3, after P7)
- QA soak：对长生命周期服务器做数小时的混合写入，带 `CPU pinned, no progress` 看门狗。(tier 3, after P7)