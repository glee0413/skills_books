---
id: gstack/unfreeze
title: unfreeze
description: 清除 /freeze 设置的冻结边界，让所有目录重新可以编辑。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: unfreeze/SKILL.md
snapshotPath: source-snapshots/gstack/unfreeze/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /unfreeze — 清除冻结边界

移除 `/freeze` 设置的编辑限制，让所有目录重新可以编辑。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"unfreeze","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 清除边界

```bash
bash "$HOME/.claude/skills/gstack/freeze/bin/freeze-state.sh" clear
```

这是用户显式要求的移除，不是调查结束后的清理。共享的写入器会把它与获取、替换和按属主校验的释放串行化。遇到 `FREEZE_BUSY` 或意外状态时，什么都不要动，报告恢复流程；绝不要直接删除状态文件或一个可能仍然活跃的变更锁。

把结果告诉用户。注意 `/freeze` 的钩子仍然注册在这个会话上——只是因为没有状态文件，它们会放行一切。要重新冻结，再运行一次 `/freeze`。