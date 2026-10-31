---
id: cedar-docs/entities-syntax
title: 实体与上下文 JSON 语法
description: 说明传给 Cedar 授权引擎的实体列表与 context 的 JSON 表示，包括 attrs、uid、parents、tags 与两种转义写法。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_auth/entities-syntax.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_auth/entities-syntax.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_auth/entities-syntax.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 实体与上下文 JSON 语法

调用 `Authorizer::is_authorized()` 时，除了策略列表和请求，还要提供实体列表。Cedar 公共 API 提供了从 JSON 构造这些输入的入口，例如 `Entities::from_json_value()` 和 `Context::from_json_str()`。这一页说明这两种 JSON 的具体形状。

## 实体列表的外形

顶层是一个 JSON 数组，每个元素代表一个实体，包含三个字段，外加可选的标签：

```json
[
    {
        "uid": {},
        "parents": [],
        "attrs": {}
    },
    {
        ...
    }
]
```

## attrs：属性与类型映射

`attrs` 是属性名到值的映射。JSON 原始类型会自动转换成对应的 Cedar 类型：字符串转 String、整数转 Long、布尔转 Bool、数组转 Set、对象转 Record。所以下面的写法不需要额外声明类型：

```json
"attrs": {
    "department": "HardwareEngineering",
    "jobLevel": 5
}
```

属性值若指向另一个实体，用 `__entity` 转义，其值是带 `type` 和 `id` 的对象；若值是扩展类型，用 `__extn` 转义，其值带 `fn` 和 `arg`：

```json
"attrs": {
    "department": "HardwareEngineering",
    "jobLevel": 5,
    "manager": {
       "__entity": {
           "type": "User",
           "id": "78EF12"
       }
    }
}
```

```json
"attrs": {
    "department": "HardwareEngineering",
    "jobLevel": 5,
    "home_ip": {
       "__extn": {
           "fn": "ip",
           "arg": "222.222.222.101"
       }
    }
}
```

类型名与函数名都必须是**规范化**的，不能夹带空白或 Cedar 注释，例如 `"type": "User "` 非法。

## uid、parents 与 tags

`uid` 指定实体类型与唯一标识，`__entity` 可写可不写，下面两种写法等价，都表示 `User` 类型、ID 为 `12UA45` 的实体：

```json
"uid": {
    "__entity": {
        "type": "User",
        "id": "12UA45"
    }
}
```

```json
"uid": {
    "type": "User",
    "id": "12UA45"
}
```

类型应当是 schema 中定义过的类型，ID 必须唯一、不可变、不可复用，且任何类型名都不能包含保留的 `__cedar`。

`parents` 是实体引用数组，表示层级中的容器，例如用户所属的组；写法与 `uid` 相同，`__entity` 可省略：

```json
"parents": [
    {
        "type": "UserGroup",
        "id": "aliceFriends"
    },
    {
        "type": "UserGroup",
        "id": "bobFriends"
    }
]
```

`tags` 的写法与 `attrs` 完全相同，键名和值的格式一致。标签的键在运行时才确定，适合按文件、按批次这类动态维度描述实体。

## 一个完整例子

下面的数组同时用到 `uid`、`attrs` 与 `parents`，并对 `uid`/`parents` 省略 `__entity`；属性里的实体值和扩展值则显式写出转义。原文提醒：真实文件还应补上被引用但未定义的 `UserGroup` 实体。

```json
[
    {
        "uid": { "type": "User", "id": "alice" },
        "attrs": {
            "department": "HardwareEngineering",
            "jobLevel": 5,
            "homeIp": { "__extn": { "fn": "ip", "arg": "222.222.222.7" } },
            "confidenceScore": { "__extn": { "fn": "decimal", "arg": "33.57" } }
        },
        "parents": [
            { "type": "UserGroup", "id": "aliceFriends" },
            { "type": "UserGroup", "id": "bobFriends" }
        ]
    },
    {
        "uid": { "type": "User", "id": "ahmad"},
        "attrs" : {
            "department": "HardwareEngineering",
            "jobLevel": 4,
            "manager": { "__entity": { "type": "User", "id": "alice" } }
        },
        "parents": []
    }
]
```

## Context

`context` 是请求级的瞬时信息，例如时间、来源 IP、是否使用 MFA 设备。它的每一项都是键值对，值的语法与实体的 `attrs` 完全一致：

```json
{
    "authnMfa": true
}
```

同样支持 `__entity` 与 `__extn` 转义，写不写都可以：

```json
{
    "sourceIp": "10.0.1.101",
    "authnMfa": true
}
```

策略里用点号从 `context` 取值：

```cedar
when {
    context.sourceIp.isInRange(ip("222.222.222.0/24"))
}
```

`context` 是 record 而不是实体，读取它的字段不需要额外的实体数据，这也是分级验证中 level 0 仍可访问上下文的原因。

## schema-based parsing

Cedar 支持“基于 schema 的解析”：只要 schema 指明某个属性是实体引用或扩展值，就可以省掉 `__entity`、`__extn`，甚至省掉扩展函数名：

```json
"attrs": {
    "department": "HardwareEngineering",
    "jobLevel": 5,
    "manager": {
       "type": "User",
       "id": "78EF12"
    },
    "home_ip": {
       "fn": "ip",
       "arg": "222.222.222.101"
    }
}
```

如果 schema 声明 `home_ip` 是 IP 地址，那么 `"home_ip": "222.222.222.101"` 也合法。实体本身的结构见[实体与实体层级](./entities.md)，属性类型见[数据类型](./data-types.md)。