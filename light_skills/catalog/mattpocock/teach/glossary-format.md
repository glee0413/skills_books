---
id: mattpocock/teach/glossary-format
title: glossary-format
description: 规定教学工作区里 GLOSSARY.md 的结构与编写规则。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/teach/GLOSSARY-FORMAT.md
snapshotPath: source-snapshots/mattpocock/teach/glossary-format.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/teach
---

# GLOSSARY.md 格式

`GLOSSARY.md` 是这个教学工作区的标准语言。所有讲解、练习和学习记录都应当遵守它的术语。构建术语表本身就是学习的一部分：把一个概念压缩成一条紧致的定义，正是用户理解了它的证据。

## 结构

```md
# {Topic} 术语表

{用一两句话说明这份术语表覆盖的主题。}

## 术语

**Hypertrophy（肌肥大）**：
在反复的训练课中，由机械张力和代谢压力驱动的肌肉增长。
_避免使用_：Bulking、getting big

**Progressive overload（渐进超负荷）**：
通过负荷、训练量或强度，随着时间系统地提高对肌肉的要求。
_避免使用_：Pushing harder、levelling up

**RPE (Rate of Perceived Exertion，主观用力程度)**：
对一组训练的主观难度打 1–10 分，10 是力竭，8 表示还剩两次。
_避免使用_：Effort score、intensity rating
```

## 规则

- **只在用户理解之后才加入术语。** 术语表是压缩知识的记录，不是供用户读着学的新词典。如果用户刚接触某个概念，等他们能正确使用它，再把它提升到这里。
- **要有主见。** 同一个概念有多个说法时，选出最好的那个，其余列为要避免的别名。语言就是这样被压缩的。
- **定义要紧致。** 一两句话。定义这个术语是什么，而不是它做什么或怎么做。
- **在定义里使用术语表自己的词。** 一个术语进了术语表之后，任何地方都优先用它，包括在其他定义里。这正是让复杂术语以后更容易把握的原因。
- **自然成簇时用子标题分组**（例如 `## Anatomy`、`## Programming`）。术语彼此连贯时，平铺一份列表就可以。
- **明确标出歧义。** 如果某个词在更大的领域里被宽松使用，就记下这里的约定：“在本工作区里，‘set’ 一律指正式组；热身单独记录。”
- **随着理解加深而修订。** 用户第一周写的定义，到第六周可能就错了。就地更新，不要留下过时的条目。