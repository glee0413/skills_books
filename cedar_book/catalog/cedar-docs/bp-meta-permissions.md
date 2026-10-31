---
id: cedar-docs/bp-meta-permissions
title: 元权限
description: 把“谁有权修改权限”也建模成 Cedar 策略，可用 editPermissions 动作或基于 owner 属性的 ABAC 规则实现。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-meta-permissions.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-meta-permissions.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-meta-permissions.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 元权限

授权系统不只要回答“谁能访问资源”，还要回答“谁有权修改权限”。这类元权限（也称管理权限）本身就是授权模型的一部分，应在设计阶段一并考虑，而不是留到管理后台里用代码分支处理。

## 用一个动作表达

最简单的做法是引入 `editPermissions` 动作，让它像其他动作一样出现在策略里：

```cedar
permit (
    principal == User::"&ExampleToken1;",
    action == Action::"editPermissions",
    resource in Account::"&ExampleToken2;"
);
```

应用在用户尝试修改某资源的权限时，先确认其是否具备该能力。这样元权限复用了既有的主体、动作、资源三段式，也能被 schema 验证、被审计日志记录。

## 更细的拆分

需要更精细控制时，可以把动作继续拆成 `editReadPermissions`、`editWritePermissions` 等。这与[细粒度权限](./bp-fine-grained-permissions.md)的思路一致：先在模型里保留区分，再决定界面是否合并展示。

另一种是 ABAC 风格：给资源加 `owner` 属性，用一条全局规则允许所有者管理访问：

```cedar
permit (
    principal,
    action == Action::"editPermissions",
    resource
)
when {
    principal == resource.owner
};
```

这条策略的主体和资源作用域都是开放的，真正的约束落在 `when`。它简洁，但把所有判断压到条件里，策略索引和静态分析能帮的忙会少一些。

## 保护 owner 本身

ABAC 写法引出一个连带问题：`owner` 的值由谁维护、谁能修改？如果任何人都能把 `owner` 改成自己，这条规则就形同虚设。因此“保护 owner 字段”本身又需要一条元权限规则：例如只允许当前 owner 或平台管理员转移所有权，具体边界由应用决定。

原文没有展开具体策略，只强调这个决定最终要回到用户体验：应用设计者必须确定哪些主体可以拥有元权限，以及他们在界面里如何管理这些权限。把管理流程想清楚后，再把流程映射成对应的授权模型，通常比先写策略再倒推界面更可靠。

## 与其他最佳实践的关系

元权限让“权限变更”成为可授权、可审计的事件，而不是绕过授权系统的后门。它与[最佳实践概览](./best-practices.md)中“在 Cedar 中建模所有权限”一条的思路一致——凡是“谁能做什么”，都应落到策略；与[复合授权](./bp-compound-auth.md)也有交集：修改权限往往既要检查操作者的管理权，也要检查目标资源当前的归属或约束。设计时不妨把管理操作当成普通业务动作，先问它的主体、动作、资源分别是什么，再决定用动作拆分还是属性条件。