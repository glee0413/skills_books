---
id: gstack/gstack-upgrade
title: gstack-upgrade
description: 把 gstack 升级到最新版本，并展示这次更新带来了什么。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: gstack-upgrade/SKILL.md
snapshotPath: source-snapshots/gstack/gstack-upgrade/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /gstack-upgrade

把 gstack 升级到最新版本，并展示有哪些新变化。

## 内联升级流程

所有技能前言在检测到 `UPGRADE_AVAILABLE` 时都会引用这一节。

### 步骤 1：询问用户（或自动升级）

首先检查是否启用了自动升级：
```bash
_AUTO=""
[ "${GSTACK_AUTO_UPGRADE:-}" = "1" ] && _AUTO="true"
[ -z "$_AUTO" ] && _AUTO=$(~/.claude/skills/gstack/bin/gstack-config get auto_upgrade 2>/dev/null || true)
echo "AUTO_UPGRADE=$_AUTO"
```

**如果 `AUTO_UPGRADE=true` 或 `AUTO_UPGRADE=1`：** 跳过 AskUserQuestion。记录“Auto-upgrading gstack v{old} → v{new}...”，直接进入步骤 2。安装失败时，按步骤 4 里针对安装类型的恢复办法处理：vendored 安装恢复它们的备份；git 安装则停下并记录升级前的 commit，不做破坏性 reset。除非恢复真的成功，否则绝不要声称已恢复。

**否则**，使用 AskUserQuestion：
- 问题：“gstack **v{new}** 已可用（你当前在 v{old}）。现在升级吗？”
  四个字段（`UPGRADE_AVAILABLE <old> <old>+<n> <sha>`，main 已前进）：问“gstack main 已经比 v{old} 前进 **{n} 个 commit**（在 {sha}）。现在升级吗？”
- 选项：["是，现在升级", "总是让我保持最新", "暂时不要", "不要再问"]

**如果选“是，现在升级”：** 进入步骤 2。

**如果选“总是让我保持最新”：**
```bash
~/.claude/skills/gstack/bin/gstack-config set auto_upgrade true
```
告诉用户：“已启用自动升级。以后的更新会自动安装。”然后进入步骤 2。

**如果选“暂时不要”：** 写入延后状态，并逐级加大退避（第一次延后 = 24 小时，第二次 = 48 小时，第三次及以后 = 1 周），然后继续当前的技能。不要再提升级。
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_SNOOZE_FILE="$GSTACK_STATE_ROOT/update-snoozed"
_REMOTE_VER="{new}"
_CUR_LEVEL=0
if [ -f "$_SNOOZE_FILE" ]; then
  _SNOOZED_VER=$(awk '{print $(1)}' "$_SNOOZE_FILE")
  if [ "$_SNOOZED_VER" = "$_REMOTE_VER" ]; then
    _CUR_LEVEL=$(awk '{print $(2)}' "$_SNOOZE_FILE")
    case "$_CUR_LEVEL" in *[!0-9]*) _CUR_LEVEL=0 ;; esac
  fi
fi
_NEW_LEVEL=$((_CUR_LEVEL + 1))
[ "$_NEW_LEVEL" -gt 3 ] && _NEW_LEVEL=3
echo "$_REMOTE_VER $_NEW_LEVEL $(date +%s)" > "$_SNOOZE_FILE"
```
注意：`{new}` 是 `UPGRADE_AVAILABLE` 输出里的远端版本——从更新检查结果里替换。若那行有四个字段，用 SHA（第四个字段）作为 `{new}`，这样当 main 再次前进时延后就结束了。

告诉用户延后时长：“下次提醒在 24 小时后”（或 48 小时、1 周，取决于级别）。提示：“在 `~/.gstack/config.yaml` 里设置 `auto_upgrade: true` 可启用自动升级。”

**如果选“不要再问”：**
```bash
~/.claude/skills/gstack/bin/gstack-config set update_check false
```
告诉用户：“更新检查已禁用。运行 `~/.claude/skills/gstack/bin/gstack-config set update_check true` 可重新启用。”
继续当前的技能。

### 步骤 2：判断安装类型

```bash
if [ -d "$HOME/.claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.claude/skills/gstack"
elif [ -d "$HOME/.gstack/repos/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.gstack/repos/gstack"
elif [ -d ".claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR=".claude/skills/gstack"
elif [ -d ".agents/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR=".agents/skills/gstack"
elif [ -d ".claude/skills/gstack" ]; then
  INSTALL_TYPE="vendored"
  INSTALL_DIR=".claude/skills/gstack"
elif [ -d "$HOME/.claude/skills/gstack" ]; then
  INSTALL_TYPE="vendored-global"
  INSTALL_DIR="$HOME/.claude/skills/gstack"
elif _SRC=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT 2>/dev/null) && _SRC=$(awk -F '\t' '$(1) == "claude" && $(6) != "-" { print $(6); exit }' "$_SRC/installs.tsv" 2>/dev/null) && [ -d "$_SRC/.git" ]; then
  # 安装登记表记录了 setup 为此宿主激活的 checkout（例如 ~/gstack 的克隆）。
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$_SRC"
else
  echo "ERROR: gstack not found"
  exit 1
fi
INSTALL_DIR=$(cd -- "$INSTALL_DIR" && pwd -P) || { echo "ERROR: cannot enter the gstack install directory" >&2; exit 1; }
echo "Install type: $INSTALL_TYPE at $INSTALL_DIR"
```

上面打印出的安装类型和绝对目录会在后续所有步骤中使用。
把 `INSTALL_TYPE`、`INSTALL_DIR`、`OLD_VERSION`，以及稍后的 `NEW_VERSION` 显式地一路传下去：工具调用可能跑在全新的 shell 里，所以后面每个代码块都要先把它们从捕获的输出里赋值（例如 `INSTALL_DIR=/abs/path/printed/above`）。不要依赖上一次调用的工作目录或 shell 变量。每个会改动文件的代码块都先检查 `INSTALL_DIR`，当它未设置、为空、不存在、不可读，或不是 gstack 自己的 checkout 时，在任何 git 命令之前就停下。

### 步骤 3：保存旧版本

用步骤 2 输出里的安装目录：

```bash
OLD_VERSION=$(cat "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}/VERSION" 2>/dev/null || echo "unknown")
echo "OLD_VERSION=$OLD_VERSION"
```

### 步骤 4：升级

使用步骤 2 检测出的安装类型和目录：

**对于 git 安装**（global-git、local-git）：

先通过 `bin/gstack-ff-update` 做快进，这与会话更新的自动升级用的是同一份代码：能干净合并的本地改动能随更新一起带过去，而冲突的改动（或已暂存的改动、未合并的文件）会被存进一个 rescue ref，而不是留成冲突标记：
```bash
cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" || exit 1
{ [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ] && _p=$(git rev-parse --show-prefix 2>/dev/null) && [ -z "$_p" ] && [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; } || { echo "ERROR: $INSTALL_DIR is not a gstack checkout; nothing was changed. Re-run Step 2." >&2; exit 1; }
git fetch origin
# 与自动更新器相同的前置检查：按 bash 判断即将发布的版本要求的 Bun 下限，
# 无论这个工具 shell 是什么（zsh 不做单词拆分）。
HOLD=$(bash -c '. bin/gstack-bun-version.sh && gstack_bun_incoming_hold . origin/main' 2>/dev/null) && { case "$HOLD" in bun-version-unreadable*) echo "BUN_VERSION_UNREADABLE: $HOLD; nothing was changed" >&2 ;; *) echo "BUN_TOO_OLD: $HOLD; nothing was changed" >&2 ;; esac; exit 1; }
PRE_UPGRADE_COMMIT=$(git rev-parse HEAD)
echo "PRE_UPGRADE_COMMIT=$PRE_UPGRADE_COMMIT"
FF=$(bash bin/gstack-ff-update . origin/main); FF_RC=$?
echo "$FF"
case "$FF_RC" in
  0) if ./setup --refresh-registered; then echo "FF_OK"; else echo "SETUP_FAILED: git update succeeded; stop and inspect setup output (previous commit: $PRE_UPGRADE_COMMIT)" >&2; exit 1; fi ;;
  4) echo "FF_REFUSED" ;;
  *) echo "FF_STOPPED: $FF" >&2; exit 1 ;;
esac
```

setup 的 `--refresh-registered` 会刷新这个 checkout 登记过的每个安装（各宿主、全局的以及本项目的），先打印来源，末尾给出 `Upgrade summary`，每个安装一行。按打印出来的样子转述这些行。某行是 `failed`，表示那个宿主保留了之前的安装；给出它的重试命令，绝不要说所有宿主都已刷新。某行是 `skipped`，说明它属于另一个 checkout 或项目；把它的命令转告用户，不要自己运行。

如果输出以 `FF_OK` 结尾，升级就完成了——完全跳过下面的回退流程。当它前面那行是 `rescued <old> <new> refs/gstack/rescue/<oid> unmerged=<0|1>` 时，告诉用户他们冲突的本地改动已保存在那里，并转述脚本打印的 `Inspect`、`Export` 和 `Delete` 命令（导出到临时的 checkout 里用 `git apply -3`，绝不要在安装目录里 `stash apply`；`unmerged=1` 表示这份 rescue 需要人工解决）。
遇到 `FF_STOPPED`，停下并转述原因：什么都没有改动。
`ff-busy` 表示另一个 gstack 更新正在运行（过一分钟重试）；
`autostash-unrecoverable` 会指明挡路的是什么（本次发布新增的一个未跟踪文件，或另一个 git 命令）；`index-unreadable` 表示这个 checkout 的索引已损坏。
遇到 `BUN_TOO_OLD`，停下：让用户运行 `bun upgrade`，然后重新运行 /gstack-upgrade。
遇到 `BUN_VERSION_UNREADABLE`，停下：`bun --version` 没有打印出 gstack 能读到的版本，所以 `bun upgrade` 可能也跑不起来；让用户从 https://bun.sh 重新安装 Bun（在 Git Bash 或 macOS/Linux 终端里执行 `curl -fsSL https://bun.sh/install | bash`），确认 `bun --version` 打印出类似 1.4.2 的版本，然后重新运行 /gstack-upgrade（docs/troubleshooting.md#bun-version-unreadable）。
遇到 `SETUP_FAILED`，停下；保留用户的改动并报告恢复用的 commit。git 路径上没有 `.bak`。不要仅因为 setup 失败就进入分叉回退。只有遇到 `FF_REFUSED`（有本地 commit 或历史已分叉）时才进入它；网络/鉴权失败是停下修复，不是 reset。

**回退（仅快进被拒绝——有本地 commit 或历史分叉）。** `git reset
--hard` 会**毁掉**东西：即使工作区干净，只要有未推送的本地 commit，那些 commit 也会丢。所以要给它加门禁：

1. 在 `$INSTALL_DIR` 里运行 `git status --porcelain` 和 `git rev-list origin/main..HEAD --oneline`。
2. 如果两者都为空，reset 可证明是安全的——不用问，直接运行下面的回退代码块。
3. 否则通过 AskUserQuestion 询问（单向门——破坏性），逐条列出将被丢弃的东西：每个脏文件、每个未推送的 commit 的哈希和标题。选项：**A)** 丢弃它们并升级（reset）——必须给出明确的字母；**B)** 中止升级，让用户先抢救自己的工作（有本地 commit 时推荐）。绝不要在含糊的回复上继续。

```bash
cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" || exit 1
{ [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ] && _p=$(git rev-parse --show-prefix 2>/dev/null) && [ -z "$_p" ] && [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; } || { echo "ERROR: $INSTALL_DIR is not a gstack checkout; nothing was changed. Re-run Step 2." >&2; exit 1; }
# 可重新生成的渲染产物（setup 会重渲）永远不进 stash。
git checkout -- 'SKILL.md' '*/SKILL.md' '*/sections/*.md' 2>/dev/null || true
STASH_OUTPUT=$(git stash 2>&1)
git reset --hard origin/main
./setup --refresh-registered
```
如果 `$STASH_OUTPUT` 里包含“Saved working directory”，警告用户：“注意：本地改动已被 stash（修改过的生成文件 SKILL.md/sections 已先被丢弃——它们会在 setup 时重新生成）。在技能目录里运行 `git stash pop` 可以恢复你自己的改动。”

**对于 vendored 安装**（vendored、vendored-global）：
```bash
(cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: INSTALL_DIR=${INSTALL_DIR:-} is not a gstack install; nothing was changed. Re-run Step 2." >&2; exit 1; }
# 上一次崩溃的升级留下的陈旧 .bak 会让下面的 mv 把现装目录嵌进去，
# 失败恢复分支就会把那份陈旧备份“恢复”回来。它也可能是那次崩溃中
# 唯一完好的副本——中止并让人工检查，绝不悄悄删除。
[ -e "$INSTALL_DIR.bak" ] && { echo "ERROR: stale backup exists at $INSTALL_DIR.bak (from a previous failed upgrade?) — inspect it, salvage/remove it, then re-run." >&2; exit 1; }
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/gstack-upgrade.XXXXXX") || { echo "ERROR: mktemp failed — aborting upgrade (install untouched)." >&2; exit 1; }
git clone --depth 1 https://github.com/garrytan/gstack.git "$TMP_DIR/gstack" || { echo "ERROR: clone failed — aborting upgrade (install untouched)." >&2; rm -rf "$TMP_DIR"; exit 1; }
mv "$INSTALL_DIR" "$INSTALL_DIR.bak" || { rm -rf "$TMP_DIR"; exit 1; }
if mv "$TMP_DIR/gstack" "$INSTALL_DIR"; then
  if (cd "$INSTALL_DIR" && ./setup --refresh-registered); then
    rm -rf "$INSTALL_DIR.bak" "$TMP_DIR"
  else
    rm -rf "$INSTALL_DIR"
    mv "$INSTALL_DIR.bak" "$INSTALL_DIR" || { echo "ERROR: restore failed; backup retained." >&2; exit 1; }
    rm -rf "$TMP_DIR"
    echo "ERROR: setup failed; previous install restored." >&2
    exit 1
  fi
else
  mv "$INSTALL_DIR.bak" "$INSTALL_DIR"
  echo "ERROR: swap failed — previous install restored; upgrade aborted." >&2
  rm -rf "$TMP_DIR"
  exit 1
fi
```

### 步骤 4.5：处理本地 vendored 副本

使用步骤 2 得到的安装目录。检查是否还存在一份本地 vendored 副本，以及团队模式是否开启：

```bash
_RESOLVED_PRIMARY=$(cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" && pwd -P) || exit 1
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
LOCAL_GSTACK=""
if [ -n "$_ROOT" ] && [ -d "$_ROOT/.claude/skills/gstack" ]; then
  _RESOLVED_LOCAL=$(cd "$_ROOT/.claude/skills/gstack" && pwd -P)
  if [ "$_RESOLVED_LOCAL" != "$_RESOLVED_PRIMARY" ]; then
    LOCAL_GSTACK="$_ROOT/.claude/skills/gstack"
  fi
fi
_TEAM_MODE=$(~/.claude/skills/gstack/bin/gstack-config get team_mode 2>/dev/null || echo "false")
echo "LOCAL_GSTACK=$LOCAL_GSTACK"
echo "TEAM_MODE=$_TEAM_MODE"
```

**如果 `LOCAL_GSTACK` 非空且 `TEAM_MODE` 是 `true`：** 移除 vendored 副本。团队模式把全局安装当作唯一事实源。

```bash
(cd -- "${LOCAL_GSTACK:?LOCAL_GSTACK is not set: re-run the detection block above and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: LOCAL_GSTACK=${LOCAL_GSTACK:-} is not a gstack copy; nothing was changed." >&2; exit 1; }
_ROOT=${LOCAL_GSTACK%/.claude/skills/gstack}
{ [ "$_ROOT" != "$LOCAL_GSTACK" ] && cd -- "${_ROOT:?}" && _p=$(git rev-parse --show-prefix 2>/dev/null) && [ -z "$_p" ] && [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; } || { echo "ERROR: $LOCAL_GSTACK is not the vendored copy at the root of a git repository; nothing was changed." >&2; exit 1; }
git rm -r --cached .claude/skills/gstack/ 2>/dev/null || true
if ! grep -qF '.claude/skills/gstack/' .gitignore 2>/dev/null; then
  echo '.claude/skills/gstack/' >> .gitignore
fi
rm -rf "$LOCAL_GSTACK"
```
告诉用户：“已移除 `$LOCAL_GSTACK` 处的 vendored 副本（团队模式已启用——全局安装是事实源）。准备好后提交 `.gitignore` 的改动。”

**如果 `LOCAL_GSTACK` 非空且 `TEAM_MODE` 不是 `true`：** 从刚升级的主安装复制过来更新它（与 README 的 vendored 安装方式相同）：
```bash
(cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: INSTALL_DIR=${INSTALL_DIR:-} is not a gstack install; nothing was changed." >&2; exit 1; }
(cd -- "${LOCAL_GSTACK:?LOCAL_GSTACK is not set: re-run the detection block above and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: LOCAL_GSTACK=${LOCAL_GSTACK:-} is not a gstack copy; nothing was changed." >&2; exit 1; }
[ -e "$LOCAL_GSTACK.bak" ] && { echo "ERROR: stale vendored backup; inspect it before retrying." >&2; exit 1; }
mv "$LOCAL_GSTACK" "$LOCAL_GSTACK.bak" || exit 1
if cp -Rf "$INSTALL_DIR" "$LOCAL_GSTACK" && rm -rf "$LOCAL_GSTACK/.git" && (cd "$LOCAL_GSTACK" && ./setup --refresh-registered); then
  rm -rf "$LOCAL_GSTACK.bak"
  echo "LOCAL_SYNC_OK"
else
  rm -rf "$LOCAL_GSTACK"
  mv "$LOCAL_GSTACK.bak" "$LOCAL_GSTACK" || { echo "ERROR: restore failed; backup retained." >&2; exit 1; }
  echo "ERROR: sync failed; previous vendored copy restored." >&2
  exit 1
fi
```
只在出现 `LOCAL_SYNC_OK` 时告诉用户：“也更新了 `$LOCAL_GSTACK` 处的 vendored 副本——准备好后提交 `.claude/skills/gstack/`。”否则停下并报告恢复结果；不要继续跑迁移，也不要宣布成功。

### 步骤 4.75：运行版本迁移

`./setup` 完成后，运行旧版本到新版本之间各版本的迁移脚本。迁移处理 `./setup` 单独覆盖不到的状态修复（过期配置、孤立文件、目录结构变化）。

```bash
MIGRATIONS_DIR="${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}/gstack-upgrade/migrations"
: "${OLD_VERSION:?OLD_VERSION is not set: substitute the value Step 3 printed}"
if [ -d "$MIGRATIONS_DIR" ]; then
  for migration in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name 'v*.sh' -type f 2>/dev/null | sort -V); do
    # 从文件名提取版本：v0.15.2.0.sh → 0.15.2.0
    m_ver="$(basename "$migration" .sh | sed 's/^v//')"
    # 当迁移版本比旧版本更新时运行
    # （对段数相同的点分版本，简单字符串比较即可）
    if [ "$OLD_VERSION" != "unknown" ] && [ "$(printf '%s\n%s' "$OLD_VERSION" "$m_ver" | sort -V | head -1)" = "$OLD_VERSION" ] && [ "$OLD_VERSION" != "$m_ver" ]; then
      echo "Running migration $m_ver..."
      # GSTACK_INSTALL_DIR：会清理安装目录（不只是 ~/.gstack 状态）的迁移
      # 在未设置时默认用 ~/.claude/skills/gstack——没有它，
      # 仓库内安装会静默地什么都不做。
      GSTACK_INSTALL_DIR="$INSTALL_DIR" bash "$migration" || echo "  Warning: migration $m_ver had errors (non-fatal)"
    fi
  done
fi
```

迁移是 `gstack-upgrade/migrations/` 里幂等的 bash 脚本。每个命名为 `v{VERSION}.sh`，只在从更旧版本升级时运行。新增迁移的方法见 CONTRIBUTING.md。

### 步骤 4.8：停掉任何陈旧的 daemon（无条件）

升级前启动的 browse daemon 会一直用旧二进制的代码提供服务，直到被停掉——它能挺过 `git reset --hard` 和 `./setup`，因为运行中的进程握着旧的可执行文件。始终运行这一步，使用步骤 2 检测到的安装目录。

```bash
INSTALL_DIR_PLACEHOLDER="<install dir from Step 2>"
NEW_HASH=$(cat "$INSTALL_DIR_PLACEHOLDER/browse/dist/.version" 2>/dev/null || echo "")
_STATE_FILE="${BROWSE_STATE_FILE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/browse.json}"
if [ -z "$NEW_HASH" ] || [ ! -f "$_STATE_FILE" ]; then
  echo "DAEMON_CHECK=none (no state file or no fresh build hash)"
else
  DAEMON_PID=$(sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$_STATE_FILE" | head -1)
  DAEMON_PORT=$(sed -n 's/.*"port"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$_STATE_FILE" | head -1)
  OLD_HASH=$(sed -n 's/.*"binaryVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$_STATE_FILE" | head -1)
  if [ -z "$DAEMON_PID" ] || ! kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo "DAEMON_CHECK=dead (no live daemon to stop)"
  elif [ "$OLD_HASH" = "$NEW_HASH" ]; then
    echo "DAEMON_CHECK=current (daemon already runs the new binary)"
  elif curl -fsS --max-time 2 "http://127.0.0.1:$DAEMON_PORT/health" 2>/dev/null | grep -q '"status":"healthy"'; then
    echo "DAEMON_CHECK=stale-responsive pid=$DAEMON_PID hash=${OLD_HASH:-unknown} -> $NEW_HASH"
    "$INSTALL_DIR_PLACEHOLDER/browse/dist/browse" stop && echo "DAEMON_STOPPED=yes"
  else
    echo "DAEMON_CHECK=stale-busy pid=$DAEMON_PID hash=${OLD_HASH:-unknown} -> $NEW_HASH"
  fi
fi
```

运行前把 `<install dir from Step 2>` 换成实际的安装目录。按下面的方式解读 `DAEMON_CHECK` 结果：

1. **`stale-responsive` + `DAEMON_STOPPED=yes`：** 告诉用户“已停掉旧的 browse daemon（二进制 {OLD_HASH} → {NEW_HASH}）。下一次 browse 命令会用新二进制启动一个全新的 daemon。”
2. **`stale-busy`：** daemon 跑的是旧二进制，但正在干活——让着它，升级期间绝不杀掉忙碌的 daemon。告诉用户：“有个 browse daemon 仍在跑升级前的二进制（{OLD_HASH} → {NEW_HASH}），但此刻正忙。等它结束后用 `browse stop` 停掉它——或者立刻用 `browse --force-restart stop` 强制停掉（会丢失那个会话的标签页/cookie/登录状态）。”
3. **`none` / `dead` / `current`：** 无需处理——什么都别说。

### 步骤 5：写入标记 + 清理缓存

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"
echo "$OLD_VERSION" > "$GSTACK_STATE_ROOT"/just-upgraded-from
rm -f "$GSTACK_STATE_ROOT"/last-update-check
rm -f "$GSTACK_STATE_ROOT"/update-snoozed
```

### 步骤 6：展示新变化

读取 `$INSTALL_DIR/CHANGELOG.md`。找出旧版本到新版本之间的所有版本条目。按主题分组，总结成 5-7 条要点。不要堆砌——聚焦用户能感知的变化。内部重构除非很重要，否则跳过。

四个字段的情况：把 `git -C "$INSTALL_DIR" log --oneline <PRE_UPGRADE_COMMIT>..HEAD` 总结成（≤7 条要点）"gstack v{old}, main at {sha}"。

格式：
```
gstack v{new} — upgraded from v{old}!

What's new:
- [bullet 1]
- [bullet 2]
- ...

Happy shipping!
```

### 步骤 7：继续

展示完新变化之后，继续执行用户原本调用的那个技能。升级已完成——不需要再做别的。

---

## 独立使用

当直接以 `/gstack-upgrade` 调用时（不是从前言触发）：

1. 强制做一次新的更新检查（绕过缓存）：
```bash
~/.claude/skills/gstack/bin/gstack-update-check --force 2>/dev/null || \
.claude/skills/gstack/bin/gstack-update-check --force 2>/dev/null || true
```
用输出判断是否有可用升级。

2. 如果是 `UPGRADE_AVAILABLE`（三个或四个字段）：执行上面的步骤 2-6。

   如果是 `CHECK_FAILED ...`：读不到远端版本，因此更新状态未知。展示那一行（它会指出失败的 URL），并告诉用户检查失败了；绝不要报告“已经在最新版本”。停下。

3. 如果没有输出（主安装已是最新）：检查是否存在陈旧的本地 vendored 副本。

运行上面的步骤 2 bash 块，检测主安装的类型和目录（`INSTALL_TYPE` 和 `INSTALL_DIR`）。然后运行上面的步骤 4.5 检测 bash 块，检查本地 vendored 副本（`LOCAL_GSTACK`）和团队模式状态（`TEAM_MODE`）。

**如果 `LOCAL_GSTACK` 为空**（没有本地 vendored 副本）：告诉用户“你已经在最新版本（v{version}）。”

**如果 `LOCAL_GSTACK` 非空且 `TEAM_MODE` 是 `true`：** 用上面步骤 4.5 的团队模式移除 bash 块移除 vendored 副本。告诉用户：“全局 v{version} 已是最新。已移除陈旧的 vendored 副本（团队模式已启用）。准备好后提交 `.gitignore` 的改动。”

**如果 `LOCAL_GSTACK` 非空且 `TEAM_MODE` 不是 `true`**，比较版本：
```bash
PRIMARY_VER=$(cat "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}/VERSION" 2>/dev/null || echo "unknown")
LOCAL_VER=$(cat "${LOCAL_GSTACK:?LOCAL_GSTACK is not set: re-run the Step 4.5 detection block}/VERSION" 2>/dev/null || echo "unknown")
echo "PRIMARY=$PRIMARY_VER LOCAL=$LOCAL_VER"
```