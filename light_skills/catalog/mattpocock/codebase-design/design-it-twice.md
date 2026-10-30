---
id: mattpocock/codebase-design/design-it-twice
title: design-it-twice
description: 用多个并行子代理把同一个模块的接口设计成几种截然不同的方案，再按深度、局部性与接缝位置比较。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/codebase-design/DESIGN-IT-TWICE.md
snapshotPath: source-snapshots/mattpocock/codebase-design/design-it-twice.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/codebase-design
---

# 设计两遍

当用户想为选定的深化候选探索备选接口时，使用这个并行子代理模式。出自 Ousterhout 的“Design It Twice”：你的第一个想法不太可能是最好的。

使用 [SKILL.md](SKILL.md) 里的词汇：**module**、**interface**、**seam**、**adapter**、**leverage**。

## 流程

### 1. 框定问题空间

在生成子代理之前，为选定的候选写一份面向用户的问题空间说明：

- 任何新接口都需要满足的约束
- 它会依赖的依赖项，以及它们属于哪个类别（见 [DEEPENING.md](deepening.md)）
- 一段粗略的示意性代码草图，用来给约束提供落点，它不是提案，只是让约束变具体的一种方式

把这份说明给用户看，然后立刻进入第 2 步。用户一边读一边想，子代理在同时工作。

### 2. 生成子代理

并行生成 3 个以上子代理。每一个都必须为深化后的模块产出一个**截然不同**的接口。

给每个子代理一份单独的技术简报（文件路径、耦合细节、来自 [DEEPENING.md](deepening.md) 的依赖类别、接缝后面坐着什么）。这份简报独立于第 1 步里面向用户的问题空间说明。给每个 agent 一个不同的设计约束：

- Agent 1：“把接口最小化：最多瞄准 1–3 个入口点。最大化每个入口点的杠杆。”
- Agent 2：“最大化灵活性：支持多种用例和扩展。”
- Agent 3：“为最常见的调用方优化：让默认情况变得微不足道。”
- Agent 4（如适用）：“围绕端口与适配器来设计跨接缝的依赖。”

在简报里同时带上 [SKILL.md](SKILL.md) 的词汇和 GLOSSARY.md 的词汇，好让每个子代理命名时都与架构语言和项目的领域语言保持一致。

每个子代理输出：

1. 接口（类型、方法、参数，加上不变量、顺序、错误模式）
2. 用法示例，展示调用方怎么用它
3. 实现在接缝后面藏了什么
4. 依赖策略与适配器（见 [DEEPENING.md](deepening.md)）
5. 取舍：杠杆在哪里高，在哪里薄

### 3. 呈现与比较

依次呈现各个设计，让用户能逐个吸收，然后用散文的方式比较它们。从**深度**（接口处的杠杆）、**局部性**（改动集中在哪里）和**接缝位置**三个角度做对照。

比较之后，给出你自己的推荐：你认为哪个设计最强，为什么。如果不同设计中的元素能很好地结合，提出一个混合方案。要有观点：用户想要的是一个有力的判断，不是一份菜单。