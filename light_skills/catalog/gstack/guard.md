---
id: gstack/guard
title: guard
description: 同时开启破坏性命令警告和目录级编辑限制，相当于把 `/careful` 与 `/freeze` 合成一个命令。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: guard/SKILL.md
snapshotPath: source-snapshots/gstack/guard/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /guard — 完整安全模式

同时启用破坏性命令警告和目录级编辑限制。相当于把 `/careful` 与 `/freeze` 合成一个命令。

**依赖说明：** 这个技能引用了同级 `/careful` 和 `/freeze` 技能目录中的钩子脚本。两者都必须安装（gstack 的 setup 脚本会把它们一起装好）。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"guard","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 设置

询问用户要把编辑限制在哪个目录。使用 AskUserQuestion：

- 问题：“Guard 模式：要把编辑限制在哪个目录？破坏性命令警告始终开启。所选路径之外的文件会被阻止编辑。”
- 文本输入（不是多选题）——由用户自己输入路径。

用户给出目录路径之后：

用共享写入器设置用户选定的边界，它会解析出物理绝对路径，并把替换操作与调查清理串行化：
```bash
bash "$HOME/.claude/skills/gstack/freeze/bin/freeze-state.sh" set "<user-provided-path>"
```

辅助脚本失败时，不要声称边界已经生效。保留状态并报告恢复方式；绝不要绕过共享写入器去直接写入或删除。

告诉用户：
- “**Guard 模式已激活。**现在有两层防护在运行：”
- “1. **破坏性命令护栏** —— rm -rf、DROP TABLE、force-push 等会在执行前警告（可以覆盖）；灾难性形态（递归删除 `/` 或 `~`、向默认分支 force-push）会被硬性拒绝”
- “2. **编辑边界** —— 文件编辑被限制在 `<path>/`。这个目录之外的编辑会被阻止。”
- “要移除持久化的编辑边界，运行 `/unfreeze`。结束会话会停掉它的钩子，但不会删除那个边界。”

## 受保护的内容

破坏性命令模式的完整清单和安全例外见 `/careful`。
编辑边界的执行方式见 `/freeze`。