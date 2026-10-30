---
id: gstack/careful
title: careful
description: 在执行 Bash 与 PowerShell 命令前拦截破坏性操作，按风险等级询问或直接拒绝。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: careful/SKILL.md
snapshotPath: source-snapshots/gstack/careful/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /careful — 破坏性命令护栏

安全模式现在**已激活**。每条 Bash 和 PowerShell 命令在运行前都会检查是否命中破坏性模式。一旦检测到破坏性命令，你会先收到警告，然后可以自行选择继续或取消。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"careful","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 受保护的操作

| 模式 | 示例 | 风险 |
|---------|---------|------|
| `rm -rf` / `rm -r` / `rm --recursive` | `rm -rf /var/data` | 递归删除 |
| `DROP TABLE` / `DROP DATABASE` | `DROP TABLE users;` | 数据丢失 |
| `TRUNCATE` | `TRUNCATE orders;` | 数据丢失 |
| `git push --force` / `-f` | `git push -f origin main` | 改写历史 |
| `git reset --hard` | `git reset --hard HEAD~3` | 未提交的工作丢失 |
| `git checkout .` / `git restore .` | `git checkout .` | 未提交的工作丢失 |
| `kubectl delete` | `kubectl delete pod` | 影响生产环境 |
| `docker rm -f` / `docker system prune` | `docker system prune -a` | 容器/镜像丢失 |

## PowerShell 与 cmd（Windows）

这个钩子同时检查 PowerShell 工具（Claude Code 在 Windows 上的主要 shell），以及从 Bash 启动的任何 `pwsh`/`powershell`/`cmd`。匹配时不区分大小写，覆盖出现在命令位置的别名，接受参数前缀（`-r`、`-fo`），并会剥掉 cmd 的 `^` 转义。上表中的每一行在这里同样适用。

| 模式 | 示例 |
|---------|---------|
| `Remove-Item`/`rm`/`ri`/`del`/`erase`/`rd`/`rmdir` + `-Recurse` 或 `-Force` | `gci \| ri -r -fo` |
| cmd 的 `rd /s`、`rmdir /s`、`del /s`、`erase /s` | `cmd /c rd /s /q C:\proj` |
| `Format-Volume`、`Clear-Disk`、`Clear-Content`、`[IO.Directory]::Delete`、`[IO.File]::Delete` | `Clear-Disk -Number 1` |
| `-EncodedCommand`、`iex`、启动 shell 的 `Start-Process`、`& $cmd`（无法被检查） | `irm $url \| iex` |

**在 PowerShell 上只能尽力而为。** 字符串匹配看不到运行时才拼出来的命令。想要硬性拦截，请添加 Claude Code 的权限拒绝规则，它会解析 PowerShell 及其别名：在 `.claude/settings.json` 里写 `"deny": ["PowerShell(Remove-Item *)"]`。钩子通过 `bash` 运行，所以 Windows 上需要 Git Bash。

## 安全例外

以下模式无需警告即可放行：
- `rm -rf node_modules` / `.next` / `dist` / `__pycache__` / `.cache` / `build` / `.turbo` / `coverage`

## 工作方式

钩子从工具输入的 JSON 里读出 `tool_name` 和命令，逐条对照上面的模式；若命中，就返回一个 `hookSpecificOutput` 负载，其中 `permissionDecision: "ask"` 并附带警告理由（这个决定必须嵌在 `hookSpecificOutput` 下——Claude Code 会忽略顶层的 `permissionDecision`）。MEDIUM 级警告你随时可以覆盖并继续执行。

## HIGH 级（硬拒绝）

有两种灾难性形态是**直接拒绝**而非询问：对 `/`、`~` 或 `$HOME` 本身执行 `rm -r`/`-R`，以及向仓库的**默认分支**强制推送。只处理 SIMPLE 命令（不含 `;`、`&&`、`||`、`|`、换行）——复合形态会落到 MEDIUM 的询问；`--force-with-lease` 永远不算 HIGH。这是一道尽力而为的提示性硬拦截，不是策略边界：逃生出口就是结束这个自愿开启、按会话生效的 /careful 会话。

## 项目模式（只能新增）

在 `~/.gstack/careful-patterns.txt`（全局）或 `~/.gstack/projects/<slug>/careful-patterns.txt`（按项目）里添加警告规则——每行一条 POSIX ERE，允许 `#` 注释。这些规则在内置规则族之后查询，因此配置只能新增规则，永远无法压制基线警告。无效的正则行会被跳过。

要停用，结束当前对话或新开一个对话即可。钩子按会话生效。