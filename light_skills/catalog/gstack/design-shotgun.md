---
id: gstack/design-shotgun
title: design-shotgun
description: 生成多个 AI 设计变体，打开对比板收集结构化反馈，并迭代到用户认可某个视觉方向。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: design-shotgun/SKILL.md
snapshotPath: source-snapshots/gstack/design-shotgun/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /design-shotgun：视觉设计探索

你是一位设计头脑风暴伙伴。生成多个 AI 设计变体，在用户浏览器里并排打开它们，然后迭代，直到用户认可某个方向。这是视觉头脑风暴，不是评审流程。

---

## 小节索引 —— 在对应情境出现时阅读相应小节

本技能是一副决策树骨架。下面的步骤指向按需阅读的小节。执行某一步之前，先把对应小节完整读一遍；不要凭记忆操作。

| 时机 | 阅读这一节 |
|------|-----------|
| 撰写变体概念或设计简报时（第 3 步及之后）——UX 原则教义支配每一个设计方向 | `sections/doctrine.md` |

---

## 设计环境准备（在任何设计稿命令之前先跑这项检查）

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/design/dist/design" ] && D="$_ROOT/.claude/skills/gstack/design/dist/design"
[ -z "$D" ] && D="$HOME/.claude/skills/gstack/design/dist/design"
_DS=$("$HOME/.claude/skills/gstack/bin/gstack-paths" --get GSTACK_STATE_ROOT 2>/dev/null); _DC=${_DS:+$_DS/design-ready}; _DK=$(ls -diL "$D" 2>/dev/null)
_dt() { if command -v gtimeout >/dev/null; then gtimeout 10 "$@"; elif command -v timeout >/dev/null; then timeout 10 "$@"
elif command -v perl >/dev/null; then perl -e 'alarm(shift);exec(@ARGV)' 10 "$@"; else return 125; fi; }
_RC=0; _F="Fix: cd ${D%/design/dist/design} && ./setup"
if [ ! -x "$D" ]; then _RC=missing
elif [ ! "$_DC" -nt "$D" ] || [ "$(cat "$_DC")" != "$_DK" ]; then _dt "$D" --version >/dev/null 2>&1 </dev/null || _RC=$?
fi
case "$_RC" in
  0) echo "DESIGN_READY: $D"; [ -n "$_DC" ] && echo "$_DK" > "$_DC" 2>/dev/null ;;
  missing) echo "DESIGN_NOT_AVAILABLE: $D is not installed. $_F" ;;
  124|142) echo "DESIGN_NOT_AVAILABLE: $D --version timed out after 10s" ;;
  125) echo "DESIGN_NOT_AVAILABLE: no timeout/gtimeout/perl to bound $D" ;;
  137) echo "DESIGN_NOT_AVAILABLE: $D --version exited 137 (killed at launch; on macOS usually an invalid code signature). $_F" ;;
  *) echo "DESIGN_NOT_AVAILABLE: $D --version exited $_RC" ;;
esac
```

如果输出 `DESIGN_NOT_AVAILABLE`：跳过视觉稿生成，回退到现有的 HTML 线框图方案（`DESIGN_SKETCH`）。设计稿是渐进增强，不是硬性要求。

对比板是本地 HTML 文件：在 macOS 上用 `open file://...` 打开（其他平台用 `xdg-open`）。用户只需要在默认浏览器里看到这个文件。

如果输出 `DESIGN_READY`：设计二进制可用，可以生成视觉稿。命令：

- `$D generate --brief "$(cat "$BRIEF_FILE")" --output /path.png` —— 生成单张设计稿（打印 `outputPath`）
- `$D variants --brief "$(cat "$BRIEF_FILE")" --count 3 --output-dir /path/` —— 生成 N 个风格变体（打印 `paths`）
- `$D compare --images-file /path/board-images.json --output /path/board.html --serve` —— 对比板 + HTTP 服务
- `$D serve --html /path/board.html` —— 服务对比板，并通过 HTTP 收集反馈
- `$D check --image /path.png --brief "$(cat "$BRIEF_FILE")"` —— 视觉质量门禁
- `$D iterate --session /path/session.json --feedback "$(cat "$FEEDBACK_FILE")" --output /path.png` —— 迭代

图片命令绝不覆盖（被占用的名字会得到 `-2`），并且总是打印 JSON（`requested`、`saved`、`failures`）；退出 0 表示就绪，2 表示什么都没保存，3 表示保存了一部分后停止。捕获时不要用 `set -e`：`_OUT=$($D ...); _RC=$?`。简报和反馈都是自由文本：各自写进 `.gstack/tmp` 下的私有 `mktemp` 文件，然后传 `"$(cat "$FILE")"`，绝不内联。

**路径规则：** 设计产物属于 `$GSTACK_STATE_ROOT/projects/$SLUG/designs/`。
使用 `bin/gstack-paths`（docs/state-root.md）。即使只是临时产物也要放在这里；绝不要换成
`.context/`、`docs/designs/` 或其他目录。
这些是用户文件，不是应用源码。

> **STOP。** 在撰写变体概念或设计简报（第 3 步及之后）之前 —— UX 原则教义支配每一个设计方向，请 Read `~/.claude/skills/gstack/design-shotgun/sections/doctrine.md` 并完整执行它。
> 不要凭记忆操作 —— 该小节是这一步的事实源。

## 第 0 步：会话检测

检查这个项目之前是否有设计探索会话：

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
setopt +o nomatch 2>/dev/null || true
_PREV=$(find "$GSTACK_STATE_ROOT/projects/$SLUG/designs/" -name "approved.json" -maxdepth 2 2>/dev/null | sort -r | head -5)
[ -n "$_PREV" ] && echo "PREVIOUS_SESSIONS_FOUND" || echo "NO_PREVIOUS_SESSIONS"
echo "$_PREV"
```

**如果输出 `PREVIOUS_SESSIONS_FOUND`：** 读取每个 `approved.json`，展示摘要，然后用 AskUserQuestion 提问：

> "本项目之前的设计探索：
> - [日期]: [页面] —— 选择了变体 [X]，反馈：'[摘要]'
>
> A) 回看 —— 重新打开对比板，调整你的选择
> B) 新探索 —— 用新的或更新的指令从头开始
> C) 其他"

如果选 A：用已有的变体 PNG 重新生成对比板，重新打开，并恢复反馈回路。
如果选 B：进入第 1 步。

**如果输出 `NO_PREVIOUS_SESSIONS`：** 展示首次使用提示：

"这里是 /design-shotgun —— 你的视觉头脑风暴工具。我会生成多个 AI 设计方向，在你的浏览器里并排打开，你从中挑选最喜欢的。开发过程中随时可以运行 /design-shotgun，为产品的任何部分探索设计方向。我们开始吧。"

## 第 1 步：收集上下文

当 design-shotgun 由 plan-design-review、design-consultation 或其他技能调用时，调用方技能已经收集过上下文。检查 `$_DESIGN_BRIEF` —— 如果它已经设置，直接跳到第 2 步。

单独运行时，需要收集上下文，才能写出合适的设计简报。

**必需的上下文（5 个维度）：**
1. **给谁用** —— 这个设计面向谁？（人物画像、受众、专业程度）
2. **要完成的任务** —— 用户在这个屏幕/页面上想完成什么？
3. **存量** —— 代码库里已经有什么？（现有组件、页面、模式）
4. **用户路径** —— 用户怎么到达这个屏幕，之后又去哪里？
5. **边界情况** —— 超长名称、零结果、错误状态、移动端、首次使用与熟练用户

**先自动收集：**

```bash
cat DESIGN.md 2>/dev/null | head -80 || echo "NO_DESIGN_MD"
cat PRODUCT.md 2>/dev/null | head -120 || echo "NO_PRODUCT_MD"
```

`PRODUCT.md`（impeccable 的产品上下文文件）能回答任务与受众问题：确认即可，不要重复提问。绝不打开 `.claude/skills/impeccable/**`。

```bash
ls src/ app/ pages/ components/ 2>/dev/null | head -30
```

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
setopt +o nomatch 2>/dev/null || true
ls "$GSTACK_STATE_ROOT"/projects/$SLUG/*office-hours* 2>/dev/null | head -5
```

如果 DESIGN.md 存在，告诉用户："默认情况下我会遵循你 DESIGN.md 里的设计系统。如果这次你想脱离既定方向做视觉探索，直说就行 —— design-shotgun 会跟着你走，但默认不会偏离既定方向。"

**检查是否有可截图的在线站点**（用于“我不喜欢现在这个样子”的场景）：

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "NO_LOCAL_SITE"
```

如果用户提到了 URL，或者说了类似“我不喜欢现在这个样子”的话，在第 3c 步用 Aside 截取该页面，然后基于这张截图（而不是仅凭文字）生成改进变体。如果用户没有指明 URL，就问他 —— 绝不猜测他指的是哪一页。如果上面的探测打印了 `200`，就在下面的 AskUserQuestion 里把 `http://localhost:3000` 作为默认值提供（仍然要问 —— 绝不假设）。

**带预填上下文的 AskUserQuestion：** 把你从代码库、DESIGN.md 和 office-hours 产出中推断到的内容预填进去，然后只问缺的部分。合并成同一个问题覆盖所有缺口：

> "我知道这些：[预填上下文]。我还缺 [缺口]。
> 请告诉我：[针对缺口的具体问题]。
> 要几个变体？（默认 3 个，重要页面最多 8 个）"

上下文收集最多两轮，然后带着现有信息继续，并说明假设。

## 第 2 步：品味记忆

既要读持久品味画像（跨会话），也要读本会话已认可的设计，让生成偏向用户已经展现出来的品味。

**持久品味画像（v1 schema，位于 `~/.gstack/projects/$SLUG/taste-profile.json`）：**

读取本项目的品味画像：

```bash
SLUG=$("$HOME/.claude/skills/gstack/bin/gstack-slug" --get SLUG) || SLUG=""
[ -n "${SLUG:-}" ] || { echo "TASTE_PROFILE_UNAVAILABLE: could not resolve the project slug (gstack-slug failed). Fix: run ./setup."; exit 0; }
GSTACK_STATE_ROOT=$("$HOME/.claude/skills/gstack/bin/gstack-paths" --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_TASTE_PROFILE="$GSTACK_STATE_ROOT/projects/$SLUG/taste-profile.json"
if [ -f "$_TASTE_PROFILE" ]; then
  # Schema v1: { dimensions: { fonts, colors, layouts, aesthetics }, sessions: [] }
  # Each dimension has approved[] and rejected[] entries with
  # { value, confidence, approved_count, rejected_count, last_seen }
  # Confidence decays 5% per week of inactivity — computed at read time.
  cat "$_TASTE_PROFILE" 2>/dev/null
  echo "TASTE_PROFILE_FOUND"
else
  echo "NO_TASTE_PROFILE"
fi
```

**如果 `TASTE_PROFILE_UNAVAILABLE`：** 说明一次；然后在没有品味画像的情况下继续。

**如果 `TASTE_PROFILE_FOUND`：** 解析完整的 JSON；格式错误或不可读时走旧版回退。经过衰减后，按 confidence * approved_count（或 rejected_count）对各维度排序；每类取三条。统计保留的会话数（最多 50 个，不是累计总数）。在简报里写入：

"根据已记录的 [保留会话数] 个会话，这位用户的品味偏向：
字体 [前三]，颜色 [前三]，布局 [前三]，美学 [前三]。除非用户明确要求
不同方向，否则生成时向这些偏好倾斜。同时避开他们强烈拒绝的：
[各维度前三个被拒项]。"

**旧版回退：** 用 Glob 匹配 `$GSTACK_STATE_ROOT/projects/$SLUG/designs/**/approved.json`（用 gstack-paths 解析根目录）；读取最新的五个。要查看某张已认可的图，用 `~/.claude/skills/gstack/bin/gstack-design-approved <approved.json>` 解析它。只使用显式反馈，绝不从变体字母推断字体/颜色。没有可用文件：不带品味画像继续。

**冲突处理：** 如果用户当前的请求与某个很强的持久信号矛盾（例如品味画像强烈偏好极简，而用户说“做得俏皮一些”），要指出来：“注意：你的品味画像强烈偏好极简。这次你要的是俏皮 —— 我会照做，但你是想让我更新品味画像，还是把这次当作一次性例外？”

**衰减：** 把存储的 confidence 乘以 0.95 的“自 last_seen 起经过周数”次方（最少为零周）。跳过无效的日期/置信度；读取时不要改写文件。

**Schema 迁移：** 如果文件没有 `version` 字段，或 `version: 0`，说明它是旧版的 approved.json 聚合结果 —— `~/.claude/skills/gstack/bin/gstack-taste-update` 会在下次写入时把它迁移到 schema v1。

**每次会话的 approved.json 文件（旧版，仍然支持）：**

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
setopt +o nomatch 2>/dev/null || true
_TASTE=$(find "$GSTACK_STATE_ROOT/projects/$SLUG/designs/" -name "approved.json" -maxdepth 2 2>/dev/null | sort -r | head -10)
```

如果存在之前的会话，逐个读取 `approved.json`，从已认可的变体里提取模式；用 `~/.claude/skills/gstack/bin/gstack-design-approved <approved.json>` 解析每张已认可的图（报错意味着那张图已经不在了：跳过它，绝不用别的图顶替）。把这些合并进由 taste-profile.json 得到的信号 —— 如果画像已经说明“用户偏好 Geist 字体”（来自历史聚合），approved.json 文件补充的就是最近这次认可的具体情境。

最多取最近 10 个会话。对每个文件做 JSON 解析的 try/catch（跳过损坏的文件）。

**design-shotgun 会话结束后更新品味画像：** 用户选定某个变体时，调用 `~/.claude/skills/gstack/bin/gstack-taste-update approved <approved image path>`（即保存 approved.json 时打印的 `APPROVED_IMAGE`）。用户明确拒绝某个变体时，调用 `~/.claude/skills/gstack/bin/gstack-taste-update rejected <variant-path>`。CLI 会处理来自 approved.json 的 schema 迁移、衰减和冲突标记。

## 第 3 步：生成变体

设置输出目录：

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_DESIGN_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/designs/<screen-name>-$(date +%Y%m%d)"
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
```

把 `<screen-name>` 换成上下文收集中得到的、有描述性的 kebab-case 名称。

### 第 3a 步：概念生成

在做任何 API 调用之前，先生成 N 段文字概念，描述每个变体的设计方向。每个概念都应是一个独立的创作方向，而不是细微变体。用带字母的列表展示：

```
我会探索 3 个方向：

A) "名称" —— 这个方向的一句话视觉描述
B) "名称" —— 这个方向的一句话视觉描述
C) "名称" —— 这个方向的一句话视觉描述
```

从 DESIGN.md、品味记忆和用户请求中取材，让每个概念彼此区分。

**反趋同指令：** 每个概念都是独立方向。存在 DESIGN.md 时，由它决定什么可以变：保留它的字体和配色，改变布局与构图。没有 DESIGN.md 时，改变字体族、配色和布局思路。如果两个变体看起来像兄弟，就用刻意不同的方向重做较弱的那个。对于落地页、定价页或活动页，还要改变页面原型（经典 hero、长文故事、极简转化、对比），保持唯一的主动作不变，并给每个变体标注它的章节大纲。

具体检验：如果别人把两个变体的标题文字互换而看不出差别，那它们就太像了。变体应该像是不同设计团队做出来的，而不是同一个团队在不同日子做的。

### 第 3b 步：概念确认

在花 API 额度之前，用 AskUserQuestion 确认：

> "这是我要生成的 {N} 个方向。它们并行运行，整套通常大约 60 秒。"

选项：
- A) 全部 {N} 个都生成 —— 看起来不错
- B) 我想改一些概念（告诉我改哪些）
- C) 多加几个变体（我会补充方向）
- D) 减少变体（告诉我砍掉哪些）

如果选 B：吸收反馈，重新展示概念，重新确认。最多 2 轮。
如果选 C：补充概念，重新展示，重新确认。
如果选 D：去掉指定的概念，重新展示，重新确认。

### 第 3c 步：并行生成

**如果是在截图上演进**（用户说“我不喜欢这个”），在 Aside 里对用户指定的页面截一张图（PNG，即 evolve 步骤读取的格式）：

```bash
aside repl '
const pg = await openTab("<url>");
await pg.screenshot({ path: "current.png", type: "png", fullPage: true });
console.log("ASIDE_DIR=" + pwd);
await closeTab(pg);
console.log("GSTACK_STEP_OK");
'
```

然后 `cp "<ASIDE_DIR>/current.png" "$_DESIGN_DIR/current.png"`，并读取它，让用户看到你正在从什么演进。

**用一次 `$D variants --briefs-file` 调用生成所有变体。** 为每个已确认的概念往 `$_DESIGN_DIR/briefs.json` 写一条记录：一个由 `{"brief": "<该变体的完整简报>"}` 对象组成的 JSON 数组，按概念顺序（A、B、C……），最多 7 条。演进时，给每条记录加上 `"screenshot": "<_DESIGN_DIR>/current.png"`。然后用 `timeout: 600000` 运行下面这个 Bash 调用，并等它返回。它会在每次运行新建的目录里暂存：在沙箱会话中，`$D` 输出到 `~/.gstack/` 下可能被中止（"The operation was aborted"），而临时目录可以正常工作。

```bash
_VARIANT_TMP=$(mktemp -d "${TMPDIR:-/tmp}/gstack-variants-XXXXXXXX")
_VARIANTS_JSON=$("$D" variants --briefs-file "$_DESIGN_DIR/briefs.json" --output-dir "$_VARIANT_TMP"); _RC=$?
echo "$_VARIANTS_JSON"; echo "EXIT: $_RC"
```

这条命令每隔 1.5 秒启动一个变体，遇到限流按退避重试，空白图重新生成一次，对每张图跑视觉检查、失败时重新生成一次（两张图都保留），9 分钟后不再启动新任务。它绝不覆盖图片。它在 stderr 上为每个变体打印一行 `VARIANT_<letter>_DONE`、`_FAILED` 或 `_RATE_LIMITED`，并在 stdout 上打印 JSON。每个 `variants[]` 条目包含 `saved`（它保存的每一张图，按顺序；最后一张是它的选择）、`operation`、`status`、`error`、`retryable` 和 `check.status`（`pass`、`fail` 或 `skipped`）。退出码 0 表示至少生成了一个变体（逐个读取状态），2 表示什么都没保存，1 表示简报文件非法、没有产生任何计费（错误会指出条目和字段；修好后重跑）。

**发布但不覆盖。** 绝不 `cp` 或 `mv` 图片。对每个变体，按顺序发布其 `saved` 列表里的每个路径，
`FINAL=$(~/.claude/skills/gstack/bin/gstack-design-claim "<saved path>" "$_DESIGN_DIR/variant-{letter}.png")`。
它绝不覆盖，并打印最终（可能被改名）的路径；从这里开始使用 FINAL，并报告每一个已发布的路径。一个变体最后一个 FINAL 就是它的选择。如果 claim 失败，报告错误；暂存的图仍留在它被保存的路径上。

### 第 3d 步：结果

命令返回、图片发布之后：

<!-- design:round-accounting -->
1. 先做轮次核算：本轮的图片正好就是已发布的那些路径（绝不用目录列表；更早的轮次仍留在磁盘上）。告诉用户：“{saved} / {N} 张付费图已保存，用时约 {实际时间}”，并列出每一个已发布路径。`skipped` 的检查意味着缺少自动化覆盖，不是通过：要说明这一点。
2. 对任何失败：明确报告并带上错误。绝不要静默跳过。对 `retryable: true` 的失败变体，用该变体自己的操作、以及从 `briefs.json` 读出并作为数据的简报重试一次：
   `_BRIEF=$(jq -r --arg v "<letter>" '.[($v | explode[0]) - 65].brief' "$_DESIGN_DIR/briefs.json")`，然后
   `"$D" generate --brief "$_BRIEF" --output "$_VARIANT_TMP/variant-<letter>.png"`，或者对截图条目用
   `"$D" evolve --screenshot "$_DESIGN_DIR/current.png" --brief "$_BRIEF" --output "$_VARIANT_TMP/variant-<letter>.png"`。
   捕获它的 JSON 和退出码，然后用 claim 助手发布它的 `outputPath`。
3. 如果零个变体成功：回退到串行生成，自己逐个把 `$D generate` 跑进 `$_VARIANT_TMP`，每个都用 claim 助手发布，并在落地时逐个展示。告诉用户：“并行生成失败（很可能是限流）。回退到串行生成……” 如果这样也什么都没保存，报告失败并停止：不出对比板。
4. 逐个内联读取每张已发布的图（Read 工具，使用已发布路径），让用户一次看到所有变体。
5. 以每个变体的选择（它最后发布的路径）按字母顺序进入第 4 步，作为本轮的对比板图片。

## 第 4 步：对比板 + 反馈回路

### 对比板 + 反馈回路

创建对比板并通过 HTTP 提供服务：

<!-- design:board -->
用 Write 工具把本轮的对比板图片（通过检查的已打印路径，按顺序）以 JSON 数组写入 `$_DESIGN_DIR/board-images.json`；对比板字母 A、B、C 按这个顺序。然后归档任何更早的 Submit，使它无法认可这些图，再构建对比板：

```bash
[ -f "${_DESIGN_DIR:?set _DESIGN_DIR to the design dir printed above}/feedback.json" ] && mv "${_DESIGN_DIR:?}/feedback.json" "${_DESIGN_DIR:?}/feedback-$(date -u +%Y%m%dT%H%M%SZ).json"
$D compare --images-file "$_DESIGN_DIR/board-images.json" --output "$_DESIGN_DIR/design-board.html" --serve
```

生成 HTML 并打开对比板。**在后台运行它**（宿主任务，或用 `&` 把 stdout/stderr 重定向到 `$_DESIGN_DIR` 里的私有文件）。从捕获的 stderr 里读取启动标记；有 PID 不等于就绪。缺少标记：使用下面的失败回退。

默认 stderr：`BOARD_URL: http://127.0.0.1:N/boards/<id>/`。用这个完整的按板 URL 做 AskUserQuestion，也作为重载基准。只有显式传旧式 `--no-daemon` 时才打印 `SERVE_STARTED: port=XXXXX`，此时在 `/` 提供单个对比板，重载端点是 `/api/reload`。

**主要等待方式：用带对比板 URL 的 AskUserQuestion**

一旦开始服务，就用包含对比板 URL 的 AskUserQuestion 等待：

"我已经打开了一个包含设计变体的对比板：
<BOARD_URL> —— 给它们打分、留言、混搭你喜欢的元素，完成后点 Submit。提交反馈后告诉我（或者在这里粘贴你的偏好）。如果你在对比板上点了 Regenerate 或 Remix，也告诉我，我会生成新的变体。"

`<BOARD_URL>` 用上面的 stderr 标记替换。

**用户在对比板上选变体；AskUserQuestion 只负责等待。**

**用户回应 AskUserQuestion 之后：**

检查对比板 HTML 旁边的反馈文件：
- `$_DESIGN_DIR/feedback.json` —— 用户点 Submit（最终选择）时写入
- `$_DESIGN_DIR/feedback-pending.json` —— 用户点 Regenerate/Remix/More Like This 时写入

```bash
if [ -f "$_DESIGN_DIR/feedback.json" ]; then
  echo "SUBMIT_RECEIVED"
  cat "$_DESIGN_DIR/feedback.json"
elif [ -f "$_DESIGN_DIR/feedback-pending.json" ]; then
  echo "REGENERATE_RECEIVED"
  cat "$_DESIGN_DIR/feedback-pending.json"
  rm "$_DESIGN_DIR/feedback-pending.json"
else
  echo "NO_FEEDBACK_FILE"
fi
```

反馈 JSON 的形状是：
```json
{
  "preferred": "A",
  "ratings": { "A": 4, "B": 3, "C": 2 },
  "comments": { "A": "Love the spacing" },
  "overall": "Go with A, bigger CTA",
  "regenerated": false
}
```

**如果找到 `feedback.json`：** 用户在对比板上点了 Submit。从 JSON 里读取 `preferred`、`ratings`、`comments`、`overall`。用已认可的变体继续。

**如果找到 `feedback-pending.json`：** 用户在对比板上点了 Regenerate/Remix。
1. 从 JSON 读取 `regenerateAction`（`"different"`、`"match"`、`"more_like_B"`、`"remix"` 或自定义文本）
2. 如果 `regenerateAction` 是 `"remix"`，读取 `remixSpec`（例如 `{"layout":"A","colors":"B"}`）
3. 用更新后的简报，通过 `$D iterate` 或 `$D variants` 生成新变体（捕获 JSON，并像第一轮那样做轮次核算）
4. 用上面的对比板代码块重建（它会归档 feedback.json 并重写 board-images.json），不带 `--serve`
5. 在用户浏览器里（同一标签页）重载对比板 —— daemon 模式下 URL 是按板分配的，所以用 `<BOARD_URL>`（来自 stderr 的 `BOARD_URL:` 行）作为基准：
   `jq -nc --arg html "$_DESIGN_DIR/design-board.html" '{html: $html}' | curl -sS -X POST "${BOARD_URL}api/reload" -H 'Content-Type: application/json' --data-binary @-`
   在 `--no-daemon` 下，重载端点是旧端口上的 `/api/reload`；只有调用方明确选择退出 daemon 时这条路径才相关。
6. 对比板会自动刷新。**再次 AskUserQuestion**，用同一个对比板 URL 等待下一轮反馈。重复直到出现 `feedback.json`。

**如果是 `NO_FEEDBACK_FILE`：** 用户直接在 AskUserQuestion 的回复里打了偏好，而不是使用对比板。把他们文字回复当作反馈。

退出码 0 且带 `BOARD_URL` 表示 daemon 正在服务；使用上面的对比板反馈流程。
**服务端回退：** 非零退出或没有就绪标记：用 Read 工具逐个内联展示变体（让用户能看到），然后用 AskUserQuestion：
"对比板服务启动失败。我已经在上方展示了变体。你更喜欢哪个？有什么反馈？"

**收到反馈之后（任何路径）：** 输出清晰摘要，确认你理解了什么：

"以下是我从你的反馈里理解到的：
PREFERRED: 变体 [X]
RATINGS: [列表]
YOUR NOTES: [评论]
DIRECTION: [总体方向]

对吗？"

继续之前用 AskUserQuestion 核实。

**保存已认可的选择。** 把用户的反馈（他们没给就写 `none`）写进私有文件：

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
FEEDBACK_FILE=$(mktemp "${_GT:?}/feedback.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "FEEDBACK_FILE: $FEEDBACK_FILE (name: ${FEEDBACK_FILE##*/})"
```

用你的文件写入工具把文本写入每个打印出的文件（Claude Code 的 Write 工具需要先 Read 一次空文件），内容要完全按它应有的样子出现。文本绝不进入 shell 命令、heredoc 或带引号的参数。如果写入失败或被拒绝，就不要发送：打印原因、文件路径和下面的命令，供手动发送。然后把确认的字母通过本板的 `board-images.json`（绝不用目录列表）映射出来并保存，用打印出的文件名替换 `<feedback-file-name>`：

```bash
_IMG=$(jq -r --arg v "<VARIANT>" '.[($v | explode[0]) - 65] // empty' "$_DESIGN_DIR/board-images.json")
if [ -n "$_IMG" ]; then
  FEEDBACK_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<feedback-file-name>"
  [ -s "$FEEDBACK_FILE" ] || { echo "Not saved: $FEEDBACK_FILE is missing or empty. Write the feedback, then rerun this block." >&2; exit 1; }
  jq -n --arg approved_variant "<VARIANT>" --arg approved_path "$(basename "$_IMG")" --rawfile feedback "$FEEDBACK_FILE" --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg screen "<SCREEN>" --arg branch "$(git branch --show-current 2>/dev/null)" '$ARGS.named | .feedback |= rtrimstr("\n")' > "$_DESIGN_DIR/approved.json" && rm -f "$FEEDBACK_FILE"
  echo "APPROVED_IMAGE: $_IMG"
else
  echo "NO_BOARD_IMAGE: <VARIANT> is not on this board; reselect from the board"
fi
```

## 第 5 步：反馈确认

收到反馈后（通过 HTTP POST 或 AskUserQuestion 回退路径），输出清晰摘要，确认你理解了什么：

"以下是我从你的反馈里理解到的：

PREFERRED: 变体 [X]
RATINGS: A: 4/5, B: 3/5, C: 2/5
YOUR NOTES: [各变体评论与总体评论的全文]
DIRECTION: [重新生成动作，如果有]

对吗？"

保存之前用 AskUserQuestion 确认。

## 第 6 步：保存与后续步骤

把 `approved.json` 写入 `$_DESIGN_DIR/`（由上面的循环处理）。

如果是从其他技能调用的：返回结构化反馈供该技能消费。调用方技能读取 `approved.json`，并用 `~/.claude/skills/gstack/bin/gstack-design-approved "$_DESIGN_DIR/approved.json"` 解析已认可的图。

如果是单独运行，用 AskUserQuestion 提供后续步骤：

> "设计方向已确定。接下来做什么？
> A) 继续迭代 —— 用具体反馈打磨已认可的变体
> B) 定稿 —— 用 /design-html 生成生产级 Pretext 原生 HTML/CSS
> C) 保存到计划 —— 把它作为一个已认可的视觉稿引用加入当前计划
> D) 完成 —— 我以后再使用它"

## 重要规则

1. **使用配置好的状态根。** 所有设计产物都放到 `$GSTACK_STATE_ROOT/projects/$SLUG/designs/`，即使那个根是临时的也一样。不要换成 `.context/`、`docs/designs/` 或任意的 `/tmp/` 路径。见上面的 DESIGN_SETUP。
2. **打开对比板之前先内联展示变体。** 用户应该立刻在终端里看到设计。浏览器里的对比板用于收集详细反馈。
3. **保存之前确认反馈。** 始终先总结你理解的内容并核实。
4. **品味记忆是自动的。** 之前认可的设计默认会影响新的生成。
5. **上下文收集最多两轮。** 不要过度盘问。带着假设继续。
6. **DESIGN.md 是默认约束。** 除非用户另有说明。