---
id: cedar-docs/operators
title: 操作符
description: 按字符串、比较、逻辑、算术、层级与集合、IP 与时间分组，汇总 Cedar 表达式可用的操作符和函数及其验证限制。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/syntax-operators.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/syntax-operators.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/syntax-operators.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 操作符

Cedar 的表达式由内置操作符和函数构成。它们有四种写法：一元（`!a`）、二元（`a == b`、`c in d`）、构造式（`ip("127.0.0.1")`）和方法式（`a.containsAny([b, c])`）。

再次强调：能**求值**不代表能**验证**。验证是可选的，未通过验证的策略仍可求值；但通过验证的策略基本不会在求值时出错。

## 字符串与类型转换

`like` 用右侧的模式串匹配左侧字符串，模式中的 `*` 匹配任意个字符，`\*` 表示字面星号。

```cedar
"eggs" like "ham*"                                             //false
"ham and eggs" like "*ham*"                                    //true
"ham" like "*h*a*m*"                                           //true
"string*with*stars" like "string\*with\*stars"                 //true
```

`datetime()`、`decimal()`、`duration()`、`ip()` 把字符串解析成对应的扩展类型值；字符串格式不合法会报错。

## 比较

`==` 只有两个操作数**类型和值都相同**才为真。实体可以跨类型比较：`User::"alice" == Admin::"alice"` 为 `false` 且能通过验证；`5 == "5"` 求值为 `false` 但验证不通过。`!=` 只能出现在 `when` 和 `unless` 子句中，验证规则与 `==` 相同。

`long`、`datetime`、`duration` 支持 `<`、`<=`、`>`、`>=`；`decimal` 没有这些符号，要用 `.lessThan()`、`.lessThanOrEqual()`、`.greaterThan()`、`.greaterThanOrEqual()`。

## 逻辑与短路

`&&`、`||`、`!` 作用于布尔值，`if <bool> then <T> else <U>` 按条件返回两个分支之一。`&&` 在第一个操作数为 `false` 时不再求值第二个，`||` 在第一个为 `true` 时不再求值第二个，`if` 只求值被选中的分支。这正是安全访问可选属性的标准写法：

```cedar
permit (principal, action == Action::"read", resource)
when {
    principal has level &&
    principal.level > 5
};
```

验证器**有时**能利用短路：`false && 3` 通过验证，`(3 == 4) && 3` 不通过，因为它不追踪 `3 == 4` 的结果。`if` 是 `&&`/`||` 的严格推广，两个分支通常要求同类型。

## 算术

算术只支持 `long`，只有 `+`、`-`（二元减法与一元取负）、`*`，**没有除法**，`decimal` 不能参与。溢出是求值错误，但验证器不检测。

```cedar
11 + 0                              //11
-3                              //-3
10 * 20                          //200
9223372036854775807 + 1             //error - overflow //Validates
"lamp" + "la"                       //error - operands not `long` //Doesn't validate
```

## 层级与集合

`in` 判断左侧实体是否在右侧实体的层级之下，它是**传递**的（A in B、B in C 则 A in C）、**自反**的（A in A 恒真，即使该实体不在请求数据中），但**不对称**。右侧也可以是实体集合，此时左侧在任一元素之下即为真；注意集合形式**不短路**，集合里混入非实体会直接报错。

```cedar
principal in User::"bob"             //true by reflexivity
principal in Group::"all"            //true by transitivity
Group::"all" in User::"bob"          //false -- in is not symmetric
User::"bob" in [Group::"janefriends", 1]
```

`has` 检查实体或记录是否有某属性，右侧还可以是点分的访问路径（`principal has contactInfo.address.zip`）。嵌套的可选属性必须逐层检查：

```cedar
principal has custom && principal.custom has project && principal.custom.project == "greenzone"
```

属性名不是合法标识符时，用字符串字面量配合 `[]` 取值：

```cedar
context has "owner info" && context["owner info"].name == "Alice"    //true
```

`.hasTag()` / `.getTag()` 用于标签，标签名可以是任意字符串表达式而不必是字面量；对没有 `tags` 声明的类型调用 `.hasTag()` 返回 `false` 且不报验证错，但 `.getTag()` 会验证失败。

`is` 判断实体类型，可写成 `resource is Photo`，也可与 `in` 连用：`principal is User in Group::"friends"` 等价于两个条件的合取。配合 `&&` 短路，可以安全访问类型特有的属性：

```cedar
permit(principal, action == Action::"view", resource)
when {
  resource is Photo && resource.owner == principal
};
```

`contains`、`containsAll`、`containsAny`、`isEmpty` 只作用于集合；字符串包含要用 `like`，记录键存在要用 `has`。验证器要求接收者与参数是同类型的同质集合，且不接受策略中的空集合字面量 `[]`。

## IP 与时间

`ipaddr` 提供 `.isIpv4()`、`.isIpv6()`、`.isLoopback()`、`.isMulticast()`、`.isInRange()`；`datetime` 提供 `.offset()`、`.durationSince()`、`.toDate()`、`.toTime()`；`duration` 提供 `.toMilliseconds()`、`.toSeconds()`、`.toMinutes()`、`.toHours()`、`.toDays()`。它们都要求接收者类型正确，否则求值与验证都报错。

类型本身的取值范围见[数据类型](./data-types.md)，验证器如何利用类型信息见[策略验证](./validation.md)。
