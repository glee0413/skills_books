---
id: cedar-docs/syntax-grammar
title: 策略语法参考
description: Cedar 策略语言的完整文法，包括策略骨架、作用域、条件、表达式优先级链与词法记号定义。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/syntax-grammar.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/syntax-grammar.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/syntax-grammar.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 策略语法参考

这一页是 Cedar 策略语言的完整文法。记号约定：竖线 `|` 表示选择其一；方括号 `[ ]` 表示可选；圆括号 `( )` 表示分组；花括号 `{ }` 表示重复零次或多次。首字母大写的词是文法构造，全大写的词是词法记号。词法记号用正则表达式定义：`[ ]` 是字符范围，`*`、`+`、`?` 分别是零次以上、一次以上、零或一次，`~` 是补集，`-` 是差集，单引号包住必须原样输入的字面量。文法忽略空白与注释。

## 策略骨架

一条策略由可选的注解、`Effect`、括号中的作用域、以及可选的若干条件组成，并且**必须以分号结尾**。

```
Policy ::= {Annotation} Effect '(' Scope ')' {Conditions} ';'
```

`Effect` 只有两种取值：

```
Effect ::= 'permit' | 'forbid'
```

作用域固定是主体、动作、资源三段，顺序不可换：

```
Scope ::= Principal ',' Action ',' Resource
```

## 作用域的三个元素

`principal` 单独出现时匹配任意主体。它后面可以跟 `is`、`in` 或 `==`；`is` 可以与 `in` 连用，但不能与 `==` 连用。`in` 与 `==` 之后是实体，在模板中则可以是 `?principal` 占位符。

```
Principal ::= 'principal' [(['is' PATH] ['in' (Entity | '?principal')]) | ('==' (Entity | '?principal'))]
```

`action` 单独出现时匹配任意动作；也可以 `==` 一个动作实体，或用 `in` 跟一个动作实体或动作实体集合——后者就是**动作组**。

```
Action ::= 'action' [( '==' Entity | 'in' ('[' EntList ']' | Entity) )]
```

`resource` 与 `principal` 结构相同，模板占位符是 `?resource`：

```
Resource ::= 'resource' [(['is' PATH] ['in' (Entity | '?resource')]) | ('==' (Entity | '?resource'))]
```

## 条件

条件由 `when` 或 `unless` 加一个花括号包住的布尔表达式构成。`when` 在表达式为 `true` 时匹配，`unless` 在表达式为 `false` 时匹配。一条策略可以有零个或多个条件。

```
Condition ::= ('when' | 'unless') '{' Expr '}'
```

## 表达式与优先级

表达式从低到高形成一条优先级链：`if-then-else`、`||`、`&&`、关系、加法、乘法、一元、成员访问。`if` 是唯一的表达式级分支形式：

```
Expr ::= Or | 'if' Expr 'then' Expr 'else' Expr
Or ::= And {'||' And}
And ::= Relation {'&&' Relation}
```

关系层包括普通比较、`has` 存在性判断、`like` 模式匹配，以及带可选 `in` 的 `is` 类型判断：

```
Relation ::= Add [RELOP Add] | Add 'has' (IDENT | STR) | Add 'like' PAT | Add 'is' Path ('in' Add)?
```

算术层只有加、减、乘；`Unary` 允许最多四个前缀 `!` 或 `-`。`Member` 是 `Primary` 后接零或多个 `Access`，`Access` 支持点号访问（可带调用参数）和方括号字符串索引：

```
Add ::= Mult {('+' | '-') Mult}
Mult ::= Unary { '*' Unary}
Unary ::= ['!' | '-']x4 Member
Member ::= Primary {Access}
Access ::= '.' IDENT ['(' [ExprList] ')'] | '[' STR ']'
```

## 基本表达式

`Primary` 覆盖字面量、请求变量、实体、扩展函数调用、括号表达式、集合与 record：

```
Primary ::= LITERAL 
           | VAR 
           | Entity 
           | ExtFun '(' [ExprList] ')' 
           | '(' Expr ')' 
           | '[' [ExprList] ']' 
           | '{' [RecInits] '}'
```

实体是路径加 `::` 加字符串；路径是被 `::` 连接的标识符；扩展函数名可带命名空间前缀；record 初始化的键可以是标识符或字符串：

```
Path ::= IDENT {'::' IDENT}
Entity ::= Path '::' STR
EntList ::= Entity {',' Entity}
ExprList ::= Expr {',' Expr}
ExtFun ::= [Path '::'] IDENT
RecInits ::= (IDENT | STR) ':' Expr {',' (IDENT | STR) ':' Expr}
```

注解写作 `@` 加标识符，可带一个字符串参数：

```
Annotation ::= '@' ANYIDENT ( '('STR')' )?
```

## 词法记号

比较操作符集合包含 `<`、`<=`、`>=`、`>`、`!=`、`==` 与 `in`。标识符以字母或下划线开头，后续可含数字；`IDENT` 是排除保留字后的标识符。

```
RELOP ::= '<' | '<=' | '>=' | '>' | '!=' | '==' | 'in'
ANYIDENT ::= ['_''a'-'z''A'-'Z']['_''a'-'z''A'-'Z''0'-'9']*
IDENT ::= ANYIDENT - RESERVED
```

字符串使用与 Rust 字符串字面量相同的转义规则，支持 `\"`、`\\`、`\n`、`\r`、`\t`、`\0`、`\xHH` 和 `\u{...}`。模式 `PAT` 是允许 `\*` 转义的字符串。字面量包括布尔、整数与字符串；整数可带负号。保留字共有九个，另有四个请求变量：

```
STR ::= Fully-escaped Unicode surrounded by '"'s
PAT ::= STR with `\*` allowed as an escape
LITERAL ::= BOOL | INT | STR
BOOL ::= 'true' | 'false'
INT ::= '-'? ['0'-'9']+
RESERVED ::= BOOL | 'if' | 'then' | 'else' | 'in' | 'like' | 'has' | 'is' | '__cedar'
VAR ::= 'principal' | 'action' | 'resource' | 'context'
```

语法背后的语义与例子见[策略语法基础](./policy-syntax.md)，操作符逐个说明见[操作符](./operators.md)。