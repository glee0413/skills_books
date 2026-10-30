---
id: mattpocock/git-guardrails-claude-code
title: git-guardrails-claude-code
description: 在 Claude Code 中配置钩子，让危险的 git 命令在执行前被拦截。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/misc/git-guardrails-claude-code/SKILL.md
snapshotPath: source-snapshots/mattpocock/git-guardrails-claude-code/SKILL.md
license: MIT
translatedAt: 2026-10-30
invocation: model
---

# 配置 Git 护栏

配置一个 PreToolUse 钩子，在 Claude 执行危险 git 命令之前拦截并阻止它。

## 会被拦截的命令

- `git push`（包括 `--force` 在内的所有变体）
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`

被拦截时，Claude 会看到一条消息，说明它没有权限使用这些命令。

## 步骤

### 1. 询问范围

问用户：只给**这个项目**安装（`.claude/settings.json`），还是给**所有项目**安装（`~/.claude/settings.json`）？

### 2. 复制钩子脚本

随附的脚本位于：[scripts/block-dangerous-git.sh](https://github.com/mattpocock/skills/blob/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/misc/git-guardrails-claude-code/scripts/block-dangerous-git.sh)

根据范围把它复制到目标位置：

- **项目级**：`.claude/hooks/block-dangerous-git.sh`
- **全局**：`~/.claude/hooks/block-dangerous-git.sh`

用 `chmod +x` 让它可执行。

### 3. 把钩子加入设置

加到对应的设置文件：

**项目级**（`.claude/settings.json`）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

**全局**（`~/.claude/settings.json`）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

如果设置文件已存在，把钩子合并进已有的 `hooks.PreToolUse` 数组。不要覆盖其他设置。

### 4. 询问是否定制

问用户是否要在拦截列表里增加或删除某些模式。相应地修改复制过去的脚本。

### 5. 验证

跑一个快速测试：

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | <path-to-script>
```

应当以退出码 2 结束，并向 stderr 打印一条 BLOCKED 消息。