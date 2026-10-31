---
id: cedar/readme
title: Cedar 仓库与 SDK 总览
description: 从仓库结构、crate 分工到快速开始命令，建立 Cedar Rust 实现的整体地图。
project: cedar
sourceCommit: d5fb0422e6edb8617b595428530224663e122668
sourceRef: v4.3.0-782-gd5fb0422
sourcePath: README.md
snapshotPath: source-snapshots/cedar/README.md
sourceUrl: https://github.com/cedar-policy/cedar/blob/d5fb0422e6edb8617b595428530224663e122668/README.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# Cedar 仓库与 SDK 总览

这个仓库是 Cedar 策略语言的 Rust 实现，包含授权引擎、验证器、命令行工具、WASM 绑定和符号编译器。读它的顶层 README，重点不是学语法，而是搞清楚“哪个 crate 负责哪件事”，以及一次最小授权判定需要哪些输入。

## 仓库定位：把授权从业务代码里搬出来

Cedar 用来在应用中编写和执行授权策略。应用把细粒度权限写成策略，运行时把访问请求交给 Cedar 授权引擎判定。因为策略独立于应用代码，所以可以单独编写、更新、分析和审计；配套的验证器还能对照 schema 检查策略是否与应用声明的授权模型一致。

官方用三个词概括设计目标：

- **表达力**（Expressive）：语言简单，但足以覆盖 RBAC、ABAC 等常见授权模型。
- **性能**（Performant）：策略结构可被索引，支持低延迟、可扩展的实时判定。
- **可分析**（Analyzable）：为自动化推理而设计，工具可以优化策略，甚至证明安全模型符合预期。

这三点后面会反复出现：策略写法影响可分析性，crate 划分则对应“执行、验证、分析”三条链路。

## 工作区里的 crate 分工

仓库是一个 Cargo workspace，公开 crate 与内部 crate 混在一起：

- `cedar-policy`：主 crate，负责授权请求判定和按 schema 验证策略，应用通常只依赖它。
- `cedar-policy-symcc`：符号编译器，把策略编译成 SMT 约束，可对策略性质做形式化验证并给出反例。
- `cedar-policy-cli`：命令行接口，提供 `cedar` 可执行文件。
- `cedar-language-server`：Cedar 语言服务器实现。
- `cedar-wasm`：WASM 接口，供 JavaScript/TypeScript 使用。
- `cedar-policy-core`：内部 crate，含解析器、求值器、类型检查器等核心组件。
- `cedar-policy-formatter`：内部 crate，策略自动格式化。
- `cedar-testing`：内部 crate，集成测试代码。

对应用开发者来说，日常只需要 `cedar-policy`；调试策略时加 `cedar-policy-cli`；需要跨语言或做形式化证明时再看 `cedar-wasm` 与 `cedar-policy-symcc`。

## 快速开始：一份策略、一份实体、一次判定

README 的例子把策略放在 `policy.cedar`：

```cedar
permit (
  principal == User::"alice",
  action == Action::"view",
  resource in Album::"jane_vacation"
);
```

含义是：`alice` 可以查看 `"jane_vacation"` 相册里的照片。实体放在 `entities.json`：

```json
[
    {
        "uid": { "type": "User", "id": "alice"} ,
        "attrs": {"age": 18},
        "parents": []
    },
    {
        "uid": { "type": "Photo", "id": "VacationPhoto94.jpg"},
        "attrs": {},
        "parents": [{ "type": "Album", "id": "jane_vacation" }]
    },
    {
        "uid": { "type": "Photo", "id": "SecretPhoto94.jpg"},
        "attrs": {},
        "parents": [{ "type": "Album", "id": "jane_secrets" }]
    }
]
```

Cedar 把主体、资源、动作都表示成实体：实体有类型（如 `User`）、id（如 `alice`）、属性（如 `age` 为整数 `18`）和父实体。父关系构成层级，策略里的 `in` 就是在层级上判断可达性——所以照片属于哪个相册，决定了 `resource in Album::"jane_vacation"` 是否成立。

用 CLI 发起第一次请求：

```sh
 cargo run --bin cedar authorize \
    --policies policy.cedar \
    --entities entities.json \
    --principal 'User::"alice"' \
    --action 'Action::"view"' \
    --resource 'Photo::"VacationPhoto94.jpg"'
```

输出 `ALLOW`，因为 `VacationPhoto94.jpg` 的父实体是 `Album::"jane_vacation"`。换成 `SecretPhoto94.jpg` 再跑一次，输出 `DENY`：它属于 `jane_secrets`，没有任何策略明确允许 `alice` 查看。这就是“默认拒绝”——没有 `permit` 命中，结果就是拒绝。

## 构建、版本与兼容性

从源码构建只需：

```sh
cargo build
```

或 `cargo build --release`。在应用里引入则运行 `cargo add cedar-policy`。README 特别提醒 Cargo 版本号的差别：

```toml
[dependencies]
cedar-policy = "=2.4.2"
```

等号表示锁死到 `2.4.2`；而 `cedar-policy = "2.4.2"` 只表示最低版本，允许任何语义化版本兼容的更新。对安全敏感的授权组件，这个区别值得明确写进依赖策略。

变更记录按 crate 维护在 `main` 分支：`cedar-policy/CHANGELOG.md` 和 `cedar-policy-cli/CHANGELOG.md`；历史版本看 crates.io 或 GitHub Releases。文档在 docs.cedarpolicy.com，Rust API 文档在 docs.rs。若要上生产，README 明确要求先读安全最佳实践；想看在应用里怎么落地，可以直接跳到同仓库生态中的 TinyTodo 示例。