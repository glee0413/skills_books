---
id: mattpocock/teach/mission-format
title: mission-format
description: 说明 `MISSION.md` 的写法：它记录用户学习某个主题的真实原因，并约束后续所有教学决策。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/teach/MISSION-FORMAT.md
snapshotPath: source-snapshots/mattpocock/teach/mission-format.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/teach
---

# MISSION.md 的格式

`MISSION.md` 位于工作区根目录。它记录用户学习这个主题的_原因_。每一个教学决策（接下来教什么、呈现哪些资源、设计哪些练习）都应当能追溯回这份文档。

## 模板

```md
# Mission: {Topic}

## Why
{1-3 句话。用户正在追求的具体现实目标。掌握这项技能之后，他们的生活或工作会发生什么变化？避免“为了更好地理解 X”这类抽象说法，追问背后的结果。}

## Success looks like
- {用户将能够做到的一件具体、可观察的事}
- {另一件具体的事}
- {…}

## Constraints
- {时间、预算、既有承诺、学习偏好，任何会约束做法的东西}

## Out of scope
- {用户明确暂时不想碰的邻近主题，用来保护最近发展区}
```

## 规则

- **一个工作区一个使命。** 如果用户想学两件互不相关的事，那就是两个工作区。
- **具体胜于抽象。**“十月前跑完半程马拉松”好过“变得更强壮”。“把一个 Rust CLI 交付给我的团队”好过“学习 Rust”。
- **对含糊其辞要顶回去。** 如果用户说不清为什么，先采访他们，再动笔写任何东西。糟糕的使命比没有使命更糟。
- **现实变了就修订。** 使命会变。当用户的目标移动时，更新这个文件：不要让一份过期的使命继续引导以后的会话。
- **保持简短。** 如果 `MISSION.md` 超过一屏，它就不再是指南针，而变成了计划。