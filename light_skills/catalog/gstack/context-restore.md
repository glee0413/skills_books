---
id: gstack/context-restore
title: context-restore
description: 载入此前由 /context-save 保存的工作上下文，默认优先当前分支的最新检查点。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: context-restore/SKILL.md
snapshotPath: source-snapshots/gstack/context-restore/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /context-restore — 恢复已保存的工作上下文

你是一名 **Staff Engineer，正在读同事留下的详尽会话笔记**，要准确无误地从对方停下的地方接着做。你的工作是载入最近保存的上下文，并把它清楚地呈现出来，让用户能不失节奏地继续工作。

**硬门禁：** 不要实现任何代码改动。这个技能只读取已保存的上下文文件并呈现摘要。

**默认行为：优先使用当前分支上最近保存的检查点；如果当前分支没有，就回退到所有分支中最近的那个。** 这个回退是为 Conductor 工作区交接准备的——在一个分支上保存的上下文可以从另一个分支恢复。之所以要有“当前分支优先”，是因为一个仓库的每个 worktree 共用一个 checkpoints 目录（slug 由 origin 推导，因而相同），没有这条偏好时，某个 worktree 里的 `/context-restore` 可能悄悄载入同级 worktree 更新的检查点。

**不要把候选集硬过滤成只剩当前分支**——其他分支的检查点仍留在集合里作为回退。它们只是排在当前分支自己的检查点*之后*，这样当前分支的保存永远不会被同级 worktree 更新的保存盖掉。（`/context-save list` 才是硬性限定到单个分支的流程。）

---

## 识别命令

解析用户的输入：

- `/context-restore` → 载入最近保存的上下文（当前分支优先，其次是任意分支）
- `/context-restore <标题片段或编号>` → 载入某个指定的已保存上下文
- `/context-restore list` → 告诉用户“请用 `/context-save list`——列表功能在保存那一侧”，然后退出。这里不做模式识别。

---

## 恢复流程

### 步骤 1：查找已保存的上下文

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
CHECKPOINT_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/checkpoints"
# Project identity: canonical remote (root only when there is no remote).
PROJECT_REMOTE=$(~/.claude/skills/gstack/bin/gstack-slug --get PROJECT_REMOTE 2>/dev/null) || true
PROJECT_ROOT=$(~/.claude/skills/gstack/bin/gstack-slug --get PROJECT_ROOT 2>/dev/null) || true
LEGACY_SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get LEGACY_SLUG 2>/dev/null) || true
echo "PROJECT_IDENTITY: ${PROJECT_REMOTE:-${PROJECT_ROOT:-unknown}}"
echo "PROJECT_ROOT: ${PROJECT_ROOT:-unknown}"
if [ -n "${LEGACY_SLUG:-}" ] && [ -d "$GSTACK_STATE_ROOT/projects/$LEGACY_SLUG/checkpoints" ]; then
  LEGACY_N=$(find "$GSTACK_STATE_ROOT/projects/$LEGACY_SLUG/checkpoints" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$LEGACY_N" -gt 0 ]; then
    echo "LEGACY_BUCKET: projects/$LEGACY_SLUG holds $LEGACY_N earlier checkpoint(s) from the bucket this project shared with other nested-group repos; review and copy with: ~/.claude/skills/gstack/bin/gstack-slug --adopt-legacy"
  fi
fi
if [ ! -d "$CHECKPOINT_DIR" ]; then
  echo "NO_CHECKPOINTS"
else
  # Use find + sort instead of ls -1t. Two reasons:
  # 1. Canonical order is the filename YYYYMMDD-HHMMSS prefix (stable across
  #    copies/rsync). Filesystem mtime drifts and is not authoritative.
  # 2. On macOS, `find ... | xargs ls -1t` with zero results falls back to
  #    listing cwd. `sort -r` on empty input cleanly returns nothing.
  # Scan the 200 newest so a current-branch checkpoint sitting below a burst of
  # sibling-worktree saves can still be found; the result is capped at 20 below.
  ALL=$(find "$CHECKPOINT_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort -r | head -200)
  if [ -z "$ALL" ]; then
    echo "NO_CHECKPOINTS"
  else
    # Order current-branch checkpoints first, other branches after. A git branch
    # is checked out in at most one worktree, and all worktrees of a repo share
    # one checkpoints dir (same origin-derived slug), so without this preference
    # `/context-restore` in worktree A could load worktree B's newer checkpoint.
    # Cross-branch resume (Conductor handoff) is preserved as the fallback: when
    # the current branch has no checkpoint, the full newest-first set is used.
    # CURRENT_BRANCH may be pre-set (tests); otherwise resolve it from git.
    : "${CURRENT_BRANCH:=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)}"
    SAME=""; OTHER=""
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      b=$(grep -m1 '^branch:' "$f" 2>/dev/null | sed 's/^branch:[[:space:]]*//')
      if [ -n "$CURRENT_BRANCH" ] && [ "$b" = "$CURRENT_BRANCH" ]; then
        SAME="${SAME}${f}
"
      else
        OTHER="${OTHER}${f}
"
      fi
    done <<EOF
$ALL
EOF
    # Identity check: only checkpoints stamped with THIS project's
    # identity are candidates for "latest". Unstamped (older) checkpoints are
    # trusted unless the directory demonstrably holds another project's files.
    CLASSIFIED=$(printf '%s%s' "$SAME" "$OTHER" | grep -v '^[[:space:]]*$' \
      | ~/.claude/skills/gstack/bin/gstack-slug --classify-checkpoints 2>/dev/null)
    if [ -z "$CLASSIFIED" ]; then
      echo "IDENTITY_CHECK_FAILED"
      printf '%s%s' "$SAME" "$OTHER" | grep -v '^[[:space:]]*$' | head -20 | sed 's/^/UNVERIFIED /'
    else
      FOREIGN_N=$(printf '%s\n' "$CLASSIFIED" | grep -c '^foreign' || true)
      VERIFIED=$(printf '%s\n' "$CLASSIFIED" | awk -F '\t' -v f="$FOREIGN_N" \
        '$(1) == "match" || $(1) == "match-root" || ($(1) == "unstamped" && f == 0) { print $(2) }')
      # Cap at 20: a user with 10k saved files shouldn't blow the context window.
      FILES=$(printf '%s\n' "$VERIFIED" | head -20)
      if [ -n "$FILES" ]; then echo "$FILES"; else echo "NO_VERIFIED_CHECKPOINTS"; fi
      # A newer checkpoint of another branch that names the same task.
      printf '%s\n' "$VERIFIED" | ~/.claude/skills/gstack/bin/gstack-slug --newer-task "$CURRENT_BRANCH" 2>/dev/null || true
      printf '%s\n' "$CLASSIFIED" | awk -F '\t' -v f="$FOREIGN_N" \
        '$(1) == "match-root" { print "ROOT_DIFFERS " $(2) }
         $(1) == "foreign" { print "FOREIGN " $(2) }
         $(1) == "unstamped" && f > 0 { print "UNVERIFIED " $(2) }' | head -40
      if [ "$FOREIGN_N" -gt 0 ]; then
        echo "SHARED_BUCKET: $FOREIGN_N checkpoint(s) here were saved by another project"
      fi
    fi
  fi
fi
# Checkpoints saved in a repository below this directory (BELOW_CWD, POINTER).
~/.claude/skills/gstack/bin/gstack-slug --checkpoints-below 2>/dev/null || true
```

**候选包含目录里的每个 `.md` 文件**，但排序是**当前分支优先**（分支从每个文件的 `branch:` frontmatter 读出）。其他分支的文件仍留在集合中作为回退，这样当前分支自己没有检查点时，Conductor 工作区交接依然可用。

**项目身份。** 纯路径行是本项目的检查点（由 `remote:`/`project_root:` 标记验证，或者在没有任何其他项目写过的目录里未被标记）。带前缀的行永远不会成为“最新”的候选：

- `FOREIGN <path>`：由共用这个目录的另一个项目保存。
- `UNVERIFIED <path>`：在身份标记出现之前保存，且所在目录也被另一个项目使用，因此可能属于任一方。
- `ROOT_DIFFERS <path>`：同一个仓库，但 checkout 不同（Conductor 工作区交接或移动过的克隆）。这是信息，不是不匹配；该文件同时也会以纯路径行的形式列出。
- `NEWER_TASK <path>`：本仓库的另一个分支为同一个任务保存了更新的检查点（它的 worktree 在这棵主树之下，或标题/工单匹配）。该文件同时也会以纯路径行的形式列出，位置在当前分支自己的之后。
- `BELOW_CWD <path>` / `POINTER <path>`：由这个目录下方某个仓库中的会话保存（`POINTER`：在这里启动的 /context-save 记录了它）。这些是候选，不是不匹配。

### 步骤 2：载入正确的文件

- 如果用户指定了标题片段或编号：在候选中找到匹配的文件，包括 `FOREIGN` 和 `UNVERIFIED` 行（用户可能是有意恢复另一个项目的检查点）。
- 否则：载入**上面步骤 1 返回的第一条纯路径行**，即本项目在当前分支上最新的 `YYYYMMDD-HHMMSS` 检查点；如果当前分支没有，则是所有分支中最新的那个。
- **没有可用的分支判别依据。** 当 `CURRENT_BRANCH` 为空、是 `HEAD`，或以其他方式无法判别（cwd 不是 git 仓库，或分支未知）时，如果最近的候选（例如最近 24 小时，或最新的三个）带有**不同标题**，不要静默载入最新的那个。通过 AskUserQuestion 列出这些标题和时间戳，把最新的标为推荐选项，然后等待。只有当所有最近候选共享同一个标题（同一主题）时才自动载入最新的。
- **不要静默选择一个更旧的检查点。** 如果步骤 1 打印了 `NEWER_TASK`，或者某个 `BELOW_CWD`/`POINTER` 文件比第一条纯路径行更新（或根本不存在纯路径行），把两者都展示出来（标题、分支、保存时间，若文件在本目录之下还要给 `project_root`），建议把更新的那个作为续接点，并通过 AskUserQuestion 询问载入哪一个。`BELOW_CWD`/`POINTER` 文件不算 PROJECT MISMATCH：说“保存在 `{project_root}`，在本目录之下”。
- 如果步骤 1 打印了 `NO_VERIFIED_CHECKPOINTS` 或 `IDENTITY_CHECK_FAILED`，不要把任何检查点当作最新呈现。说“此目录中没有经验证属于本项目的检查点”，列出 `FOREIGN`/`UNVERIFIED` 的标题及其标明的 `remote:`/`project_root:`（或“未知”），并询问要打开哪一个（如果有的话）。

**在任何摘要之前先报告身份问题。** 如果选中的文件是 `FOREIGN` 或 `UNVERIFIED`，先以这句开头：
“PROJECT MISMATCH: 这个检查点是由 `{来自其 frontmatter 的 remote 或 project_root，或“一个未知项目”}` 保存的，不是本项目（`{PROJECT_IDENTITY}`）。”
如果步骤 1 打印了 `SHARED_BUCKET`，说“这个 checkpoints 目录还存有来自另一个项目的 N 个检查点；此处只列出本项目的。”如果打印了 `LEGACY_BUCKET`，把那一行转述出来。如果选中的文件是 `ROOT_DIFFERS`，作为信息补充：“保存自本仓库在 `{project_root}` 的另一个 checkout。”

**检查保存之后分支是否移动过。** 标记里用 `head:` 记录了保存时所在的 commit。呈现之前，把它与当前 checkout 比较。FILE 是步骤 2 选中的检查点路径，即步骤 1 打印的路径之一：

```bash
FILE="<the FILE path printed above>"
SAVED_HEAD=$(tr -d '\r' < "$FILE" 2>/dev/null | sed -n '1{/^---$/!q;d;}; /^---$/q; /^head:/{s/^head:[[:space:]]*//p;q;}')
REPO_DIR=.
git rev-parse --git-dir >/dev/null 2>&1 || REPO_DIR=$(tr -d '\r' < "$FILE" 2>/dev/null | sed -n '1{/^---$/!q;d;}; /^---$/q; /^worktree:/{s/^worktree:[[:space:]]*//p;q;}')
[ -n "$REPO_DIR" ] || REPO_DIR=$(tr -d '\r' < "$FILE" 2>/dev/null | sed -n '1{/^---$/!q;d;}; /^---$/q; /^project_root:/{s/^project_root:[[:space:]]*//p;q;}')
CURRENT_HEAD=$(git -C "${REPO_DIR:-.}" rev-parse --verify -q HEAD 2>/dev/null)
if [ -z "$SAVED_HEAD" ]; then
  echo "HEAD_UNTRACKED"
elif [ -z "$CURRENT_HEAD" ]; then
  echo "HEAD_NOT_CHECKED"
elif [ "$SAVED_HEAD" = "$CURRENT_HEAD" ]; then
  echo "HEAD_UNCHANGED"
elif ! printf '%s\n' "$SAVED_HEAD" | grep -Eqx '[0-9a-f]{40}([0-9a-f]{24})?' \
  || ! git -C "$REPO_DIR" cat-file -e "$SAVED_HEAD^{commit}" 2>/dev/null; then
  echo "HEAD_UNKNOWN $SAVED_HEAD"
elif git -C "$REPO_DIR" merge-base --is-ancestor "$SAVED_HEAD" "$CURRENT_HEAD"; then
  echo "HEAD_MOVED $(git -C "$REPO_DIR" rev-list --count "$SAVED_HEAD..$CURRENT_HEAD")"
  git -C "$REPO_DIR" log --oneline -10 "$SAVED_HEAD..$CURRENT_HEAD"
else
  echo "HEAD_DIVERGED $SAVED_HEAD"
fi
```

- `HEAD_UNCHANGED` 或 `HEAD_NOT_CHECKED`：不需要补充什么。
- `HEAD_MOVED <n>`：在 Remaining Work 各分组之上打印 `<n> commit(s) landed since this save:` 以及上面的 commit 行，并把**每一个** Remaining Work 条目列到 **Verify first** 之下：保存的那个会话不可能知道这些 commit，所以任何步骤都可能已经做完了。
- `HEAD_DIVERGED` 或 `HEAD_UNKNOWN`：打印 `This checkpoint was saved at {head 的前 7 个字符}, which is not in this checkout's history (saved on another branch, rebased, reset, or not fetched).`，并把每个条目列到 Verify first 之下。
- `HEAD_UNTRACKED`：打印 `This checkpoint predates commit tracking; restore cannot tell whether work landed after it.`，然后照常排序。

**按来源依据给 Remaining Work 排序。** 保留每个条目的原文和保存顺序，一个都不删。当 head 检查打印了 `HEAD_MOVED`、`HEAD_DIVERGED` 或 `HEAD_UNKNOWN` 时，跳过下面的规则：无论标记是什么，每个条目都放到 Verify first 之下。以下条目放到 **Verify first** 之下：

- 以 `(path assumed)` 或 `(code read)` 结尾的；
- 以 `(path run)` 结尾，但正文报告了失败的；
- 以括号包围的尾随标记结尾，而该标记**不是**这五个英文字面量之一：`(path run)`、`(path read)`、`(path assumed)`、`(target state checked)`、`(code read)`——把翻译过或未知的标记当作 `(path assumed)`（→ Verify first），绝不能当作未标记的 Next steps；
- 没有标记，且是写入类步骤（迁移、同步、插入、导入、会写入的对话框），或点明了一个具体路径（可执行的命令、CLI 参数或开关、配置键或值、文件或目录路径）。

其他每一条都放到 **Next steps** 之下：结果为成功的 `(path run)`、`(path read)`、`(target state checked)`，以及既不写入也不点明具体路径的未标记条目。核实意味着只读检查：读文件或读目标，或运行一个不改变任何东西的命令。在来源标记出现之前保存的检查点没有标记，因此它们的“具体路径”条目会落到 Verify first 之下。当文件完全没有来源标记时，在各分组之上打印这一行：
`This checkpoint predates provenance markers; items naming commands, paths or writes are listed under Verify first.`

读取选中的文件并呈现摘要：

```
RESUMING CONTEXT
════════════════════════════════════════
Title:       {title}
Branch:      {branch from frontmatter}
Saved:       {timestamp, human-readable}
Duration:    Last session was {formatted duration} (if available)
Status:      {status}
════════════════════════════════════════

### Summary
{summary from saved file}

### Remaining Work
{commit-tracking lines, if any}
{legacy banner line, if it applies}

Next steps
{Next steps items, in saved order, original text}

Verify first (inspect read-only before executing anything)
{Verify first items, in saved order, original text}

### Notes
{notes}
```

如果当前分支与保存上下文的分支不同，注明：“这个上下文是在分支 `{branch}` 上保存的。你当前在 `{current branch}`。继续之前你可能需要先切换分支。”

### 步骤 3：给出下一步选项

呈现之后，通过 AskUserQuestion 询问：

- A) 继续处理剩余的条目
- B) 展示完整的已保存文件
- C) 只是需要上下文，谢谢

如果选 A，按保存顺序取第一个 Remaining Work 条目。如果它在 Next steps 之下，建议从那里开始。如果它在 Verify first 之下，建议先（只读地）核实它，再做它或任何更靠后的条目，这样后面某个可执行的步骤永远不会越过前面尚未核实的步骤。

---

## 如果没有已保存的上下文

如果步骤 1 打印了 `NO_CHECKPOINTS` 且没有 `BELOW_CWD` 或 `POINTER` 行，告诉用户：

“还没有保存的上下文。先运行 `/context-save` 保存当前工作状态，之后 `/context-restore` 就能找到它。”

如果还打印了 `LEGACY_BUCKET`，转述那一行：更早的检查点保留在旧的 bucket 里，直到用户用 `gstack-slug --adopt-legacy` 把它们复制过来。

---

## 重要规则

- **永远不要修改代码。** 这个技能只读取已保存的文件并呈现它们。
- **优先使用当前分支自己的检查点，但把所有分支都留在回退集合里。** 当前分支没有检查点时，跨分支恢复（Conductor 交接）依然可用，而同级 worktree 更新的保存也不会盖住本分支自己的。
- **永远不要把另一个项目的检查点当作“最新”呈现。** 身份依据是规范化的 remote（没有 remote 时才用根路径）；不匹配要在任何摘要之前报告。
- **检查点描述的是它保存时所处的那个 commit。** 当保存之后有 commit 落地时，每个 Remaining Work 条目在执行前都要先核实。
- **“最近”指的是文件名 `YYYYMMDD-HHMMSS` 前缀**，而不是 `ls -1t`（文件系统 mtime）。文件名在文件系统操作之间是稳定的；mtime 不是。
- **这是 gstack 技能，不是 Claude Code 内置命令。** 当用户输入 `/context-restore` 时，通过 Skill 工具调用这个技能。