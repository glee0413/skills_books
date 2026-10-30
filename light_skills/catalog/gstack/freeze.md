---
id: gstack/freeze
title: freeze
description: 把本次会话的文件编辑锁定在一个目录内，越界的 Edit、Write 和 NotebookEdit 会被直接拒绝。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: freeze/SKILL.md
snapshotPath: source-snapshots/gstack/freeze/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /freeze — 将编辑限制在一个目录内

把文件编辑锁定到指定目录。任何落在允许路径之外的 Edit、Write 或 NotebookEdit 操作都会被**阻止**（而不只是警告）。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"freeze","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 设置

询问用户要把编辑限制在哪个目录。使用 AskUserQuestion：

- 问题：“要把编辑限制在哪个目录？这个路径之外的文件都会被阻止编辑。”
- 文本输入（不是多选题）——由用户自己输入路径。

用户给出目录路径之后：

用共享的状态写入器设置用户选定的边界。它会解析出物理绝对路径，并把替换操作与调查清理串行化：
```bash
bash "$HOME/.claude/skills/gstack/freeze/bin/freeze-state.sh" set "<user-provided-path>"
```

只有辅助脚本成功时才报告成功。遇到 `FREEZE_BUSY` 或意外状态时，保留它，并请用户等活跃的写入方结束后再检查恢复流程；绝不要直接写入或删除状态文件。

告诉用户：“编辑现在被限制在 `<path>/`。这个目录之外的任何 Edit、Write 或
NotebookEdit 都会被阻止。要更改边界，再运行一次 `/freeze`。
要移除限制，运行 `/unfreeze`。”

## 它如何工作

钩子从 Edit/Write 工具的输入 JSON 里读取 `file_path`，或从 NotebookEdit（Jupyter notebook）调用里读取 `notebook_path`（与 /careful 共用同一个真实 JSON 提取器——只有一份代码，两个钩子都引用它），然后检查路径是否以 freeze 目录开头。如果不是，就返回一个带 `permissionDecision: "deny"` 的 `hookSpecificOutput` 载荷来阻止该操作（要嵌套在 `hookSpecificOutput` 下——Claude Code 会忽略顶层的 `permissionDecision`）。

极性是失效关闭（fail-closed）：钩子无法解析的工具载荷会被拒绝，而不是放行——一个失效就开放的边界不叫边界。能解析但不含任何路径字段的载荷（非文件类工具）则放行。拒绝信息会写明工具、路径字段、边界和 `/unfreeze`。符号链接会解析到它的最后一个组成部分，因此一个位于边界内、却指向边界外的符号链接，会按它的目标来检查。

freeze 边界会一直保留，直到通过状态文件显式移除。钩子脚本在每次 Edit/Write/NotebookEdit 调用时都会读取它。边界路径可以包含空格。

## 说明

- freeze 目录末尾的 `/` 可以避免 `/src` 匹配到 `/src-old`
- Freeze 只作用于 Edit、Write 和 NotebookEdit——Read、Bash、PowerShell、Glob、Grep 不受影响
- 这防的是误改，不是安全边界——`sed` 或 `Set-Content` 这类 Bash 或 PowerShell 命令仍然可以修改边界外的文件
- 要停用请运行 `/unfreeze`；结束或杀掉一次对话不会移除已持久化的状态