---
id: cedar-docs/templates
title: 策略模板
description: 解释 ?principal 与 ?resource 占位符的使用限制、模板链接策略的动态性，以及模板带来的生命周期成本。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/templates.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/templates.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/templates.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 策略模板

**策略模板（policy template）**是带**占位符**的策略。占位符只能代表主体和资源；之后用具体值填充它，就得到一条**模板链接策略（template-linked policy）**。链接策略是动态的：它始终连着模板，模板一改，所有链接策略立刻采用新语句。

## 占位符与位置限制

模板里只有两个占位符可用：

- 主体：`?principal`
- 资源：`?resource`

可以只用其中一个，也可以两个都用。但它们**只能**出现在策略作用域中 `==` 或 `in` 运算符的右侧——包括与 `is` 连用的 `in`，不包括单独的 `is`。换句话说，占位符替代的是“和谁相等”“属于谁”，而不能拿到条件里当普通变量使用。

## 模板不能直接参与决策

模板本身不是一个可执行的策略：它带着未填的洞，Cedar 不会拿它去匹配请求。必须先链接，即给每个占位符补上具体实体，得到的链接策略才能像静态策略一样参与求值。这也意味着策略库中模板与链接策略是两类对象，API 分别管理，链接时缺少任一占位符的值都会失败。

## 从模板到链接策略

设想一个常见需求：允许某些组查看和评论未标为 `private` 的照片，界面上对应一个 **Share** 按钮。模板可以写成：

```cedar
permit (
  principal in ?principal,
  action in [Action::"view", Action::"comment"], 
  resource in ?resource
)
unless {
  resource.tag =="private"
};
```

用户点击 Share，把 `vacationTrip` 相册分享给 `friendsAndFamilies` 组，应用就用 `UserGroup::"friendsAndFamily"` 和 `Album::"vacationTrip"` 实例化模板。这条链接策略的行为，与下面这条静态策略完全一致：

```cedar
permit (
  principal in UserGroup::"friendsAndFamily",
  action in [Action::"view", Action::"comment"], 
  resource in Album::"vacationTrip"
)
unless {
  resource.tag =="private"
};
```

区别在于，链接策略并没有真的生成这段文本，而是保留了对模板的引用和两个占位符值。日后若给模板的 `unless` 再加一个条件，所有由它派生的链接策略会立即按新语句做决策。

## 生命周期成本

模板把策略库和用户的**生命周期管理**绑在了一起。新人入职并分配角色时，你得为他创建链接策略；转岗时，要找到旧策略、归档、再建新策略；离职时，同样要归档该用户的策略。如果直接删除而不是归档，就丢失了“谁曾被允许做什么”的历史记录，取证时可能正需要它。

角色越复杂，这个成本越明显：简单角色的权限一条策略就能表达，分配只需建一条链接策略；复杂角色往往需要多条策略，分配与回收就变成批量操作，容易出错。因此，模板适合“同一套访问模式套用到大量主体或资源”的场景；规则固定、很少变动的权限，用静态策略反而更省心。

模板语法与静态策略一致，只是多了占位符；策略各部分的含义见[策略语法基础](./policy-syntax.md)，占位符值本身的实体结构见[实体与实体层级](./entities.md)。
