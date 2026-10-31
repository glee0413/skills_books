---
id: cedar/symcc
title: 符号验证 symcc
description: 用 SMT 求解器证明策略性质并生成反例，理解 check_* API 与 cvc5 的配合方式。
project: cedar
sourceCommit: d5fb0422e6edb8617b595428530224663e122668
sourceRef: v4.3.0-782-gd5fb0422
sourcePath: cedar-policy-symcc/README.md
snapshotPath: source-snapshots/cedar/cedar-policy-symcc/README.md
sourceUrl: https://github.com/cedar-policy/cedar/blob/d5fb0422e6edb8617b595428530224663e122668/cedar-policy-symcc/README.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 符号验证 symcc

SymCC（Symbolic Cedar Compiler）把策略编译成 SMT-LIB 逻辑约束，再用求解器回答“这组策略是否具备某种性质”。与逐条请求测试不同，它覆盖的是**所有**合法请求，因此能证明策略永不报错、永不全允许，或与其他策略等价。

## 能验证哪些性质

README 列出六个核心性质，都挂在 `CedarSymCompiler` 上：

- `check_never_errors`：策略在任何请求下都不会求值出错。
- `check_always_allows`：策略集对任何合法请求都允许。
- `check_always_denies`：策略集对任何合法请求都拒绝。
- `check_implies`：策略集包含（subsumption），即一组的允许集合被另一组覆盖。
- `check_equivalent`：两组策略集等价。
- `check_disjoint`：两组策略集的允许集合不相交。

每个性质都有对应的 `check_*_with_counterexample` 版本。性质不成立时，它返回一个**具体反例**：一段合成出来的请求和实体存储。反例的价值在于可执行——可以直接丢给 `Authorizer` 复现，确认不是编译器或求解器的误报。

这些结论的可信度有额外保障：符号编译器与验证器已在 Lean 中形式化建模并验证，README 链接到 cedar-spec 的 `verified-properties`。

## 环境准备：cvc5 1.3.1

先下载或编译 cvc5 1.3.1，并设置环境变量：

```sh
CVC5=<path to cvc5 1.3.1 executable>
```

版本不能随意替换。SymCC 生成的 SMT-LIB 依赖该版本的求解能力与选项，换版本可能直接失败或得到不一致结果。

## 示例走读

README 的目标是验证“策略集并非对所有合法请求都允许”。先看完整代码：

```rust
use tokio;
use std::str::FromStr;
use cedar_policy::{Schema, PolicySet, Authorizer, Decision};
use cedar_policy_symcc::{solver::LocalSolver, CedarSymCompiler, SymEnv, WellTypedPolicies};

#[tokio::main]
async fn main() {
    // Parse Cedar schema
    let schema = Schema::from_cedarschema_str(r#"
        entity User;
        entity Document { owner: User };
        action view appliesTo {
            principal: [User],
            resource: [Document]
        };
    "#).unwrap().0;

    // Parse Cedar policy set
    let policy_set = PolicySet::from_str(r#"
        permit(principal, action == Action::"view", resource)
        when { resource.owner == principal };
    "#).unwrap();

    // Initialize the symbolic compiler
    let cvc5 = LocalSolver::cvc5().unwrap();
    let mut compiler = CedarSymCompiler::new(cvc5).unwrap();

    // Iterate through all request environments and check the property
    for req_env in schema.request_envs() {
        // Encode the request environment symbolically
        let sym_env = SymEnv::new(&schema, &req_env).unwrap();

        // Validate/type check the policy set
        let typed_policies = WellTypedPolicies::from_policies(&policy_set, &req_env, &schema).unwrap();

        // Verify that `policy_set` does not always allow any request
        let always_denies = compiler.check_always_allows(&typed_policies, &sym_env).await.unwrap();
        assert!(!always_denies);

        // Similar to above, but returns a counterexample (a synthesized request
        // and entity store) which is denied by the policy set.
        let cex = compiler.check_always_allows_with_counterexample(&typed_policies, &sym_env).await.unwrap().unwrap();
        let resp = Authorizer::new().is_authorized(&cex.request, &policy_set, &cex.entities);
        assert!(resp.decision() == Decision::Deny);
    }
}
```

流程可以归纳为五步：

1. **定义 schema**。用可读的 Cedarschema 语法声明 `User`、`Document` 和一个 `view` 动作。schema 决定“什么请求是合法的”，验证只在这个范围内进行。
2. **解析策略集**。策略允许文档所有者查看自己的文档，显然不是全允许，所以待证性质应当为假。
3. **初始化编译器**。`LocalSolver::cvc5()` 找到求解器，`CedarSymCompiler::new(cvc5)` 建立上下文。注意 `compiler` 需要 `mut`，因为求解过程会累积状态。
4. **遍历请求环境**。`schema.request_envs()` 枚举所有 principal/action/resource 类型组合；每个组合生成一个 `SymEnv`，再用 `WellTypedPolicies::from_policies` 做类型检查。跳过这一步，后续编码可能在没有类型保证的情况下进行。
5. **检查并复现反例**。`check_always_allows` 返回 `false`，断言通过；`check_always_allows_with_counterexample` 返回 `Some(cex)`，把 `cex.request` 与 `cex.entities` 交给普通授权器，确认决策确为 `Deny`。

这段代码本身也是一个好的验证范式：**先证明性质不成立，再用反例自证工具链正常**。如果连这个明显为假的断言都过不了，问题多半在环境而非策略。

## 构建、测试与代码结构

在仓库根目录执行：

```sh
cargo build -p cedar-policy-symcc
CVC5=<absolute path to cvc5 1.3.1 executable> cargo test -p cedar-policy-symcc
```

测试必须显式传入 `CVC5` 的**绝对路径**，因为测试进程的工作目录不固定。

crate 内部分两层：`symcc` 是核心库，和 Lean 模型一一对应；`lib.rs` 是前端，不直接对应 Lean，但把接口从 `cedar-policy-core` 类型换成 `cedar-policy` 类型。这样应用开发者不必接触内部类型就能调用验证器。

## 什么时候值得用

适合三类问题：策略重构后想确认语义没变（`check_equivalent`）；新增 `forbid` 后想确认没有误伤（`check_implies` 或反例检查）；上线前想确认策略不会因缺属性而运行时报错（`check_never_errors`）。它不能替代单元测试——反例只说明“存在一个请求”，业务上是否重要仍需人判断——但能覆盖测试样例永远覆盖不到的组合空间。