---
id: cedar-docs/bp-using-the-context
title: 使用上下文
description: 界定 context 只承载请求特有信息，并演示分享对象与代理代表用户两类典型用法及实体列表的配合。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-using-the-context.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-using-the-context.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-using-the-context.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 使用上下文

Cedar 策略语句有四个变量：principal、action、resource 和 context。每个变量都该用在它的用途上——例如资源的信息不应塞进主体。同理，也不要用 context 存放本属于主体或资源的稳定信息。

## context 该放什么

context 面向**某一次请求特有**的信息：HTTP 头、一天中的时间、调用方的认证状态或设备姿态、请求参数。它也可以承载不天然隶属其他实体的信息，例如“是否存在一张未结的支持工单，允许该主体对该资源操作”。

## 动作特定的请求数据

最适合 context 的是**这一次动作实例**的数据：描述请求本身，而不是主体或资源。用户把文件夹分享给另一个用户时，接收者身份是请求的属性，而不是主体或资源的属性：

```
principal  = MyApp::User::"alice"
action     = MyApp::Action::"shareDriveFolder"
resource   = MyApp::Drive::"alice/documents/designs"
context    = {
    "sharingWith": {
        "type": "MyApp::User",
        "id": "bob"
    }
}
entities   = [
    MyApp::User::"alice",    // ...and alice's parents
    MyApp::User::"bob",      // ...and bob's parents
    MyApp::Drive::"alice/documents/designs"
]
```

策略再引用 context 对分享对象做判断：

```cedar
// Allow sharing with anyone in the same department
permit(
    principal,
    action == MyApp::Action::"shareDriveFolder",
    resource
)
when {
    context.sharingWith in MyApp::Department::"engineering"
};
```

注意接收者实体 `MyApp::User::"bob"` 必须出现在 entities 列表里，引擎才能解析它的组成员关系和属性。context 提供的是对实体的**引用**，entities 提供求值所需的数据；只放 context 而不放实体，策略里的 `in` 就无从判断。

## 代理代表用户

如果应用涉及代理（自动化系统、服务账号或 AI 助手）代表用户行事，context 可以建模这种关系。按授权需求有两种合法模式。

**模式一：代理作主体，用户放 context。** 适用于代理自身的权限更重要时，例如不论替谁办事，都要限制代理能执行哪些动作。

```
principal  = MyApp::Agent::"scheduling-bot"
action     = MyApp::Action::"createMeeting"
resource   = MyApp::Calendar::"alice/work"
context    = { "onBehalfOf": { "type": "MyApp::User", "id": "alice" } }
```

**模式二：用户作主体，代理放 context。** 适用于以用户权限为决策依据，但仍想限制或审计哪些代理可代其行事时。

```
principal  = MyApp::User::"alice"
action     = MyApp::Action::"createMeeting"
resource   = MyApp::Calendar::"alice/work"
context    = { "viaAgent": { "type": "MyApp::Agent", "id": "scheduling-bot" } }
```

选择依据是：哪个实体的权限应主导授权决定。两种模式都应把代理和用户都放进 entities，否则二者的属性与组无法参与求值。

## 实践要点

不要把 `principal.email`、`resource.owner` 这类稳定事实复制到 context：同一事实两个来源，策略难验证，数据也容易不一致。context 也不适合承载需要格式化的整串数据，Cedar 没有字符串与列表变换操作符，输入应预先拆好，见[规范化输入数据](./bp-normalize-data-input.md)。字段命名按 camelCase，见[命名约定](./bp-naming-conventions.md)。