---
id: mattpocock/implement
title: implement
description: 依据规格或一组工单实现一项工作。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/implement/SKILL.md
snapshotPath: source-snapshots/mattpocock/implement/SKILL.md
license: MIT
translatedAt: 2026-10-30
invocation: user
---

实现用户通过规格或工单描述的工作。

如果用户传了工单引用，从议题跟踪器取出它，并在开始前说明它的标题。如果引用有歧义，先问清楚。

尽可能在事先约定的接缝处用 "tdd" 调用 Skill 工具。

定期跑类型检查、定期跑单个测试文件，最后完整跑一次测试套件。

完成后，用 "code-review" 调用 Skill 工具来审查这部分工作。

把工作提交到当前分支。