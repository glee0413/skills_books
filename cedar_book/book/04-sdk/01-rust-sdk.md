# Rust SDK：把 Cedar 集成进应用

Rust 侧的核心 crate 是 `cedar-policy`。它把策略解析、实体构造、请求校验、授权决策、诊断和 Schema 验证都收在同一个 API 里。最小集成可以分成五步：解析策略、准备实体、构造请求、调用授权器、读取决策与诊断。下面按这条链路逐步展开。完整 API 索引见 [cedar-policy Rust API](../../catalog/cedar/sdk.md)，可运行的示例见 [Rust Hello World](../../catalog/cedar-examples/rust-hello-world.md)。

## 添加依赖与最小流程

```bash
cargo add cedar-policy
```

官方 README 的最小例子把策略文本解析成 `PolicySet`，用实体 UID 构造 `Request`，再交给 `Authorizer`：

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

`Request::new` 的最后一个参数是可选的 Schema 引用，传 `None` 表示不做请求级校验。策略中没有匹配的 permit 时结果是 `Deny`；只要有一个 forbid 匹配，结果也是 `Deny`，与 permit 数量无关。这个例子不读文件、不连数据库，适合先跑通链路，再逐步换成真实策略和实体。策略语言细节见 [策略结构与 permit/forbid](../02-policy/01-structure.md)。

## 解析策略与 PolicySet

`POLICY_SRC.parse::<PolicySet>()` 同时接受静态策略和模板。解析成功只说明语法正确，不说明类型正确；类型检查要靠下一节的 Schema 验证。解析失败时返回带源码位置的错误，生产代码不应 `unwrap()`，而应把错误上报到策略管理界面。

`PolicySet` 支持按 `PolicyId` 取回单条策略。默认 id 依次是 `policy0`、`policy1`；也可以用 `@id("...")` 注解指定，但注解语义由应用自己解释。需要逐条展示或审计策略时，遍历策略集并读取注解即可。除了 `PolicySet`，也可以单独解析一条 `Policy`，再调用 `add` 放进集合；模板则用 `Template::parse` 解析、用 `link` 绑定占位符。无论走哪条路径，都应该在服务启动时完成解析并缓存结果，避免在每个请求里重复做词法和语法分析。

## 构造实体与上下文

真实请求几乎总需要实体数据。最方便的来源是 JSON：

```rust
let e = r#"[
    {
        "uid": {"type":"User","id":"alice"},
        "attrs": {
            "age":17,
            "ip_addr":{"__extn":{"fn":"ip", "arg":"10.0.1.101"}}
        },
        "parents": []
    },
    {
        "uid":{"type":"Action","id":"view"},
        "attrs": {},
        "parents": []
    },
    {
        "uid": {"__entity":{"type":"Album","id":"trip"}},
        "attrs": {},
        "parents": []
    }
]"#;
let entities = Entities::from_json_str(e, None).expect("entity error");
```

`uid` 有 `{"type": ..., "id": ...}` 和 `{"__entity": ...}` 两种写法；扩展类型用 `__extn` 包住构造函数名和参数。`parents` 是父实体 UID 列表，用于 `in` 判断。第二参数同样是可选的 Schema；传入 `Some(&schema)` 会按 Schema 校验属性名和类型，能在进入授权器前发现脏数据。如果实体来自代码而不是 JSON，可以用 `EntityUid::from_type_name_and_id` 构造 UID，用 `RestrictedExpression` 表示属性值，再通过 `Entity::new` 和 `Entities::from_entities` 组装。两条路径最终得到同一种 `Entities`，选哪条取决于数据源。

上下文是请求特有的数据，不属于实体存储。可以从 JSON 构造：

```rust
let v: serde_json::value::Value = serde_json::json!(
        {
             "vendor":{
               "groups":["finance"],
                "ip_address":{"__extn":{"fn":"ip", "arg":"10.0.1.101"}}
            }
        }
);

let c = Context::from_json_value(v, None).unwrap();
```

没有上下文时用 `Context::empty()`。构造请求：

```rust
let request = Request::new(alice, action, file, c, None).unwrap();
```

这里的 `None` 换成 `Some(&schema)` 后，`Request::new` 会检查 principal、action、resource 的类型以及 context 的形状是否匹配 Schema。请求校验是可选步骤，但对不可信输入建议开启。

## 读取决策与诊断

`is_authorized` 返回 `Response`。`decision()` 只给出 `Allow` 或 `Deny`；解释“为什么”要看诊断：

```rust
match ans.decision() {
    Decision::Allow => println!("ALLOW"),
    Decision::Deny => println!("DENY"),
}

for err in ans.diagnostics().errors() {
    println!("{}", err);
}

for reason in ans.diagnostics().reason() {
    println!("  {}", reason);
}
```

`reason()` 列出促成 Allow 的 permit 策略 id；`errors()` 列出求值期间被忽略的策略及其原因，例如缺少实体、属性类型不符、整数溢出。出错策略不参与决策，所以“Deny”不一定代表没有 permit，也可能是 permit 求值失败。生产环境应记录策略 id 和错误类别，但避免把实体属性原样写进日志。

还有一点容易忽略：诊断是给运维和策略作者看的，不应该直接暴露给终端用户。对外只需返回允许或拒绝，对内保留完整的策略 id、错误原因和请求追踪号，方便复盘。若决策是 Deny，`reason()` 可能为空，也可能列出触发拒绝的 forbid；不要把它当成“没有匹配任何策略”的证据。

## 用 Schema 验证策略

把 Schema 文本解析成 `Schema`，再交给 `Validator`，就能在启动时或 CI 中检查策略：

```rust
let schema_text = r#"
entity UserGroup;
entity User in [UserGroup] = {
  "age": Long
};
entity Album;
action view appliesTo {
  principal: [User],
  resource: [Album]
};
"#;
// the schema can be parsed in rust:
let (schema, warnings) = Schema::from_cedarschema_str(schema_text).unwrap();
assert_eq!(warnings.count(), 0);
let validator = Validator::new(schema);

let result = Validator::validate(&validator, &p, ValidationMode::default());
if ValidationResult::validation_passed(&result) {
    println!("Validation Passed");
} else {
    println!("Validation Failed.");
    let e = ValidationResult::validation_errors(&result);
    for err in e {
        println!("{}", err);
    }
}
```

`Validator::new` 会拿走 `Schema` 的所有权；如果之后还要用它校验实体或请求，应先完成 `Entities::from_json_str(..., Some(&schema))`，或者克隆 Schema。验证模式默认是 strict；permissive 和 partial 属于实验特性，除非明确需要，不要在生产打开。验证能抓什么、level validation 怎么用，见 [策略验证与 level validation](../03-schema/02-validation.md)。

## 生产集成的几个要点

第一，解析和验证放在启动或发布阶段，授权热路径只做 `is_authorized`；`Authorizer` 可以复用，`PolicySet` 和 `Schema` 应缓存。第二，不要 `unwrap()`：策略文件、实体 JSON、请求 JSON 都可能来自外部，错误要转成业务错误并带上策略 id。第三，Schema 变更后重新验证所有策略，并同步更新实体数据的产生方；旧策略在新 Schema 下可能失效。第四，确保传入的实体集合完整，缺失实体导致的错误会让策略被静默忽略。第五，先用 [CLI 快速上手](./02-cli.md) 复现问题，再回到代码；[TinyTodo 教程](../../catalog/cedar-examples/tinytodo-tutorial.md) 展示了完整的服务端集成方式。

还有一条原则：授权服务不可用时应当拒绝，而不是放行。解析失败、实体加载失败、Schema 不匹配都属于“无法证明允许”，按 fail closed 处理；只有明确的 `Allow` 才继续业务流程。把这条原则写进封装层，比在每个调用点判断更可靠。

需要更细的 API 说明时，查 [Rust SDK 文档](../../catalog/cedar/sdk.md) 和 [Cedar 仓库总览](../../catalog/cedar/readme.md)。