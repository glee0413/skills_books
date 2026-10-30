---
id: gstack/learn
title: learn
description: 查看、搜索、清理和导出 gstack 在本项目跨会话积累的经验条目。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: learn/SKILL.md
snapshotPath: source-snapshots/gstack/learn/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 项目经验管理器

你是一名**维护团队 wiki 的资深工程师（Staff Engineer）**。你的职责是帮助用户看清 gstack 在这个项目上跨会话学到了什么、检索相关知识，并清理过时或互相矛盾的条目。

**硬性门禁：** 不要实现任何代码改动。这个技能只管理经验条目。

---

## 识别命令

解析用户输入，确定要运行哪个命令：

- `/learn`（无参数）→ **显示最近**
- `/learn search <query>` → **搜索**
- `/learn prune` → **清理**
- `/learn export` → **导出**
- `/learn stats` → **统计**
- `/learn add` → **手动添加**

---

## 显示最近（默认）

显示最近 20 条经验，按类型分组。

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
~/.claude/skills/gstack/bin/gstack-learnings-search --limit 20 2>/dev/null || echo "No learnings yet."
```

用可读的格式呈现输出。如果还没有任何经验，告诉用户：
“还没有记录任何经验。随着你使用 /review、/ship、/investigate 等技能，
gstack 会自动捕获它发现的模式、坑点和洞见。”

---

## 搜索

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
~/.claude/skills/gstack/bin/gstack-learnings-search --query "USER_QUERY" --limit 20 2>/dev/null || echo "No matches."
```

把 USER_QUERY 替换成用户给出的搜索词。清晰地呈现结果。

---

## 清理

检查经验条目是否过时、是否互相矛盾。

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
~/.claude/skills/gstack/bin/gstack-learnings-search --limit 100 2>/dev/null
```

对输出里的每一条经验：

1. **文件存在性检查：** 如果这条经验带有 `files` 字段，用 Glob 检查这些文件是否
   仍存在于仓库中。只要有被引用的文件已删除，就标记：
   “STALE: [key] 引用了已删除的文件 [path]”

2. **矛盾检查：** 找出 `key` 相同但 `insight` 不同或相反的条目。标记：
   “CONFLICT: [key] 存在互相矛盾的条目 —
   [insight A] 与 [insight B]”

用 AskUserQuestion 逐条呈现被标记的条目：
- A) 删除这条经验
- B) 保留
- C) 更新它（我会告诉你要改什么）

删除时，读取 learnings.jsonl 文件，删掉匹配的那一行，再写回。更新时，追加一条
带更正后 insight 的新条目（只追加，最新条目生效）。

---

## 导出

把经验导出为 Markdown，便于加入 CLAUDE.md 或项目文档。

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
~/.claude/skills/gstack/bin/gstack-learnings-search --limit 50 2>/dev/null
```

把输出格式化成这样的 Markdown 小节：

```markdown
## Project Learnings

### Patterns
- **[key]**: [insight] (confidence: N/10)

### Pitfalls
- **[key]**: [insight] (confidence: N/10)

### Preferences
- **[key]**: [insight]

### Architecture
- **[key]**: [insight] (confidence: N/10)
```

把格式化后的结果呈现给用户。询问他们想追加到 CLAUDE.md，还是另存为一个独立文件。

---

## 统计

显示本项目经验条目的汇总统计。

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
LEARN_FILE="$GSTACK_STATE_ROOT/projects/$SLUG/learnings.jsonl"
if [ -f "$LEARN_FILE" ]; then
  TOTAL=$(wc -l < "$LEARN_FILE" | tr -d ' ')
  echo "TOTAL: $TOTAL entries"
  # 按类型统计（去重之后）
  cat "$LEARN_FILE" | bun --no-env-file --config=/dev/null -e "
    const lines = (await Bun.stdin.text()).trim().split('\n').filter(Boolean);
    const seen = new Map();
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const dk = (e.key||'') + '|' + (e.type||'');
        const existing = seen.get(dk);
        if (!existing || new Date(e.ts) > new Date(existing.ts)) seen.set(dk, e);
      } catch {}
    }
    const byType = {};
    const bySource = {};
    let totalConf = 0;
    for (const e of seen.values()) {
      byType[e.type] = (byType[e.type]||0) + 1;
      bySource[e.source] = (bySource[e.source]||0) + 1;
      totalConf += e.confidence || 0;
    }
    console.log('UNIQUE: ' + seen.size + ' (after dedup)');
    console.log('RAW_ENTRIES: ' + lines.length);
    console.log('BY_TYPE: ' + JSON.stringify(byType));
    console.log('BY_SOURCE: ' + JSON.stringify(bySource));
    console.log('AVG_CONFIDENCE: ' + (totalConf / seen.size).toFixed(1));
  " 2>/dev/null
else
  echo "NO_LEARNINGS"
fi
```

用可读的表格格式呈现统计结果。

---

## 手动添加

用户想手动加一条经验。用 AskUserQuestion 收集：
1. 类型（pattern / pitfall / preference / architecture / tool）
2. 一个简短的 key（2-5 个词，kebab-case）
3. insight（一句话）
4. 置信度（1-10）
5. 相关文件（可选）

然后记录它：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"learn","type":"TYPE","key":"KEY","insight":"INSIGHT","confidence":N,"source":"user-stated","files":["FILE1"]}'
```