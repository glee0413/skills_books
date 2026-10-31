---
id: cedar-docs/schema-grammar
title: Cedar Schema 语法参考
description: Cedar 格式 schema 的完整文法，覆盖命名空间、实体、动作、类型声明与保留字规则。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_schema/human-readable-schema-grammar.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_schema/human-readable-schema-grammar.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_schema/human-readable-schema-grammar.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# Cedar Schema 语法参考

这一页给出 Cedar 格式 schema 的完整文法。逐项解释见 [Cedar Schema 格式](./schema-format.md)；两者配套阅读效果最好。

约定与策略文法一致：首字母大写是文法构造，全大写是词法记号；`|` 表示选择，`[]` 表示可选，`()` 表示分组，`{}` 表示重复零次或多次。词法仍用正则记法（`[]` 字符范围、`*`/`+`/`?` 重复次数、`~` 补集、`-` 差集）。当产生式或记号与策略文法同名时沿用同名，例如 `IDENT` 与 `Path`；字符串转义规则也沿用策略文法。

## 顶层结构：命名空间与声明

一个 schema 由零个或多个命名空间组成。命名空间可以带注解，也可以省略 `namespace` 包裹而直接写声明——后者用于空命名空间。声明只有三种：实体、动作、类型。

```
Annotation := '@' ANYIDENT ['(' STR ')']
Annotations := {Annotation}
Schema    := {Namespace}
Namespace := (Annotations 'namespace' Path '{' {Decl} '}') | Decl
Decl      := Entity | Action | TypeDecl
```

## 实体声明

实体声明有三种形态：普通实体、枚举实体、外部实体。普通实体可以声明父类型集合（`in`）、可选的主体形状（`=` 可省略）以及可选的标签类型。枚举实体用 `enum [ ... ]` 直接列出合法 EID，且不带其他子句。外部实体只声明名字与父类型，具体定义留给[链接](./schema-linking.md)。

```
Entity    := Annotations 'entity' Idents ['in' EntOrTyps] [['='] RecType] ['tags' Type] ';' 
           | Annotations 'entity' Idents 'enum' '[' STR {',' STR} ']' ';' 
           | Annotations 'external' 'entity' Idents ['in' EntOrTyps] ';'
```

`Idents` 是逗号分隔的标识符列表，因此一行可以同时声明多个同类实体。`EntOrTyps` 允许写单个类型路径，也允许写方括号包住的类型列表（可为空）。

## 动作声明

动作声明有普通与外部两种。普通动作可以声明所属动作组（`in`）、以及 `appliesTo` 块；外部动作只有名字与组关系。

```
Action    := Annotations 'action' Names ['in' RefOrRefs] [AppliesTo] ';' 
           | Annotations 'external' 'action' Names ['in' RefOrRefs] ';'
```

`appliesTo` 只能出现 `principal`、`resource`、`context` 三个键。前两者取实体类型或类型列表，`context` 取类型路径或内联的 record 类型：

```
AppliesTo := 'appliesTo' '{' AppDecls '}'
AppDecls  := ('principal' | 'resource') ':' EntOrTyps [',' | ',' AppDecls]
           | 'context' ':' (Path | RecType) [',' | ',' AppDecls]
```

## 类型与属性

类型可以是路径（引用实体类型或公共类型）、`Set<T>` 或 record。`type` 声明用于定义公共类型。record 的属性声明支持注解、可选标记 `?` 与尾逗号：

```
TypeDecl  := Annotations 'type' TYPENAME '=' Type ';'
Type      := Path | SetType | RecType
EntType   := Path
SetType   := 'Set' '<' Type '>'
RecType   := '{' [AttrDecls] '}'
AttrDecls := Annotations Name ['?'] ':' Type [',' | ',' AttrDecls]
```

属性的键可以是标识符，也可以是字符串（`Name := IDENT | STR`），后者适合包含特殊字符的键名。

## 引用与名字

动作组引用既可以写全限定实体（`Path :: STR`），也可以只写名字；`in` 后面允许单个引用或方括号列表。实体类型列表与名字列表都是逗号分隔：

```
Path      := IDENT {'::' IDENT}
Ref       := Path '::' STR | Name
Refs      := Ref {',' Ref}
RefOrRefs := Ref | '[' Refs ']'
EntTypes  := Path {',' Path}
EntOrTyps := EntType | '[' [EntTypes] ']'
Name      := IDENT | STR
Names     := Name {',' Name}
Idents    := IDENT {',' IDENT}
```

## 词法记号

标识符规则与策略相同；`IDENT` 排除九个保留字；`TYPENAME` 还要再排除类型保留字——`Bool`、`Boolean`、`Entity`、`Extension`、`Long`、`Record`、`Set`、`String`，因此不能拿它们当公共类型名。`PRIMTYPE` 给出三个原始类型。注释是 `//` 到行尾，空白按 Unicode 处理：

```
ANYIDENT  := ['_''a'-'z''A'-'Z']['_''a'-'z''A'-'Z''0'-'9']*
IDENT     := ANYIDENT - RESERVED
RESERVED  := 'true' | 'false' | 'if' | 'then' | 'else' | 'in' | 'like' | 'has' | 'is' | '__cedar'
TYPENAME  := IDENT - TYPERESERVED
STR       := Fully-escaped Unicode surrounded by '"'s
PRIMTYPE  := 'Long' | 'String' | 'Bool'
WHITESPC  := Unicode whitespace
COMMENT   := '//' ~NEWLINE* NEWLINE
TYPERESERVED  := 'Bool' | 'Boolean' | 'Entity' | 'Extension' | 'Long' | 'Record' | 'Set' | 'String'
```

等价的 JSON 表示见 [JSON Schema 格式](./json-schema.md)，其文法见 [JSON Schema 语法参考](./json-schema-grammar.md)。