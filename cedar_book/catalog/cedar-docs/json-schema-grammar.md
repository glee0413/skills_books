---
id: cedar-docs/json-schema-grammar
title: JSON Schema 语法参考
description: 用产生式逐条拆解 Cedar JSON schema，涵盖命名空间、实体类型、动作、类型表达式与词法规则。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_schema/json-schema-grammar.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_schema/json-schema-grammar.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_schema/json-schema-grammar.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# JSON Schema 语法参考

这是 Cedar JSON schema 的形式化语法页，比[Schema 概览](./schema.md)更接近编译器视角，字段语义可对照[JSON Schema 格式](./json-schema.md)。原文用一套简化的 BNF 记法描述 JSON 对象的结构，并特别声明：产生式里键的先后顺序只为叙述方便，实际 JSON 不受此约束，例如动作完全可以声明在实体类型之前。

## 记法约定

产生式中，竖线 `|` 表示择一，方括号 `[ ]` 表示可选，圆括号 `( )` 表示分组，花括号 `{ }` 表示重复零次或多次；首字母大写的词是语法构造，全大写的是词法记号。词法部分借用正则记法：`*` 为零次或多次、`+` 为一次或多次、`?` 为零次或一次、`~` 为取补、`-` 为取差，单引号内是必须原样出现的字符。语法本身忽略空白与注释。

## 顶层结构与命名空间

一个 schema 是一个 JSON 对象，键为命名空间，值为含实体类型、动作和可选公共类型的对象：

```
Schema ::= '{' Namespace ':' '{' EntityTypes ',' Actions [',' CommonTypes] '}' '}'
```

命名空间由 `::` 连接一个或多个字符串组成，用于在类型可能重名时消歧：

```
Namespace ::= '"' STR { '::' STR } '"'
```

根对象用命名空间名作键，也允许空字符串形式的空命名空间；但 Cedar 4.0 起禁止空命名空间中的定义遮蔽其他定义。

## 实体类型

`entityTypes` 是以类型名为键的对象。普通实体类型有三个可选成员：`memberOfTypes`（可作为其父类型的类型名数组）、`shape`（属性形状）和 `tags`（标签类型）。枚举实体类型则直接列出合法实体 ID：

```
EntityType ::= IDENT ':' '{' [ 'memberOfTypes' ':' '[' [ IDENT { ',' IDENT } ] ']' ] [ ',' 'shape': TypeJson ] [ ',' 'tags': Type ] '}' | IDENT ':' '{' 'enum': STR+ '}'
```

`memberOfTypes` 只声明**直接**父类型，更高的层级由实体数据在运行时补全。枚举形式自 Cedar 4.3 起可用，且不能同时带 `shape` 或 `tags`。

## 动作

`actions` 以动作名为键。每个动作可声明 `memberOf` 表示所属动作组，并必须给出 `appliesTo`：

```
Action ::= STR ':' '{' [ '"memberOf"' ':' '[' [ STR { ',' STR } ] ']' ] ',' '"appliesTo"' ':' '{' PrincipalTypes ',' ResourceTypes [',' Context] '}' '}'
```

`appliesTo` 内的 `principalTypes` 和 `resourceTypes` 都是类型名数组，列出该动作接受的主体与资源类型。原文说明文字把前者写作单数 `principalType`，产生式则统一用复数，实现以产生式为准。可选的 `context` 复用实体 `shape` 的类型表达式，描述请求上下文。

## 类型表达式

属性形状、上下文和公共类型最终都落到 `TypeJson`，即把 `Type` 包在一对花括号中。`Type` 有六种形态：

```
Type ::= Primitive | Set | EntityRef | Record | Extension | EntityOrCommon
```

- `Primitive` 的 `"type"` 取 `"Long"`、`"String"`、`"Boolean"` 或某个类型名；`"Bool"` 是 `"Boolean"` 的别名。
- `Set` 写成 `{ "type": "Set", "element": TypeJson }`，元素类型同样要再包一层花括号。
- `EntityRef` 写成 `{ "type": "Entity", "name": "Type" }`，名字须是已声明的实体类型。
- `Record` 用 `attributes` 映射属性定义，每项可加 `"required": true|false`，省略时默认必填。
- `Extension` 用 `"name"` 指定扩展；`ipaddr`、`decimal`、`datetime`、`duration` 这些内置扩展也可直接写成 `"type": "ipaddr"`，两种写法等价。
- `EntityOrCommon` 允许一个名字按上下文解析为实体类型或公共类型，Cedar 4.0 起支持。

## 词法与公共类型

字符串沿用 Rust 字面量语法，支持 `\"`、`\\`、`\n`、`\r`、`\t`、`\0`、`\xHH` 和 `\u{...}`。标识符以字母或下划线开头，后续可含数字，但须排除保留字：

```
IDENT ::= ['_''a'-'z''A'-'Z']['_''a'-'z''A'-'Z''0'-'9']* - RESERVED
```

`commonTypes` 把可复用的记录结构抽成具名类型，键为类型名，值为 `TypeJson`。类型名不得使用 `Bool`、`Boolean`、`Entity`、`Extension`、`Long`、`Record`、`Set`、`String` 这八个保留名。日常编写 schema 时人类可读格式通常更简洁，取舍见[Cedar Schema 格式](./schema-format.md)。