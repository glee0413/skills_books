---
id: cedar-docs/validation
title: 策略验证
description: 说明 schema 如何让 Cedar 在策略上线前发现拼写、类型与引用错误，并交代验证的可靠性与边界。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/validation.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/validation.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/validation.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 策略验证

策略也是代码，写错在所难免。下面这条策略语法完全合法，却塞满了拼写和类型错误：

```cedar
permit (
    principal == ExampleCo::Uzer::"12345",   // should be "User", not "Uzer"
    action == ExampleCo::Action::"ReadFile", // should be "readFile", not "ReadFile"
    resource == ExampleCo::User::"67890"     // "readFile" isn't a valid operation on a User
)
when {
    principal.isAcctive           // should be "isActive", not "isAcctive"
      &&
    principal.username > 2        // comparing a string against a number
};
```

Cedar 无法孤立地判断对错：`Uzer` 和 `User` 都是合法名字。若直接拿去求值，作用域错误会让它永不匹配；即使修好作用域，求值也会因访问未定义属性、字符串与整数比较而报错。而报错的策略会被忽略，应用最终只得到默认的 `DENY`——问题被掩盖了。

**验证（validation）**就是为解决这个痛点：在策略创建或加载时，用 **schema** 提供的信息检查它。

## Schema 提供什么

验证需要知道：正确的实体类型名、每个类型有哪些属性及类型、允许的父子关系、有哪些动作，以及每个动作对 principal、resource、context 的类型要求。一个最小例子：

```json
{
    "ExampleCo::Personnel": {
        "entityTypes": {
            "Employee": {
                "shape": {
                    "type": "Record",
                    "attributes": {
                        "name": { "type": "String" },
                        "jobLevel": { "type": "Long" },
                        "numberOfLaptops": {
                            "type": "Long",
                            "required": false
                        }
                    }
                }
            },
            "System": {}
        },
        "actions": {
            "remoteAccess": {
                "appliesTo": {
                    "principalTypes": ["Employee"],
                    "resourceTypes": ["System"]
                }
            }
        }
    }
}
```

它声明：实体位于命名空间 `ExampleCo::Personnel` 中，**策略里**引用要写全前缀（`ExampleCo::Personnel::Employee`），而**schema 内部**不用；`Employee` 必有 `name`（String）与 `jobLevel`（Long），`numberOfLaptops`（Long）可选；`System` 没有属性；动作 `remoteAccess` 只接受 `Employee` 主体和 `System` 资源。context 的格式也可以在这里规定，从而连 context 引用错误一起查出来。

## 诊断示例

在上面的 schema 下，验证器知道该动作的 principal 必为 `Employee`，于是对下面三条比较分别给出：

```cedar
permit (
    principal,
    action == ExampleCo::Personnel::Action::"remoteAccess",
    resource
)
when {
    principal.numberOfLatpops < 5 &&        // (1)
    principal.name > 3 &&                   // (2)
    principal.jobLevel == "somethingelse"   // (3)
};
```

1. **验证错误**：`numberOfLatpops` 拼错，`Employee` 没有这个属性。
2. **验证错误**：`>` 只接受 `Long`，而左侧是 `String`，运行时必然报错。
3. **验证警告**：`Long == String` 永远为假。不会运行时报错，但几乎肯定不是作者本意，因此标为警告。

## 能查出什么

错误类：未识别的实体类型、未识别的动作、动作被用在它不支持的主体或资源上、`in` 与 `==` 误用（如把 `in` 写成 `==`）、未识别的属性、未加保护地访问可选属性（应写成 `principal has numberOfLaptops && principal.numberOfLaptops > 1`）、操作符类型不匹配、枚举类型实体的非法字面量。

警告类：恒为 `false` 因此永不生效的条件（如主体类型根本不可能有 `manager` 属性）、字符串或标识符混用多种文字系统、字符串中的双向文本控制字符、实体标识符里的异常字符。后三类都是同形字攻击的常见载体。

## 验证是独立的一步

授权 API **不会**在求值请求时顺带验证；验证是单独的 API，应在策略加载或创建时调用。schema 相当于应用与策略之间的契约：请求的 `A` 必须是 schema 列出的动作，`P`/`R`/`C` 的类型要匹配，实体数据也要符合 `entityTypes` 的结构。违反契约时，即使策略通过了验证，求值也可能报错而被跳过。可选的请求级校验工具包括 Cedar CLI 和 Rust API 的 `Request::new()`；也可以用 schema-based parsing 校验实体与 context 的 JSON。

因此 schema 一旦变更，授权模型就变了，已上线的策略需要重新验证。

## 可靠性边界

验证具备 **validation soundness**：对符合 schema 的请求，通过验证的策略不会出现绝大多数求值错误。这个性质用 Lean 定理证明器形式化证明过，Rust 实现也通过差分测试与 Lean 版本对齐。

但有三类错误不被排除：

- **整数溢出**：两个大 `Long` 相加超出 64 位，Cedar 报错而不回绕，验证器不检测。
- **实体缺失**：策略引用的实体不在请求数据中，访问其属性会失败；请求级校验也不检查实体是否存在。
- **非字面量的扩展值**：如 `ip(principal.IPAddr)`，若该属性值不是合法 IP 就会报错。默认的 strict 模式直接禁止这类写法（报 `extension constructors may not be called with non-literal expressions`），而 `ip("XYZ")` 无论哪种模式都验证失败。

除这三类外，前面列出的错误都不会在通过验证的策略上发生。schema 还有额外价值：可作为文档生成、策略编辑器、策略分析与方案交流的输入。即使 Cedar 允许无 schema 起步，项目进入生产前仍应定义它。相关格式见 schema 相关页面，条件写法见[操作符](./operators.md)。
