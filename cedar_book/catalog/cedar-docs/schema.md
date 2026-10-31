---
id: cedar-docs/schema
title: Schema 概览
description: 说明 Cedar schema 的作用、两种等价格式，以及命名空间、实体类型、动作和公共类型的整体结构。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_schema/schema.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_schema/schema.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_schema/schema.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# Schema 概览

Schema 是对应用所支持的实体类型结构的声明。写好 schema 之后，可以用它[验证策略](./validation.md)，检查策略里是否引用了错误或不存在的实体、属性，从而避免类型错误在授权时才暴露。

## Schema 声明了什么

Schema 覆盖应用中的三类实体：

- **主体**：代表应用用户的实体。PhotoFlash 例子里是 `User` 和 `UserGroup`，可以定义姓名、年龄、地址等属性。
- **资源**：主体可以操作的对象，例如 PhotoFlash 里的 `Photo` 和 `Album`，同样可带照片名称、拍摄地点、分辨率、编码等属性。
- **动作**：主体能在资源上执行的操作。动作定义会写明它适用于哪些资源类型、哪些主体类型可以执行，例如查看照片、上传照片、列出相册。

服务方可以用 schema 在策略入库前做校验，防止因为属性名拼写错误之类的问题返回错误的授权结果。schema 组件也可以像策略一样带键值注解。

Schema 有两种等价格式：人类可读的 **Cedar 格式**，语法与策略相近；以及基于 JSON Schema 的 **JSON 格式**，针对实体类型等 Cedar 特性做了调整。两者可以互换，Cedar CLI 能在两种格式之间翻译。官方建议优先用 Cedar 格式，因为它更简洁。具体语法见 [Cedar Schema 格式](./schema-format.md)。

## 命名空间

命名空间声明为一组实体类型、动作和公共类型划定作用域，名字由 `::` 连接的标识符组成。名字里不能有空白、换行、控制字符或注释，也不能包含保留的 `__cedar`。

一个命名空间里可以按任意顺序出现三类声明：实体类型、动作、公共类型（可选）。同一命名空间内可以用限定名或非限定名引用；跨命名空间则必须写全限定名。例如 `ExampleCo::Database1` 里的 `Table`，在 `ExampleCo::Database2` 中只能写成 `ExampleCo::Database1::Table`。改动命名空间会连带要求修改策略和其他命名空间中的引用。

## 实体类型

实体类型是主体与资源类型的集合，类型名是一个 Cedar 标识符。每个定义包含两部分：与其他实体类型的成员关系，以及自身的形状（属性）。类型名必须规范化，不能含内嵌空白或注释。

后续版本又加入了两类特殊实体类型：

- **枚举实体类型**（Cedar 4.3 起）：预先规定合法的实体 ID。若请求、策略或实体里出现未在 schema 中列出的 EID，验证器会判为无效。枚举类型的 EID 列表不能为空；这类实体也不能有祖先、属性或实体标签。
- **外部实体类型**（Cedar 4.6 起）：只声明不定义，含外部类型的 schema 不能验证策略，但可以验证请求和实体。通过[链接](./schema-linking.md)到其他含具体定义的 schema 来消解。

### 成员关系与形状

成员关系列出哪些实体类型可以作为该类型实体的**直接**父类型。形状则规定属性的名称、类型和可选性。属性类型可以是 Cedar 支持的数据类型或公共类型。

属性默认必填，因此策略可以假定它一定存在。可选属性必须先用 `has` 判断再访问，否则求值会因访问不存在的属性而出错；出错的策略在授权时被忽略并产生诊断信息，验证器会提前标出这类隐患。

## 动作

动作集合是可作为授权请求 `Action` 的实体。动作名是**实体标识符（EID）**，而非实体类型名。例如 PhotoFlash 中 `viewPhoto` 对应的动作实体名是 `PhotoFlash::Action::"viewPhoto"`，因为 `PhotoFlash::Action` 才是全限定的动作实体类型。

动作定义要说明它在动作组中的成员关系，以及适用范围：可用的主体类型、资源类型和上下文形状。Cedar 4.6 起也支持外部动作，可通过 schema 链接解析。

## 公共类型

当多个实体类型或动作共享大量相同结构时，可以抽出一个具名公共类型，再在需要的地方引用。最典型的场景是多个动作拥有完全相同的 `context`：

```cedar
action view appliesTo {
    principal: User,
    resource: File,
    context: {
        ip: ipaddr,
        is_authenticated: Bool,
        timestamp: Long
    }
};
action upload appliesTo {
    principal: User,
    resource: Server,
    context: {
        ip: ipaddr,
        is_authenticated: Bool,
        timestamp: Long
    }
};
```

抽取之后：

```cedar
type commonContext = {
    ip: ipaddr,
    is_authenticated: Bool,
    timestamp: Long
};
action view appliesTo {
    principal: User,
    resource: File,
    context: commonContext
};
action upload appliesTo {
    principal: User,
    resource: Server,
    context: commonContext
};
```

公共类型可以出现在任何允许声明“数据类型加一组属性”的位置。

## 改 schema 的代价

原文特别警告：**修改 schema 会让此前验证过的策略可能失效**。若请求中带上了符合新 schema 的实体，那些策略在授权查询时可能报错；报错的策略不参与决策，于是结果可能出乎意料。因此改 schema 后应复查受影响的策略，使其准确反映新的实体结构。策略侧的语义见[授权如何工作](./authorization.md)，安全影响见[安全模型](./security.md)。