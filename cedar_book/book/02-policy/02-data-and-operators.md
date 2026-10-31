# 数据类型与操作符

Cedar 是一门强类型的表达式语言，但没有通用编程语言那么多类型。策略里能出现的值只有几类：布尔、字符串、整数、集合、记录、实体引用，以及由扩展库提供的日期、时长、IP 地址和定点小数。理解这些类型和它们的操作符，决定了你能否把一句自然语言需求准确翻译成 `when` 条件。

## 值类型总览

`Bool` 只有 `true` 和 `false`。`String` 是字符序列，比较时区分大小写。`Long` 是 64 位整数，范围从 -9223372036854775808 到 9223372036854775807；Cedar 没有浮点数，涉及金额时应使用 `decimal` 扩展类型。整数运算溢出不会回绕，而是产生求值错误，出错的策略会被直接跳过，这一点在写金额、配额一类条件时尤其要小心。

集合、记录和实体引用是复合类型。扩展类型不是字面量，必须通过构造函数得到，例如 `ip("10.0.0.0/8")`。

这里要区分“能求值”和“能验证”。Cedar 的验证是可选的，很多表达式在运行时能算出结果，却过不了类型检查。写策略时以验证通过为目标，才能提前发现拼错的属性名和类型不匹配；只在确实需要动态构造值时，才接受“可求值但不可验证”的写法。

## 集合与记录

集合用方括号书写，元素用逗号分隔。语言本身允许异构集合，但验证器只接受非空且元素同型的集合字面量：

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

上面四个集合都能求值，但只有第二个能通过验证。空集合字面量不能出现在策略里，却可以出现在实体属性和 `context` 中，所以“默认空列表”通常由调用方传入，而不是写死在策略里。

记录是命名属性的集合，键是字符串，值可以是任意类型：

```json
{"key": "some value", id: "another value"}
```

读取属性有两种写法：`record.key` 和 `record["key"]`。当键名包含空格、连字符等非标识符字符时，只能用方括号形式。记录可以嵌套，也可以混用两种写法，例如 `record["some"].nested["attribute"]`。

## 实体引用与类型

实体引用由可选的命名空间、实体类型和 id 组成，各段之间用 `::` 连接：

```cedar
// A principal of type User in a Namespace PhotoFlash
PhotoFlash::User::"alice"

// A principal of type File in a nested namespace
Nested::Namespace::App::File::"myFile.txt"
```

实体相等比较的是“类型加 id”，而不是显示名称。因此 `User::"alice" == Admin::"alice"` 为假，即使两边的 id 字符串相同。`is` 用来判断类型：`resource is Photo` 只关心资源是不是 `Photo` 类型，不关心具体是哪一张。它还能与 `in` 组合成 `principal is User in Group::"friends"`，一次表达“类型对且在该组层级中”。

## 相等与层级

`==` 要求类型和值都相同。集合的比较不看顺序、也不看重复元素，所以 `[1, 2, 40] == [1, 40, 2]` 和 `[1, 1, 1, 2, 40] == [40, 1, 2]` 都为真。跨类型比较通常得到 `false`，但验证器不接受这种写法：`5 == "5"` 能求值，却不能通过验证。`!=` 只能在 `when` 和 `unless` 中使用。

`in` 表达实体层级的成员关系，具有传递性和自反性。若 bob 属于 janeFriends，janeFriends 又属于 all，那么 `principal in Group::"all"` 为真；任何实体都在自己的层级里，所以 `principal in User::"bob"` 也为真。右操作数还可以是实体集合：

```cedar
User::"bob" in [Group::"janefriends", Group::"joefriends"]
```

要注意 `in` 不短路。写成 `User::"bob" in Group::"janefriends" || User::"bob" in 1` 时，第二个分支会被 `||` 跳过；但写成 `User::"bob" in [Group::"janefriends", 1]` 会直接报错，因为集合里有一个非实体。字符串的成员判断不能用 `in`，要用 `.contains()`。

字符串另有 `like` 操作符，用 `*` 匹配任意长度的一段字符，适合处理前缀路径：

```cedar
context.location like "s3:*"         //true
```

它只做模式匹配，不解析结构，所以不要用它代替按 `/` 拆分路径的逻辑。

## 比较、布尔与条件表达式

`<`、`<=`、`>`、`>=` 只适用于 `Long`、`datetime` 和 `duration`；`decimal` 用 `.lessThan()`、`.greaterThanOrEqual()` 这类方法。布尔运算 `&&`、`||`、`!` 的规则与常见语言一致，但短路特性在 Cedar 里有额外价值：

```cedar
permit (principal, action == Action::"read", resource)
when {
    principal has level &&
    principal.level > 5
};
```

如果主体没有 `level` 属性，右侧的 `principal.level` 会报错；`&&` 在左侧为假时不会求值右侧，于是整条策略安全地不匹配。`||` 同样可以这样用，例如 `!(principal has age) || principal.age < 21`。

`if ... then ... else ...` 是表达式而不是语句，可以嵌在条件里：

```cedar
permit (principal, action == Action::"remoteAccess", resource)
when {
    if principal.numberOfLaptops < 5 then
      principal.jobLevel > 6
    else false
};
```

验证器通常要求 `then` 和 `else` 分支同型，且条件本身是布尔。

## has：先确认存在，再取值

访问不存在的属性是求值错误，因此可选属性必须先用 `has` 探测。嵌套属性要一层一层检查：

```cedar
principal has custom && principal.custom has project && principal.custom.project == "greenzone"
```

键名不是合法标识符时，`has` 和取值都要改用字符串写法：

```cedar
context has "owner info" && context["owner info"].name == "Alice"
```

`has` 的右侧也可以直接写访问路径，例如 `principal has contactInfo.address.zip`，它等价于逐层检查。标签则用 `.hasTag()` 和 `.getTag()`，标签名可以是任意字符串表达式，不必是字面量。

## 扩展类型

四种扩展类型分别解决时间、金额和网络地址问题：`datetime("2024-10-15T11:35:00Z")`、`duration("2h30m")`、`decimal("12345.1234")`、`ip("10.50.0.0/24")`。它们支持相等比较，其余操作走方法调用：

```cedar
ip("192.168.0.1").isInRange(ip("192.168.0.1/24"))   //true
datetime("2024-10-15").offset(duration("1h"))
duration("1d").toHours()                             // returns `long` equal to 24
decimal("1.23").greaterThanOrEqual(decimal("1.24"))  //false
```

构造函数可以接受任意字符串表达式并正常求值，但验证器只接受合法的字符串字面量。用 `datetime(context.time)` 这类写法时，策略能跑，却无法通过验证；如果要求策略可验证，就让调用方在传入前完成格式校验。

把这些工具组合起来，一条策略就能同时表达时间窗、网段和标签约束。更完整的类型清单见 [数据类型](../../catalog/cedar-docs/data-types.md)，逐个操作符的边界行为见 [操作符](../../catalog/cedar-docs/operators.md)，现成的组合写法见 [策略示例](../../catalog/cedar-docs/policy-examples.md)。