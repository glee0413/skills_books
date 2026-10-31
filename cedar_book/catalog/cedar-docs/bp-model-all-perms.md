---
id: cedar-docs/bp-model-all-perms
title: 建模所有权限
description: 说明为何要把数据库权限表里的每一行迁成一条 Cedar 策略，以及集中判定带来的审计与验证收益。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-model-all-perms.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-model-all-perms.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-model-all-perms.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 建模所有权限

在采用 Cedar 之前，应用可能用数据库里的一张权限表把主体 ID 与资源 ID 关联起来。迁移到 Cedar 时，官方建议把所有权限判定逻辑都搬进 Cedar 策略；如果还保留这样一张权限表，表里的每一行都应变成一条独立的 Cedar 策略。

## 权限表与策略的对应

权限表的一行通常表达“某个主体可以对某个资源做某件事”。这正是 Cedar `permit` 语句的形状：principal 取表中的主体，resource 取表中的资源，action 由该行的业务语义决定。若行里还带着授予者、过期时间之类的信息，应把它们作为实体属性或 context 输入放进条件，而不是留在应用代码里另做判断。

## 一行一策略

一行一条策略的好处是粒度对齐：增删某个主体的访问权，就是增删那一条策略，不必读出并改写一大段列表，也不会出现两个管理员互相覆盖的并发问题。行数多时，用策略模板或组来批量生成，而不是把多行合并成一条带长列表的大策略——后者会让索引失效，具体原因见[填充策略作用域](./bp-populate-policy-scope.md)。

## 为什么不再保留两套判定

只要还有一部分判定留在应用代码或权限表里，就会出现两个事实来源：策略说允许、代码说不行，或反之；审计时也无法只读策略就回答“谁能做什么”。集中到 Cedar 之后，策略可以按 schema 做验证、可以纳入版本管理与评审，也才能用上模板、用户组和分级验证这些机制。Cedar 的定位本来就是唯一的决策点，把权限留在外部等于绕过它。

## 迁移的实际步骤

原文没有展开迁移流程，但把建议落到操作上可以分成四步：

1. 找出所有读取权限表的位置，确认每处判定里的主体、动作、资源分别是什么；
2. 把每一行翻译成一条策略，主体和资源尽量写成具体值；
3. 用[命名约定](./bp-naming-conventions.md)统一类型名、属性名与 ID 的写法，ID 必须不可变（见[避免可变标识符](./bp-mutable-identifiers.md)）；
4. 过渡期可以让权限表继续存在，但判定只走 Cedar，避免两边同时被修改。

迁移完成后，权限表退化为业务数据的一部分，而不再是授权依据；这也是[最佳实践概览](./best-practices.md)把它列在权限建模一组的原因。