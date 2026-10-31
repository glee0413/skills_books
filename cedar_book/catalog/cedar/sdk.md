---
id: cedar/sdk
title: cedar-policy Rust API
description: 用一段最小 Rust 程序走通解析策略、构造请求、调用授权引擎和读取决策的完整链路。
project: cedar
sourceCommit: d5fb0422e6edb8617b595428530224663e122668
sourceRef: v4.3.0-782-gd5fb0422
sourcePath: cedar-policy/README.md
snapshotPath: source-snapshots/cedar/cedar-policy/README.md
sourceUrl: https://github.com/cedar-policy/cedar/blob/d5fb0422e6edb8617b595428530224663e122668/cedar-policy/README.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# cedar-policy Rust API

`cedar-policy` 是应用侧最主要依赖的 crate：它把策略文本解析成 `PolicySet`，把一次访问请求封装成 `Request`，再由 `Authorizer` 结合实体数据给出 `Allow` 或 `Deny`。这个 README 用一个不到 30 行的程序展示了完整闭环，正好适合当作集成时的骨架。

## 依赖与最小程序

先加依赖：

```sh
cargo add cedar-policy
```

README 给出的示例只有一条策略，却精确地只允许一个请求：

```cedar
permit(principal == User::"alice", action == Action::"view", resource == File::"93");
```

注意这里是 `resource == File::"93"`，不是 `in`。等号只匹配这一个实体，所以除了“`alice` 查看文件 `93`”之外，其他任何请求都会被隐式拒绝。把这个策略嵌进 Rust：

```rust
use cedar_policy::*;

fn main() {
    const POLICY_SRC: &str = r#"
permit(principal == User::"alice", action == Action::"view", resource == File::"93");
"#;
    let policy: PolicySet = POLICY_SRC.parse().unwrap();

    let action = r#"Action::"view""#.parse().unwrap();
    let alice = r#"User::"alice""#.parse().unwrap();
    let file = r#"File::"93""#.parse().unwrap();
    let request = Request::new(alice, action, file, Context::empty(), None).unwrap();

    let entities = Entities::empty();
    let authorizer = Authorizer::new();
    let answer = authorizer.is_authorized(&request, &policy, &entities);

    // Should output `Allow`
    println!("{:?}", answer.decision());

    let action = r#"Action::"view""#.parse().unwrap();
    let bob = r#"User::"bob""#.parse().unwrap();
    let file = r#"File::"93""#.parse().unwrap();
    let request = Request::new(bob, action, file, Context::empty(), None).unwrap();

    let answer = authorizer.is_authorized(&request, &policy, &entities);

    // Should output `Deny`
    println!("{:?}", answer.decision());
}
```

## 代码走读：五步完成一次判定

这段代码可以拆成固定的五步，任何集成方式都绕不开：

1. **解析策略**。`POLICY_SRC.parse()` 借 `FromStr` 得到 `PolicySet`。真实项目通常从文件或配置中心读取字符串，再一次性解析，避免每次请求都重新解析。
2. **构造实体 UID**。`r#"User::"alice""#.parse()` 把 Cedar 语法中的 UID 转成 `EntityUid`。这里用原始字符串 `r#"..."#`，是为了让内部的 `"` 不必转义。
3. **组装请求**。`Request::new(principal, action, resource, context, schema)` 的五个参数依次是主体、动作、资源、上下文和可选 schema。示例传 `Context::empty()` 与 `None`，表示没有额外运行时信息、也不做请求级 schema 校验。
4. **准备实体数据**。`Entities::empty()` 说明这条策略不需要任何属性或层级——判断只靠 UID 相等。一旦策略里出现 `resource.owner` 或 `principal in Team::"x"`，就必须传入真实实体，否则求值会出错或得不到预期结果。
5. **调用授权器**。`Authorizer::new()` 创建无状态授权器，`is_authorized(&request, &policy, &entities)` 返回响应；`answer.decision()` 取出 `Allow` 或 `Deny`。

值得强调的是第 3 步和第 4 步的分离：请求描述“谁想做什么”，实体集合描述“世界是什么样”。Cedar 的判定只依赖这两者加策略，因此同一份策略可以在测试里配假实体、在生产里配真实数据。

## 第二次请求与默认拒绝

程序随后把主体换成 `bob`，其余不变，再次判定，输出 `Deny`。这不是因为存在某条拒绝策略，而是因为唯一那条 `permit` 的主体条件要求 `principal == User::"alice"`，`bob` 不满足，于是没有策略命中，按默认拒绝处理。

这段对照是理解 Cedar 语义的最小实验：**允许必须显式，拒绝可以隐式**。写策略时因此要反复问“还有哪些请求会意外命中这条 permit”，而不是只盯着想放行的那个。

## 与 CLI、示例的衔接

README 把更进一步的内容指向三处：

- CLI：把同样的策略、实体和请求放到命令行里跑，便于快速验证。见本书 CLI 一页。
- 文档：docs.cedarpolicy.com 覆盖语法、schema、验证与安全实践；Rust API 细节看 docs.rs 上的 `cedar_policy`。
- 示例：`cedar-examples` 仓库里的 TinyTodo 是功能最完整的集成样例，展示 HTTP 请求如何被翻译成 Cedar 请求并强制执行。

如果准备上生产，README 明确提醒先读安全最佳实践——尤其是不要把客户端传来的 UID 或属性直接当可信输入，以及确保实体数据与真实状态一致。

## 集成时的检查清单

把示例搬进项目时，可以先确认四件事：策略是否只解析一次并复用；`Request::new` 的 schema 参数是否传入（传入后能提前发现类型错误）；实体集合是否覆盖策略引用到的所有属性与父关系；`Deny` 分支是否真的阻断了业务操作，而不是只记一条日志。这四点决定了 Cedar 是“真正在把关”，还是变成了装饰性的判定调用。