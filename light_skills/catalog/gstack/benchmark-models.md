---
id: gstack/benchmark-models
title: benchmark-models
description: 让同一个提示词在多个模型上运行，比较速度、成本与输出质量，并把结果存成可复用的基线。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: benchmark-models/SKILL.md
snapshotPath: source-snapshots/gstack/benchmark-models/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /benchmark-models — 跨模型技能基准

你正在运行 `/benchmark-models` 工作流。它包装 `gstack-model-benchmark` 二进制，配一套交互流程：挑一个提示词、确认提供方、预览认证情况、运行基准。

与 `/benchmark` 不同 — 那个技能测量网页性能（Core Web Vitals、加载时间）。这个技能测量 AI 模型在 gstack 技能或任意提示词上的表现。

---

## Step 0: 定位二进制

```bash
BIN="$HOME/.claude/skills/gstack/bin/gstack-model-benchmark"
[ -x "$BIN" ] || BIN=".claude/skills/gstack/bin/gstack-model-benchmark"
[ -x "$BIN" ] || { echo "ERROR: gstack-model-benchmark not found. Run ./setup in the gstack install dir." >&2; exit 1; }
echo "BIN: $BIN"
```

找不到就停下，告诉用户重装 gstack。

---

## Step 1: 选择提示词

用前导规定的格式发起 AskUserQuestion：
- **Re-ground：** 当前项目 + 分支。
- **Simplify：** “跨模型基准会把同一个提示词交给 2-3 个 AI 模型运行，让你看到它们在速度、成本和输出质量上的差异。我们要用哪个提示词？”
- **RECOMMENDATION：** A，因为拿真实技能做基准能暴露工具使用上的差异，而不只是原始生成能力。
- **选项：**
  - A) 用我的某个 gstack 技能做基准（下一步选哪个技能）。Completeness: 10/10。
  - B) 用一段内联提示词 — 下一轮输入。Completeness: 8/10。
  - C) 指向磁盘上的提示词文件 — 下一轮给出路径。Completeness: 8/10。

如果选 A：列出有 SKILL.md 文件的顶层 gstack 技能（来自 `find . -maxdepth 2 -name SKILL.md -not -path './.*'`），用第二个 AskUserQuestion 让用户挑一个。把选中的 SKILL.md 路径作为提示词文件。

如果选 B：向用户索取内联提示词。它绝不进入 shell 命令：创建一个提示词文件，把提示词逐字写进去，然后用打印出来的路径作为提示词文件。

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
PROMPT_FILE=$(mktemp "${_GT:?}/benchmark-prompt.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "PROMPT_FILE: $PROMPT_FILE (name: ${PROMPT_FILE##*/})"
```

用你的文件写入工具把文本写进每个打印出来的文件（Claude Code 的 Write 工具需要先 Read 这个空文件），完全按它应有的样子写入。文本绝不进入 shell 命令、heredoc 或带引号的参数。如果写入失败或被拒绝，就不要发送：打印原因、文件路径和下面的命令，供人工发送。

如果选 C：索取路径。确认它存在。作为位置参数使用。

---

## Step 2: 选择提供方

```bash
"$BIN" --prompt "unused, dry-run" --models claude,gpt,gemini --dry-run
```

展示 dry-run 的输出。“Adapter availability”一节告诉用户哪些提供方真的会运行（OK），哪些会被跳过（NOT READY — 附带修复提示）。

如果三个全是 NOT READY：停下来并给出明确消息 — 没有至少一个已认证的提供方，基准跑不了。建议 `claude login`、`codex login` 或 `gemini login` / `export GOOGLE_API_KEY`。

如果至少一个是 OK：发起 AskUserQuestion：
- **Simplify：** “要包含哪些模型？上面的 dry-run 显示了哪些已认证。未认证的会被干净地跳过 — 它们不会中止整批。”
- **RECOMMENDATION：** A（全部已认证提供方），因为跑得越多，比较越丰富。
- **选项：**
  - A) 全部已认证提供方。Completeness: 10/10。
  - B) 只用 Claude。Completeness: 6/10（没有跨模型信号 — 单 Claude 基准可以用 /ship 的审查代替）。
  - C) 挑两个 — 下一轮指定。Completeness: 8/10。

---

## Step 3: 决定是否启用评判

```bash
[ -n "$ANTHROPIC_API_KEY" ] || grep -q 'ANTHROPIC' "$HOME/.claude/.credentials.json" 2>/dev/null && echo "JUDGE_AVAILABLE" || echo "JUDGE_UNAVAILABLE"
```

如果评判可用，发起 AskUserQuestion：
- **Simplify：** “质量评判会用 Anthropic 的 Claude 作为仲裁者，给每个模型的输出按 0-10 打分。每次运行约增加 USD 0.05。如果你在意输出质量而不只是延迟和成本，建议开启。”
- **RECOMMENDATION：** A — 整件事的重点就是比较质量，而不只是速度。
- **选项：**
  - A) 启用评判（约增加 USD 0.05）。Completeness: 10/10。
  - B) 跳过评判 — 只看速度/成本/token。Completeness: 7/10。

如果评判**不可用**，跳过这个问题，也不要加 `--judge` 标志。

---

## Step 4: 运行基准

根据 Step 1、2、3 的决定拼出命令：

```bash
PROMPT_PATH="<prompt-path>"
[ -s "$PROMPT_PATH" ] || { echo "ERROR: $PROMPT_PATH is missing or empty; the benchmark needs a prompt file." >&2; exit 1; }
"$BIN" --models <picked-models> [--judge] --output table -- "$PROMPT_PATH"
```

`<prompt-path>` 是 Step 1 得到的提示词文件（SKILL.md 路径、打印出来的提示词文件，或用户给的路径），`<picked-models>` 是 Step 2 得到的逗号分隔列表。只有当路径里不含 `'`、`"`、反引号、`$` 或 `\` 时才能直接用它；否则把文件复制成 Step 1B 的新提示词文件，改用那个。

输出到达就流式展示。这个过程慢 — 每个提供方都要完整跑一遍提示词。视提示词复杂度和是否开启 `--judge`，预计 30 秒到 5 分钟。

---

## Step 5: 解读结果

表格打印出来后，向用户总结：
- **最快** — 延迟最低的提供方。
- **最便宜** — 成本最低的提供方。
- **质量最高**（若运行了 `--judge`）— 得分最高的提供方。
- **综合最佳** — 靠判断。跑了评判：按质量加权。否则：说明用户需要做的权衡。

若有提供方出错（auth/timeout/rate_limit），点出来并给出修复路径。

---

## Step 6: 询问是否保存结果

发起 AskUserQuestion：
- **Simplify：** “把这次基准存成 JSON，好让以后的运行可以与之对比？”
- **RECOMMENDATION：** A — 提供方更新模型时，技能表现会漂移；存下来的基线能抓住质量回归。
- **选项：**
  - A) 保存到 `~/.gstack/benchmarks/<date>-<skill-or-prompt-slug>.json`。Completeness: 10/10。
  - B) 只打印，不保存。Completeness: 5/10（丢失趋势数据）。

如果选 A：用 `--output json` 重跑，并 tee 到带日期的文件。打印路径，方便用户以后对比。

---

## 重要规则

- **没有先跑 Step 2 的 dry-run，绝不运行真实基准。** 用户需要在花掉 API 调用之前看到认证状态。
- **绝不硬编码模型名。** 总是传用户 Step 2 选出的提供方 — 剩下的交给二进制。
- **绝不自动加上 `--judge`。** 它会带来真实成本；用户必须主动选择。
- **如果一个提供方都没认证，停下。** 不要尝试基准 — 它产不出有用的输出。
- **成本是可见的。** 每次运行都会在表格里显示各提供方的成本。用户应该在下次运行之前看到它。