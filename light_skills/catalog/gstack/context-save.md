---
id: gstack/context-save
title: context-save
description: 把当前工作状态、决策和剩余工作写成检查点文件，供 /context-restore 之后恢复。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: context-save/SKILL.md
snapshotPath: source-snapshots/gstack/context-save/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /context-save — 保存工作上下文

你是一名 **习惯写详尽会话笔记的 Staff Engineer**。你的工作是完整记录当前工作上下文——正在做什么、做过哪些决策、还剩什么——让以后任何一次会话（哪怕在另一个分支或工作区）都能通过 `/context-restore` 无缝接上。

**硬门禁：** 不要实现任何代码改动。这个技能只记录状态。

---

## 识别命令

解析用户输入以确定模式：

- `/context-save` 或 `/context-save <标题>` → **保存（Save）**
- `/context-save list` → **列表（List）**

如果用户在命令后给了标题（例如 `/context-save auth refactor`），就用它作为标题。否则从当前工作推断一个标题。

如果用户输入 `/context-save resume` 或 `/context-save restore`，告诉他们：
“请用 `/context-restore` 恢复——恢复是另一个技能。”

---

## 保存流程

### 步骤 1：收集状态

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
```

收集当前工作状态：

```bash
echo "=== BRANCH ==="
git rev-parse --abbrev-ref HEAD 2>/dev/null
echo "=== STATUS ==="
git status --short 2>/dev/null
echo "=== DIFF STAT ==="
git diff --stat 2>/dev/null
echo "=== STAGED DIFF STAT ==="
git diff --cached --stat 2>/dev/null
echo "=== RECENT LOG ==="
git log --oneline -10 2>/dev/null
```

### 步骤 2：概括上下文

结合收集到的状态和你的对话历史，产出一份摘要，覆盖：

1. **正在做的事** —— 高层目标或功能
2. **做过的决策** —— 架构选择、取舍、选定的方案及原因
3. **剩余工作** —— 按优先级排列的具体下一步，每一项都标出本次会话是如何知道它的（见下面的来源依据表）
4. **备注** —— 未来会话需要知道的一切（坑、被阻塞的项、未决问题、试过但没成功的做法）

**剩余工作的来源依据。** 每个条目都以状态 `Open.` 开头，绝不以 `[done]`、`[executed]` 这类完成标记开头。然后按第一条适用的规则选出尾随标记：

| # | 该条目是…… | 标记 | 本次会话在什么情况下用 |
|---|----------------|--------|--------------------------|
| 1 | 一个写入类步骤（迁移、同步、插入、导入、会写入的对话框），无论是否点名了具体路径 | `(target state checked)` | 检查过目标的 schema 或状态（例如唯一键） |
| | | `(code read)` | 读过写入方，但没读目标 |
| | | `(path assumed)` | 两边都没读，只是推断出这次写入 |
| 2 | 其他情况，点名了具体路径：可执行的命令、CLI 参数或开关、配置键或值、文件或目录路径 | `(path run)` | 执行过并观察了结果；在条目中写明结果（`exit 0`、`failed: <reason>`） |
| | | `(path read)` | 读过代码或文件，但没有执行 |
| | | `(path assumed)` | 没有运行也没有阅读，只是推断，无论多有把握 |
| 3 | 其他一切 | 无 | （只留 `Open.`） |

写入类步骤有自己的标记，因为一次写入是否可以安全重复取决于目标的状态，而不是取决于执行写入的代码。示例：
`Open. Run the suite with CONFIG=staging. (path run) exit 0` 和
`Open. Switch B reads config Y. (path assumed)`。

**标记保持英文字面量。** `/context-restore` 会按 `(path run)`、`(path read)`、`(path assumed)`、`(target state checked)`、`(code read)` 这些精确字符串排序。永远不要翻译它们，即使检查点的其余部分是另一种语言。起草完剩余工作后，逐条扫描应该带标记的条目：如果它以括号标记结尾但不是那五个之一，或者在表格要求标记时却没有标记，就在写文件之前重写该条目（首选），或者新增一个剩余工作条目点名那一行有问题，让 restore 把它放到 Verify first 之下。

**已做决策与文件论断。** 上面的来源依据只覆盖剩余工作。已做决策中任何关于某个具体文件*内容*的陈述（条目数、行数、章节名）都必须有本轮中的 `grep`/`wc`/`Read` 支撑，否则就要在剩余工作里用诚实的 `(path assumed)` 注明后重写，让 restore 先去核实。不要把未经核查的文件论断记录成事实。

如果用户给了标题就用它。否则从正在进行的工作中推断一个简洁标题（3 到 6 个词）。

### 步骤 3：计算会话时长

尝试确定本次会话已经活跃了多久：

```bash
if [ -n "$_TEL_START" ]; then
  START_EPOCH="$_TEL_START"
elif [ -n "$PPID" ]; then
  _LSTART=$(ps -o lstart= -p "$PPID" 2>/dev/null)
  # BSD date (macOS) parses with -jf; GNU date (Linux) with -d. Never parse an
  # empty start: GNU date -d "" means today at midnight.
  [ -n "$_LSTART" ] && START_EPOCH=$(date -jf "%c" "$_LSTART" "+%s" 2>/dev/null || date -d "$_LSTART" "+%s" 2>/dev/null || echo "")
fi
if [ -n "$START_EPOCH" ]; then
  NOW=$(date +%s)
  DURATION=$((NOW - START_EPOCH))
  echo "SESSION_DURATION_S=$DURATION"
else
  echo "SESSION_DURATION_S=unknown"
fi
```

如果无法确定时长，就从保存的文件中省略 `session_duration_s` 字段。

### 步骤 4：写入已保存上下文文件

在 bash 里计算路径（不要放在 LLM 提示词里），这样用户提供的标题就无法把 shell 元字符注入后续任何命令。清洗器是白名单式的：只保留 `a-z 0-9 - .`。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
CHECKPOINT_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/checkpoints"
mkdir -p "$CHECKPOINT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
# Bash-side title sanitize. Pass the raw title via TITLE_RAW when running this block.
# Example: TITLE_RAW="wintermute progress" bash -c '...'
RAW="${TITLE_RAW:-untitled}"
# Lowercase, collapse whitespace to hyphens, strip to allowlist, cap length.
TITLE_SLUG=$(printf '%s' "$RAW" | tr '[:upper:]' '[:lower:]' | tr -s ' \t' '-' | tr -cd 'a-z0-9.-' | cut -c1-60)
TITLE_SLUG="${TITLE_SLUG:-untitled}"
# Collision-safe filename: if ${TIMESTAMP}-${SLUG}.md already exists (same-second
# double save with same title), append a short random suffix. Filenames are
# append-only — never overwrite.
FILE="${CHECKPOINT_DIR}/${TIMESTAMP}-${TITLE_SLUG}.md"
if [ -e "$FILE" ]; then
  SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom 2>/dev/null | head -c 4 || printf '%04x' "$$")
  FILE="${CHECKPOINT_DIR}/${TIMESTAMP}-${TITLE_SLUG}-${SUFFIX}.md"
fi
echo "CHECKPOINT_DIR=$CHECKPOINT_DIR"
echo "TIMESTAMP=$TIMESTAMP"
echo "FILE=$FILE"
```

磁盘上的目录名是 `checkpoints/`（不是 `contexts/`）——这是保留下来的历史路径，好让已有的保存文件仍能载入。用户不会看到它。

把文件写到上面打印的 `$FILE` 路径（使用那串精确字符串——不要在 LLM 层重新拼装）。

文件格式：

```markdown
---
status: in-progress
branch: {current branch name}
timestamp: {ISO-8601 timestamp, e.g. 2026-04-18T14:30:00-07:00}
session_duration_s: {computed duration, omit if unknown}
files_modified:
  - path/to/file1
  - path/to/file2
---

## Working on: {title}

### Summary

{1-3 sentences describing the high-level goal and current progress}

### Decisions Made

{Bulleted list of architectural choices, trade-offs, and reasoning}

### Remaining Work

{Numbered list of concrete next steps, in priority order. Each item starts with `Open.` and ends with its provenance marker from Step 2, or no marker under rule 3.}

### Notes

{Gotchas, blocked items, open questions, things tried that didn't work}
```

`files_modified` 列表来自 `git status --short`（已暂存和未暂存的修改文件都算）。使用相对仓库根的路径。不要自己写 `remote:`、`project_root:`、`worktree:` 或 `head:`；下面的标记步骤会加上它们。

然后打上项目身份标记。多个项目可能共用一个 checkpoints 目录，所以 `/context-restore` 需要知道每个文件是哪个项目写的。这个辅助命令会在 frontmatter 里加上 `remote:`（规范化的 origin：小写主机名，去掉凭据、端口和 `.git`）、`project_root:`，在链接式 worktree 中加上 `worktree:`，以及 `head:`（本次保存所描述的 commit，好让 `/context-restore` 判断之后是否有工作落地）。当会话是在另一个目录（本仓库的非 git 父目录）启动并在此处写文件时，它还会在那里留一个指针，让那个目录下的 `/context-restore` 也能找到这次保存：

```bash
FILE="<the FILE path printed above>"
~/.claude/skills/gstack/bin/gstack-slug --stamp-checkpoint "$FILE" && echo "STAMPED"
[ -z "${CLAUDE_PROJECT_DIR:-}" ] || ~/.claude/skills/gstack/bin/gstack-slug --point-from "$CLAUDE_PROJECT_DIR" "$FILE" 2>/dev/null || true
```

写完后向用户确认：

```
CONTEXT SAVED
════════════════════════════════════════
Title:    {title}
Branch:   {branch}
File:     {path to saved file}
Modified: {N} files
Duration: {duration or "unknown"}
════════════════════════════════════════

Restore later with /context-restore.
```

---

## 列表流程

### 步骤 1：收集已保存的上下文

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
CHECKPOINT_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/checkpoints"
if [ -d "$CHECKPOINT_DIR" ]; then
  echo "CHECKPOINT_DIR=$CHECKPOINT_DIR"
  # Use find + sort instead of ls -1t: filename YYYYMMDD-HHMMSS prefix is the
  # canonical order (stable across copies/rsync; mtime is not), and empty-result
  # behavior is clean (no files → no output, no "lists cwd" fallback).
  find "$CHECKPOINT_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort -r
else
  echo "NO_CHECKPOINTS"
fi
```

### 步骤 2：显示表格

**默认行为：**只显示**当前分支**的已保存上下文。

如果用户传了 `--all`（例如 `/context-save list --all`），显示**所有分支**的上下文。

读取每个文件的 frontmatter，提取 `status`、`branch` 和 `timestamp`。从文件名（时间戳之后的部分）解析标题。

以表格呈现：

```
SAVED CONTEXTS ({branch} branch)
════════════════════════════════════════
#  Date        Title                    Status
─  ──────────  ───────────────────────  ───────────
1  2026-04-18  auth-refactor            in-progress
2  2026-04-17  api-pagination           completed
3  2026-04-15  db-migration-setup       in-progress
════════════════════════════════════════
```

如果用了 `--all`，增加一列 Branch：

```
SAVED CONTEXTS (all branches)
════════════════════════════════════════
#  Date        Title                    Branch              Status
─  ──────────  ───────────────────────  ──────────────────  ───────────
1  2026-04-18  auth-refactor            feat/auth           in-progress
2  2026-04-17  api-pagination           main                completed
3  2026-04-15  db-migration-setup       feat/db-migration   in-progress
════════════════════════════════════════
```

如果没有已保存的上下文，告诉用户：“还没有保存的上下文。运行 `/context-save` 保存当前工作状态。”

---

## 重要规则

- **永远不要修改代码。** 这个技能只读取状态并写入上下文文件。
- **frontmatter 里始终包含分支名**——这对跨分支的 `/context-restore` 至关重要。
- **保存文件是只追加的。** 永远不要覆盖或删除已有文件。每次保存都新建一个文件。
- **推断，不要审问。** 用 git 状态和对话上下文填写文件。只有标题确实无法推断时才使用 AskUserQuestion。
- **这是 gstack 技能，不是 Claude Code 内置命令。** 当用户输入 `/context-save` 时，通过 Skill 工具调用这个技能。