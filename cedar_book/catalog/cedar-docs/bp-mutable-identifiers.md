---
id: cedar-docs/bp-mutable-identifiers
title: 避免可变标识符
description: 解释用户名、组名这类可变标识为何会让策略失效或造成权限继承，并给出唯一、规范化、不可变、不可回收的 ID 要求。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-mutable-identifiers.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-mutable-identifiers.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-mutable-identifiers.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 避免可变标识符

这是原文标注为“安全要求”的一条：策略语句中不能使用可变标识符。典型例子是员工目录里的用户名或组名——它的值会随改名而变。

## 一个组名引发的两种故障

```cedar
permit (
    principal in Group::"TeamExample",
    action in ...,
    resource in ...
);
```

组改名后，这条策略不再匹配，原成员会悄悄失去权限。更糟的是组被删除、名称又被另一个组复用时，新组的成员会继承原组删除时未清理的那些策略所授予的权限——他们从未被授予过这些权限。

两种故障方向相反：改名造成“该有的没有”，复用造成“不该有的有了”，后者实质上是提权。而且两者都不会报错，只会在某次访问被拒、或某个不该通过的请求通过时才暴露，排查时也很难联想到是改名引起的。

## 对标识符的四个要求

策略只能引用**唯一、规范化、不可变、不可回收**的标识符。这四个词各管一件事：

- **唯一**：不同实体不共享同一个标识，否则策略无法区分它们；
- **规范化**：同一实体只有一种写法，大小写、分隔符、编码都统一；
- **不可变**：改名、迁移、换邮箱都不改变标识；
- **不可回收**：实体删除后标识作废，永不复用给新实体。

推荐使用通用唯一标识符（UUID），或满足同样条件的序列号、统一资源名（URN）。名字仍可保留给人看，但策略里引用的是不透明 ID，名字只作为注释：

```cedar
permit (
    principal in Group::"fcaf664d4f89fec0cda8", // "TeamExample"
    action in ...,
    resource in ...
);
```

## 落地方式

- 目录系统在创建实体时生成 UUID，改名只改显示名，不动 ID；
- 删除实体时不要回收 ID，也不要让新实体复用旧 ID；
- 传给授权 API 的 ID 必须是规范化后的形式，大小写与分隔符统一，见[规范化输入数据](./bp-normalize-data-input.md)；
- 策略与实体数据使用同一套 ID，不要一处用名字、一处用 UUID。

真正的难点在存量数据：如果目录里已有大量以用户名为键的记录，就需要建立“名字 → UUID”的映射，并在所有写入 ID 的地方（策略、实体切片、审计日志）一并切换。过渡期可以两者并存，但策略只接受 UUID，名字只在展示层出现。若迁移期间新旧 ID 混用，同一条策略会对一部分请求生效、对另一部分不生效，这种不一致比明确的失败更难发现。

这条要求与[安全模型](./security.md)中的标识符规则一致，也解释了为什么组名、用户名不能直接写进策略，见[利用用户组](./bp-user-groups.md)。它与[命名约定](./bp-naming-conventions.md)配合：约定区分“给人看的名字”与“给机器用的 ID”，这条要求规定后者必须具备的性质。