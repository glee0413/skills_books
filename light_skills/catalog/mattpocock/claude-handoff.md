---
id: mattpocock/claude-handoff
title: claude-handoff
description: 把当前对话交接给一个全新的后台代理，让它立刻接手继续干活。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/in-progress/claude-handoff/SKILL.md
snapshotPath: source-snapshots/mattpocock/claude-handoff/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

写一份当前对话的交接摘要，让一个新的 agent 能接着干。把它保存到用户操作系统的临时目录，然后启动一个后台代理，用这份摘要作为它的提示词：`claude --bg --name "<descriptive name>" -- "$(cat <summary file>)"`。以文件形式传入，可以避免 shell 执行摘要里的反引号或展开其中的 `$`。它从当前工作目录启动并立即返回；用户用 `claude agents` 来管理它。

始终传入 `-n`/`--name` 并给一个有描述性的名字（例如 `--name "Fix login bug"`）；它设置显示名称，会出现在任务列表、会话选择器和终端标题里。

在摘要里加入一个“建议使用的技能”小节，写明下一个 agent 应该为哪些技能调用 Skill 工具。

不要重复已经记录在其他产物（规格、计划、ADR、issue、提交、diff）里的内容。改用路径或 URL 引用它们。

抹掉任何敏感信息，例如 API key、密码或个人身份信息，因为这份摘要会成为 agent 的提示词。

如果用户传入了参数，把它们当作对下一次会话要聚焦什么的描述，并据此裁剪摘要。