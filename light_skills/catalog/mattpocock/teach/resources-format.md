---
id: mattpocock/teach/resources-format
title: resources-format
description: 说明 `RESOURCES.md` 的结构：按知识与社群两类整理可信来源，并为每条资源标注用途。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/productivity/teach/RESOURCES-FORMAT.md
snapshotPath: source-snapshots/mattpocock/teach/resources-format.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/teach
---

# RESOURCES.md 的格式

`RESOURCES.md` 是围绕这个主题精心挑选的可信来源集合。讲解材料里的知识应当从这里取材，而不是靠模型的参数化猜测。智慧则来自这里列出的社群。

## 结构

```md
# {Topic} Resources

## Knowledge

- [Book: _The Science and Practice of Strength Training_ by Zatsiorsky & Kraemer](https://example.com)
  关于训练编排与适应的基础读物。用于：任何与周期化、恢复、强度区间有关的问题。
- [Article: "How Much Should I Train?" by Greg Nuckols (Stronger By Science)](https://example.com)
  关于训练量标志点的循证综述。用于：每个肌群的每周组数目标。

## Wisdom (Communities)

- [r/weightroom](https://reddit.com/r/weightroom)
  高信噪比的 subreddit，有版规压制伪科学。用于：训练计划点评、平台期排查。
- Local: Tuesday strength class at {gym name}
  用于：在举重动作上获得实时的教练反馈。
```

## 规则

- **只收高可信来源。** 优先一手资料、公认专家、同行评审的研究，以及管理严格的社群。如果一份资源只是披着教育外衣的营销，就不要收进来。
- **每条都要有注解。** 一个裸链接三个月后就没用了。补一行：它讲什么，什么时候该去找它。
- **按 Knowledge / Wisdom 分组。** 这与 [SKILL.md](./SKILL.md) 里的理念一致。一份资源只出现在一组里也没问题。
- **明确暴露缺口。** 如果使命需要的某个领域找不到好资源，就写一个 `## Gaps` 章节列出缺什么。这会驱动后续的搜索。
- **毫不留情地修剪。** 事后发现是错的、浅的或偏离使命的资源应当删掉，而不是埋起来。五份锋利的来源胜过三十份平庸的。
- **记录社群偏好。** 如果用户已经选择不加入社群，就在这里写明，免得以后的会话反复推荐。