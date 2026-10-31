---
id: cedar-docs/bp-normalize-data-input
title: 规范化输入数据
description: 说明 Cedar 为何不提供字符串与列表变换操作符，以及调用授权 API 前必须完成的 URL、字符串与实体 ID 归一化。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-normalize-data-input.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-normalize-data-input.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-normalize-data-input.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 规范化输入数据

原文把这条标为安全要求：在调用授权 API 之前先规范化输入数据。Cedar 有意省略了一批常见操作符，包括格式化数据、变换字符串和列表的操作符。

## 为什么没有这些操作符

两个原因。其一，这类操作会破坏对策略语句施加自动推理的能力，验证与符号分析都依赖表达式可被机械处理。其二，Cedar 面向的场景里，策略作者可能不在开发团队内，甚至是外部客户；要让这些人安全、直观地写策略，就不能要求每位作者自己去发现并正确应用格式化规则。

因此格式化是应用所有者的责任：数据在进入授权 API 之前就要整理好。

## 把结构预先拆开

不要传一个整串 URL：

```json
{
  "url": "https://example.com/path/to/page?name=alice&color=red"
}
```

而应预先解析成策略作者可以直接访问的结构：

```json
{
  "url": {
    "transport": "https",
    "host": "example.com",
    "path": "/path/to/page",
    "queryParams": {
      "name": "alice",
      "color": "red"
    }
  }
}
```

## 字符串必须先归一

下面这个 URL 与上面的例子指向同一资源：

```json
{
  "url": "https://EXAMPLE.COM////path/to/page?name=alice&color=red"
}
```

`EXAMPLE.COM` 的大小写、路径前多余的 `/` 都必须先归一，否则策略不会按作者预期匹配：

```cedar
permit (principal, action, resource)
when {
    context.url.host == "example.com" && // Won't match "EXAMPLE.COM"
    context.url.path == "/path/to/page"  // Won't match "///path/to/page"
};
```

## 实体标识符同样要归一

若服务接受带或不带连字符、大小写不同的 UUID，下面三种写法都指向同一对象：

```
// All of the following will return the same object.
service.getObject(objectId: "a9edd19b-46f3-486b-887d-4c378aced880");
service.getObject(objectId: "A9EDD19B-46F3-486B-887D-4C378ACED880"):
service.getObject(objectId: "a9edd19b46f3486b887d4c378aced880");
```

那么策略里该写哪一种？服务必须选定一种规范格式，并在所有授权查询中一致使用。否则风险很直接：

```cedar
// This policy won't match if the Object ID is provided in a different format.
// This allows the caller to bypass the forbid rule and retrieve the object.
forbid (
    principal,
    action == Action::"getObject",
    resource == Object::"a9edd19b-46f3-486b-887d-4c378aced880"
);
```

格式不一致时这条 `forbid` 不匹配，调用方就绕过了拒绝规则。

## 应用侧的清单

原文的结论可以落成一份调用前的检查表：

- **URL 拆成字段**：协议、主机、路径、查询参数各自成键，不要留整串字符串；
- **主机名小写**，路径折叠重复的分隔符，去掉末尾多余的 `/`；
- **查询参数结构化**，键和值分别归一，避免顺序不同导致写法不同；
- **UUID 选定一种形式**：统一带连字符或统一不带，统一大小写；
- **实体标识符与策略使用同一格式**，包括资源 ID、主体 ID 与租户 ID。

这些处理都发生在应用侧，而不是策略里——Cedar 没有提供做这些变换的操作符，也不应期待策略作者去弥补。

## 小结

预归一化同时影响三件事：策略分析（表达式可被机械推理）、策略编写（作者不必处理格式差异）、应用安全（拒绝规则不会因写法不同被绕过）。原文的结论很直接：应仔细确保所有字符串输入在调用授权 API 之前都已归一，相关要求见[安全模型](./security.md)与[避免可变标识符](./bp-mutable-identifiers.md)。