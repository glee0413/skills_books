---
id: mattpocock/writing-for-agents/skill-mechanics
title: skill-mechanics
description: 技能专属的写作分支，说明 frontmatter、模型可调用与用户调用的取舍，以及路由技能。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/writing-for-agents/SKILL-MECHANICS.md
snapshotPath: source-snapshots/mattpocock/writing-for-agents/skill-mechanics.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/writing-for-agents
---

# 技能机制

[`writing-for-agents`](SKILL.md) 里技能专属的那一支：当文档是一个技能时有什么不同（frontmatter、调用方式的选择，以及路由技能）。写作的其他方面都是 `SKILL.md` 里的通用参考。

## 调用方式

有两个选择，各自交换这两种负载：

- **模型可调用（model-invoked）** 的技能保留 `description`，这样 agent 可以自主触发它，其他技能也能够到它。你依然可以输入它的名字：模型可调用总是_包含_人的可达性；description 只会增加 agent 的发现能力，绝不会拿走人的。description 是技能顶层的上下文指针，被迫一直保持加载：用永久的上下文负载换取可发现性。一个内容全是参考的模型可调用技能，也是共享参考的一个归宿：别的技能可以调用它，于是多个技能都需要的参考只存在于一处。机制上：省略 `disable-model-invocation`，并写一个面向模型、承载触发分支的 description（`SKILL.md` 里关于指针写法的规则完全适用）。
- **用户调用（user-invoked）** 的技能把 description 从 agent 的可达范围里拿掉：只有人输入它的名字才能调用它，其他技能都够不到。上下文负载为零，但它花的是认知负载：你就是那个必须记得它存在的索引。机制上：设置 `disable-model-invocation: true`；`description` 变成面向人的：一行摘要，剥掉触发列表。

只有当 agent 必须自己够到该技能，或者另一个技能必须够到时，才选模型可调用。如果它只会被手工触发，就做成用户调用，不付任何上下文负载。

两个用户调用技能都需要的共享参考，不能放在它们任何一个里面：没有 description，它们谁也触发不了谁。把它推到技能体系之外的普通文件里：任何技能都能指向的外部参考。

## 按调用方式拆分

拆分里的调用方式切法（序列切法在 `SKILL.md` 里）：当你有一个独特的引导词、它应当能自行触发这个技能时（一个你在提示词里真正会用的触发词），或者另一个技能必须够到它时，就拆出一个模型可调用的技能。你要为新常驻加载的 description 付上下文负载，所以那份独立可达性必须值回这个价。

## 路由技能

当用户调用的技能多到你记不过来时，堆积起来的认知负载可以由一个**路由技能（router skill）** 治好：一个用户调用的技能，它点名其他技能以及何时该去够每一个，于是人只需要记住一个技能，而不是很多个。它只能提示，永远不能触发它们：用户调用的技能没有 description，除了人，什么也够不到它们。