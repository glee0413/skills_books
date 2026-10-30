---
id: mattpocock/handoff
title: handoff
description: 把当前对话压缩成一份交接文档，供另一个 agent 接手继续工作。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/handoff/SKILL.md
snapshotPath: source-snapshots/mattpocock/handoff/SKILL.md
license: MIT
translatedAt: 2026-10-30
invocation: user
---

写一份交接文档，总结当前对话，让一个全新的 agent 能接手继续工作。保存到用户操作系统的临时目录（`$TMPDIR`，没有就用 `/tmp`；Windows 上是 `%TEMP%`），不要放在当前工作区。

在文档里包含一个 "suggested skills" 小节，写明下一个 agent 应该为哪些技能调用 Skill 工具。

不要重复其他产物（规格、计划、ADR、issue、commit、diff）里已经记录的内容。改用路径或 URL 引用它们。

隐去任何敏感信息，例如 API 密钥、口令或个人可识别信息。

如果用户传了参数，把它们当作对下一次会话将关注什么的描述，并据此调整文档。