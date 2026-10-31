---
id: cedar-docs/json-format
title: JSON 策略格式
description: 逐项拆解 Cedar 单条策略与策略集的 JSON 表示，包括作用域操作符、条件表达式和模板链接。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/json-format.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/json-format.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/json-format.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# JSON 策略格式

Cedar 除了文本策略语言，还定义了等价的 JSON 表示，用于程序化地构造和解析策略。此处的“策略”同时涵盖静态策略和策略模板；JSON 表示**不保留**注释、空白和换行，因此它适合传输与存储，不适合作为人写策略的载体。文本写法与语义请对照[策略语法基础](./policy-syntax.md)。

## 单条策略的顶层结构

一条策略的 JSON 对象有六个键：`effect`、`principal`、`action`、`resource`、`conditions`、`annotations`。前五个必填，`annotations` 可选。`effect` 只能是字符串 `permit` 或 `forbid`。下面是一条文本策略及其完整 JSON 形式：

```cedar
permit (
    principal == User::"12UA45",
    action == Action::"view",
    resource in Folder::"abc"
) when {
    context.tls_version == "1.3"
};
```

```json
{
    "effect": "permit",
    "principal": {
        "op": "==",
        "entity": { "type": "User", "id": "12UA45" }
    },
    "action": {
        "op": "==",
        "entity": { "type": "Action", "id": "view" }
    },
    "resource": {
        "op": "in",
        "entity": { "type": "Folder", "id": "abc" }
    },
    "conditions": [
        {
            "kind": "when",
            "body": {
                "==": {
                    "left": {
                        ".": {
                            "left": {
                                "Var": "context"
                            },
                            "attr": "tls_version"
                        }
                    },
                    "right": {
                        "Value": "1.3"
                    }
                }
            }
        }
    ]
}
```

## 作用域的三种写法

`principal`、`action`、`resource` 三个对象都必须带 `op` 键。`op` 取 `All` 表示原策略里只写了关键字、没有任何约束；取 `==` 或 `in` 时再附上 `entity` 或 `slot`；取 `is` 时必须附 `entity_type`，并可选带 `in`。

差异在于：`action` 的 `==` 只能接 `entity`，而 `in` 除单个实体外还可以接 `entities` 数组，用来表示动作组，例如 `action in [Action::"view", Action::"edit"]`。`principal` 与 `resource` 则支持模板占位符 `slot`，取值只能是 `?principal` 或 `?resource`，且必须出现在对应的作用域里。

实体引用写成 `{ "type": "User", "id": "12UA45" }`，`type` 要包含命名空间（如 `Namespace::Type`）。Cedar 也接受等价转义形式 `{ "__entity": { "type": ..., "id": ... } }`，后者在 `Value` 里表示实体字面量时更常见。

## 条件表达式 JsonExpr

`conditions` 是数组，每个元素恰好含 `kind` 与 `body` 两个键，`kind` 为 `when` 或 `unless`，`body` 是一个 JsonExpr。JsonExpr 的判定规则很统一：**只有单个键的对象**。键可以是：

- `Value`：Cedar 值，语法与实体属性值相同，可含实体引用、集合、记录；
- `Var`：`principal`、`action`、`resource` 或 `context`；
- `Slot`：`?principal` 或 `?resource`；
- 一元运算 `!`、`neg`、`isEmpty`，其值含单个 `arg`；
- 二元运算 `==`、`!=`、`in`、`<`、`<=`、`>`、`>=`、`&&`、`||`、`+`、`-`、`*`、`contains`、`containsAll`、`containsAny`、`hasTag`、`getTag`，其值含 `left` 与 `right`；
- `.`（成员访问）与 `has`，值含 `left` 和 `attr`；`has` 的 `attr` 还可以是非空标识符列表，用于 `context has something.nested`；
- `is`：含 `left`、`entity_type`，可选 `in`；
- `like`：含 `left` 与 `pattern`；
- `if-then-else`：含 `if`、`then`、`else`；
- `Set`、`Record`；
- 其他任意键：视为扩展函数或方法名，值为参数数组，方法调用的接收者是第一个参数。

`like` 的模式数组由字符串 `Wildcard` 和 `{ "Literal": "..." }` 组成。模式 `/home/alice/docs/*.txt` 写作：

```json
"pattern": [
  {
    "Literal": "/home/alice/docs/"
  },
  "Wildcard",
  {
    "Literal": ".txt"
  }
]
```

字面量允许拆到每个字符一个 `Literal`，语义不变。

## 策略集与模板链接

策略集的 JSON 有三个键：`staticPolicies`、`templates`、`templateLinks`。前两者都是从策略 ID 到策略内容的映射；`staticPolicies` 只能放静态策略，放模板会报错。`templateLinks` 是数组，每项含 `templateId`、`newId` 和 `values`，`values` 把 `?principal` 或 `?resource` 映射到具体实体。也就是说，模板本身放在 `templates`，实例化结果由链接记录表达，而不是把展开后的策略再存一份。展开规则见[策略模板](./templates.md)。

`annotations` 若存在必须是对象，键为字符串，值为字符串或 `null`；`null` 对应没有值的注解（如 `@shadow_mode`），等价于空字符串。

## 实践提示

JSON 格式适合由服务端生成策略，但拼接字符串生成 JSON 同样有注入风险，应使用序列化库。官方还给出 Java 的转换路径：先 `parseStaticPolicy` 得到策略对象，再 `toJson` 得到 JSON 字符串，最后用 gson 之类的库处理。若要把已有文本策略转成 JSON，务必以解析器结果为准，不要手写映射。