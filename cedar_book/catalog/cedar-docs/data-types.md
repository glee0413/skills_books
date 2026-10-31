---
id: cedar-docs/data-types
title: 数据类型
description: 汇总 Cedar 的 Bool、String、Long、Set、Record、Entity 与扩展类型，并说明“能求值”与“能验证”的差别。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/syntax-datatypes.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/syntax-datatypes.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/syntax-datatypes.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 数据类型

Cedar 的值和表达式有若干种数据类型。理解它们的关键，是分清**求值（evaluate）**与**验证（validate）**：验证器比求值器更严格，能求值的表达式不一定能通过验证。

## 标量类型

**Bool**：`true` 或 `false`。

**String**：由字母、数字或符号组成的字符序列。

**Long**：不带小数的整数，范围 −9223372036854775808 到 9223372036854775807。用算术运算符越界会产生溢出错误；出错的策略被忽略，于是 `permit` 可能意外不生效，`forbid` 也可能意外拦不住。

## 集合与记录

**Set**：元素可以同类型也可以不同类型的集合，用 `[ ]` 构造、逗号分隔：

```cedar
// a set of three elements, two of type long, and one of type string
[2, 4, "hello"]

// a set of a single type long
[-1]

// an empty set
[ ]

// a set with a Bool expression, a nested set, and a Bool value
[3<5, ["nested", "set"], true]
```

四者都能**求值**，但只有第二个能**验证**。验证器只接受满足两个条件的集合字面量：非空，且所有元素同类型。空集合可以出现在实体和 `context` 记录里，限制只针对策略中的字面量。

**Record**：一组属性，每个属性有名字和值，名字是简单字符串，值可为任意类型。访问方式有两种，若属性名含字母、数字、下划线以外的字符，必须用索引写法：

```json
{"key": "some value", id: "another value"}
```

`record["key"]` 与 `record.key` 都得到 `"some value"`。记录可以嵌套，三种访问风格等价：`record["some"]["nested"]["attribute"]`、`record.some.nested.attribute`、`record["some"].nested["attribute"]`。更多例子：

```json
{}
{"foo": 2, bar: [3, 4, -47], ham: "eggs", "hello": true }
```

记录是请求上下文 `context` 的类型，也是实体属性值的常见形态；属性名带空格等特殊字符时，索引写法是唯一选择。

## 实体

**Entity** 表示主体、动作或资源，写法是类型（含命名空间）加 `::` 加唯一标识符：

```cedar
// A resource of type File
File::"myfile.txt"

// An action to allow reading a resource of type File
Action::"ReadFile"

// A principal of type User with a full UUID as 
// the entity identifier and its friendly name in comments
User::"a1b2c3d4-e5f6-a1b2-c3d4-EXAMPLE11111"

// A principal of type User in a Namespace PhotoFlash
PhotoFlash::User::"alice"

// A principal of type File in a nested namespace
Nested::Namespace::App::File::"myFile.txt"

```

同样地，生产环境的实体标识符应当唯一且永不复用，建议用 UUID 并在注释里写友好名。

## 扩展类型

其余类型以**扩展类型**的形式提供：用接收字符串的**构造函数**创建值，除相等比较用 `==` 外，其余操作都用函数或方法调用。当前有四种：`datetime`、`decimal`、`duration`、`ipaddr`。

验证器只验证参数是**合法字符串字面量**的构造与操作调用。像 `ip(context.addr)` 这样的写法在 `context.addr` 格式正确时能求值，但不会通过验证；默认的 strict 模式会直接拒绝非字面量参数。

**datetime**：毫秒精度的时间点。

```cedar
datetime("2024-10-15")                   // a date only
datetime("2024-10-15T11:35:00Z")         // a UTC datetime
datetime("2024-10-15T11:35:00.000Z")     // a UTC datetime with millisecond precision
datetime("2024-10-15T11:35:00+0100")     // a datetime with timezone offset
datetime("2024-10-15T11:35:00.000+0100") // a datetime with timezone offset and millisecond precision
```

内部用 `long` 存 Unix 纪元以来的毫秒数，但字符串格式限制了可直接构造的范围：最早 `datetime("0000-01-01T00:00:00+2359")`，最晚 `datetime("9999-12-31T23:59:59-2359")`；超出的值只能通过 `offset` 之类的运算得到。`datetime` 是独立类型，不能当 `long` 用。

**decimal**：带整数部分、小数部分不超过四位的值，只能用函数构造，不能写字面量：

```cedar
decimal("12345.1234")
```

范围是 −922337203685477.5808 到 922337203685477.5807。

**duration**：毫秒精度的时间长度。

```cedar
duration("2h30m")
duration("-1d12h")
duration("1h30m45s")
```

内部同样以 `long` 毫秒存储，范围从 `duration("-9223372036854775808ms")` 到 `duration("9223372036854775807ms")`，也不能当 `long` 用。

**ipaddr**：IPv4 或 IPv6 地址，可表示单个地址，也可加 CIDR 后缀表示网段：

```cedar
ip("192.168.1.100")    // a single IPv4 address
ip("10.50.0.0/24")     // an IPv4 range with a 24-bit subnet mask (255.255.255.0)
ip("1:2:3:4::/48")     // an IPv6 range with a 48-bit subnet mask
```

四种扩展类型一旦构造或运算越界，都会产生溢出错误，同样导致策略被跳过。各类型的可用操作见[操作符](./operators.md)；验证为何如此严格，见[策略验证](./validation.md)。
