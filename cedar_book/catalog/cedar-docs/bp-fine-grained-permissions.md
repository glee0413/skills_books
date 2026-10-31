---
id: cedar-docs/bp-fine-grained-permissions
title: 细粒度权限
description: 论证应在模型中预先把权限拆细、再在界面上聚合成粗粒度选项，并给出从 read 迁移到细粒度动作的策略示例。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-fine-grained-permissions.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-fine-grained-permissions.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-fine-grained-permissions.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 细粒度权限

这条最佳实践的立场是：**模型里用细粒度权限，用户界面上聚合权限**。原文开篇点出一种常见悔恨——最初只设计 `Read`、`Write` 这类很宽的动作，后来才发现需要更细的控制。

## 过宽动作的代价

需求变细通常来自两个方向：客户要求更精确的访问控制，或者合规与安全审计推动最小权限原则。一旦细粒度权限没有预先定义，改造就会同时落在应用代码和策略上：原先针对粗粒度动作的授权调用要改，策略也要跟着迁移。原文给出的迁移前后对照很能说明问题：

```Cedar
permit (
    principal == User::"6688f676-1aa9-456a-acf4-228340b54e9d",
    // action  ==  Action::"read",              -- coarse-grained permission -- commented out
    action in [                       //        -- finer grained permissions
        Action::"listFolderContents", 
        Action::"viewFile"
    ],
    resource in Account::"c863f89b-461f-4fc2-b638-e5fa5f79a48b"
);
```

这段策略里，原本的 `action == Action::"read"` 被注释掉，替换为动作集合 `[Action::"listFolderContents", Action::"viewFile"]`。代码侧同样要把“检查 read”改成“按具体操作检查”，否则新动作永远匹配不上旧策略。

## 两全其美

预先拆细有一个明显顾虑：终端用户可能被迫理解一长串权限名，而多数客户其实只想要 `Read` 和 `Write` 这样的开关。原文的解法是用[策略模板](./templates.md)或动作组把细粒度动作打包成预定义集合。这样客户界面上只看到粗粒度选项，背后却是细粒度动作的集合；将来客户或审计要求细分时，直接把内部动作暴露出来即可。

动作组还能减少策略改动：把新动作加入 `Action::"ApproverActions"` 这类组定义后，引用该组的策略自动覆盖新动作，无需逐条修改。动作组的写法可参考[实现基于角色的访问控制](./bp-implementing-roles.md)。

## 拆到多细

原文没有给出固定粒度，但方向明确：一个动作应对应业务上真实发生的一件事，而不是数据库的 CRUD 原语。这与[把动作映射到业务域](./bp-map-actions.md)是同一原则的两面——前者决定动作的语义边界，后者决定动作的命名与适用范围。拆得足够细，[复合授权](./bp-compound-auth.md)才有可组合的原语；拆得过细，则会给界面聚合和策略维护带来负担。

实践上可以先用“用户会如何描述这项操作”做草稿：如果用户说“我只想让他看文件、不能列出目录”，那么 `viewFile` 与 `listFolderContents` 就应当是两个动作。先在模型里保留这种区分，再决定界面上是否合并展示。