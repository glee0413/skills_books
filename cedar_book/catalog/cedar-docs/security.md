---
id: cedar-docs/security
title: 安全模型
description: 说明 Cedar 与使用者在安全上的责任划分、引擎自身如何被验证，以及应用侧必须遵守的输入与标识规则。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_other/security.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_other/security.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_other/security.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 安全模型

Cedar 的安全是**共同责任**：Cedar 负责正确地求值策略、得出授权决定；使用者负责把授权模型正确写成策略，并把决策所需的全部数据交给 Cedar。Cedar 提供验证器等工具，但策略写得对不对，最终仍由使用者承担。

## Cedar 自己保证了什么

Cedar 团队用三件产物来保证语言实现的正确性与安全性：

1. **Lean 形式化模型**。Lean 是开源的编程语言兼定理证明器。模型里有 Cedar 各组件的可执行定义，即语义，也有关于这些组件的性质；Lean 证明这些性质成立，从而让人相信“基准定义”本身是对的。
2. **Rust 生产引擎**。只使用 Rust 的安全子集，获得内存安全、类型安全和数据竞争安全。另外用基于性质的测试（property-based testing）检查那些在 Lean 里难以证明的性质，例如策略解析与格式化能否往返一致。
3. **差分测试引擎**。自动比对形式模型与生产实现，确认两者语义相同，于是模型上证明过的性质对生产实现同样成立。

这条链条的意义是：形式化给出可信的规范，工程实现追求性能与安全，差分测试把两者钉在一起。

## 应用侧必须理解的三条语义

写策略前必须先理解单条策略结果如何合并成最终决定：

- **default deny**：除非某条 `permit` 求值为 `true`，否则查询结果为 `Deny`。
- **forbid overrides permit**：只要有一条 `forbid` 求值为 `true`，结果就是 `Deny`。
- **skip on error**：策略求值出错时，该策略在本次决策中被忽略。

第三条尤其容易被忽视：它意味着错误不会让请求“更安全”，而是让本该生效的规则悄悄消失。详见[授权如何工作](./authorization.md)。

## 用 schema 验证策略

Schema 描述请求中实体的预期结构与类型：有哪些实体类型、各自作为动作/主体/资源如何使用、如何组成层级、有哪些属性。策略入库前先验证，通过验证的策略在符合 schema 的实体与请求上运行时就不会出现运行时错误。

验证器能发现的典型问题包括：

- 无法识别的实体类型与动作，例如把 `Album` 拼成 `Albom`；
- 动作被用在不受支持的主体或资源上，例如让 `Photo` 去 `View` 一个 `User`；
- `in` 或 `==` 使用不当，例如 `principal in Album::"trip"`，而主体不可能是 `Photo`；
- 无法识别的属性，例如把 `jobLevel` 写成 `jobbLevel`；
- 属性类型不匹配，例如 `principal.hireDate + 3`；
- 可选属性未做存在性检查就被引用，例如直接写 `principal.optionalValue < 100`，而不是先 `principal has optionalValue`；
- 扩展类型构造参数非法，例如 `IP("3.45.1111.43")` 不是合法 IP。

写对 schema 是使用者的责任，保证验证器正确是 Cedar 的责任。Cedar 还提供**实体验证**与**请求验证**，用于检查数据是否符合 schema；验证算法同样在 Lean 中建模并证明，再用差分测试保证生产实现与模型一致。具体流程见[策略验证](./validation.md)。

## 输入规模必须自己设限

Cedar 规范**不限制**策略、schema 或请求的大小。接受任意 Cedar 输入的服务必须自行设置上限，以防内存耗尽。Cedar 提供的解析器在有界输入上是安全的，也是推荐的输入校验方式。有界大小的 Cedar 策略保证会终止，且没有副作用。

## 应用侧的最佳实践

原文给出的清单可以归纳为四组。

**权限最小化与集中化。** 策略应遵循最小权限，只授予完成任务所需的权限；所有授权逻辑都放在 Cedar 策略里，不要散落在应用各处；能用模板就复用模板，避免重复逻辑并保留单一修改点。

**谨慎对待可修改策略的人。** Cedar 没有 I/O 能力，策略无法读文件或访问网络；一条策略的求值不会影响另一条；所有策略都会终止，但恶意用户仍可提交超长策略消耗存储或性能，因此要设长度上限。另外，Cedar 只做**授权**，不做**认证**——应用必须自己完成身份验证，只对认证成功的主体做授权。

**不要用字符串拼接生成策略。** 拼接容易出错，且当攻击者控制输入时会导致 Cedar 代码注入。原文的例子：

```
let src = "permit (" + input + ", action == Action::\"view\", resource) when { principal.level > 3 }";
let policy = parse(src);
addToPolicySet(policy);
```

正常输入 `principal == User::"alice"` 会得到预期策略；但攻击者若把 `input` 设为：

```cedar
"principal,action,resource); //"
```

拼出的策略就变成：

```cedar
permit (principal,action,resource); //, action == ,Action::"view", resource) when { principal.level > 3 };
```

这等于允许任何人对任何资源执行任何动作。这里的“代码注入”指注入 Cedar 代码，不是任意代码执行；防止任意代码注入是 Cedar 库的责任，但避免拼接是应用的责任。正确做法是用策略模板。

**标识符要唯一、不可变、不可回收。** 用户名或组名这类可变标识很危险：如果 Alice 离职后又有一个 Alice 入职并复用 `alice` 这个用户名，她就会继承所有尚未清理的策略所授予的权限。因此策略只能引用**唯一、规范化、不可变、不可回收**的标识符，推荐 UUID，或序列号、URN 等等价方案：

```cedar
permit (
    principal == User::"2dad2883-cba1-4a1e-b212-a6c0a5290dad", // "Alice"
    action in ...,
    resource in ...
);
```

最后两条同样重要：用于决策的策略、实体和上下文数据不能被潜在攻击者读取或篡改；调用授权 API 之前要先规范化输入数据。相关建模建议见[最佳实践概览](./best-practices.md)。