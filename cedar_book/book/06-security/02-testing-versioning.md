# 测试、版本与生态

策略是代码，而且是最不该靠肉眼 review 的那类代码：一条 `forbid` 写错，可能让整类请求被放行。好消息是，Cedar 的测试成本很低——请求是纯数据，决策是确定值，策略可以脱离应用单独跑。这一章从最小的 ALLOW/DENY 夹具开始，经过 CLI 和 Rust 测试，走到 symcc 形式化验证，最后讨论版本固定、变更记录和 schema 迁移。

## 把期望写成夹具：ALLOW 与 DENY

最直观的测试是“请求 JSON + 期望决策”。官方六个用例都采用同一布局：`ALLOW/` 下每个文件都应由授权器放行，`DENY/` 下每个文件都应被拒绝。文件名描述场景，请求体只含 PARC：

```json
{
    "principal": "User::\"alice\"",
    "action": "Action::\"ViewDocument\"",
    "resource": "Document::\"alice_public\"",
    "context": {"is_authenticated": true}
}
```

对应的反例只需换主体：

```json
{
    "principal": "User::\"bob\"",
    "action": "Action::\"ViewDocument\"",
    "resource": "Document::\"alice_public\"",
    "context": {"is_authenticated": true}
}
```

夹具的价值在于它同时是规格和回归网。新增一条策略，先写一个应该放行的正例和一个应该拒绝的反例；修 bug，先把触发 bug 的请求放进 `DENY/`。只测 Allow 不测 Deny，等于只验证“门开了”，没验证“门在该关的时候关着”。如果 CLI 加 `-v`，输出还会给出决定该请求的策略 id；把 id 也纳入断言，可以防止“碰巧被另一条策略放行”的假通过。

## 用 CLI 跑回归：validate、authorize、format

官方 `run.sh` 把三类检查串起来。核心是 `validate` 和 `authorize` 两个函数，来自同目录的 `test_utils.sh`：

```bash
source ../test_utils.sh

#GitHub
echo -e "\nTesting github_example..."
validate "github_example" "policies.cedar" "policies.cedarschema"
authorize "github_example" "policies.cedar" "entities.json"
format "github_example" "policies.cedar"
```

`validate` 调用 `cedar validate --policies ... --schema ... --schema-format cedar`；如果用例有模板链接，再加 `-k linked`。`authorize` 遍历 `ALLOW/` 和 `DENY/` 下的每个 JSON，用 `cedar authorize` 跑出决策，与目录名比较，失败就把 `any_failed` 置为 1。`format` 用 `cedar format --check` 保证策略格式稳定，避免 review 被空白改动淹没。

脚本最后 `exit "$any_failed"`，所以可以直接放进 CI。这里有一个容易漏的点：模板用例必须把 `linked` 传给 validate 和 authorize，否则链接策略不参与判定，测试会以“缺少模板链接”的方式失败。另一个点是 schema 参数：`run.sh` 的 authorize 对部分用例传了 schema，对部分没传；生产项目应始终带上 schema，让验证和判定使用同一份类型信息。

## 在 Rust 里写授权测试

应用集成后，测试不应该只跑 CLI。Rust SDK 的 `Authorizer::is_authorized` 接收 `Request`、`PolicySet` 和 `Entities`，返回 `Response`；`response.decision()` 给出 Allow/Deny，诊断信息里还能拿到决定该结果的策略 id。假设策略源码已放在 `POLICY_SRC`，SDK README 的最小调用是：

```rust
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
```

实际项目里建议把夹具做成表驱动：每行一个请求、一个期望决策、一组期望策略 id；实体和 schema 在测试启动时解析一次，避免每个用例重复解析。再加两类测试：一类直接验证策略与 schema（`validate` 的 Rust API），一类对关键不变量做属性测试，例如“任何非 owner 都不能删除私有文档”。Cedar 自己就用属性测试检查解析器与格式化器的往返一致；应用也可以用同样思路生成随机实体，验证 `forbid` 护栏不会被绕过。

## 用 symcc 做形式化验证

夹具只能覆盖你想到的请求。symcc 把策略编译成 SMT 约束，用 cvc5 证明“所有满足 schema 的请求”都具有某性质，并在不成立时给出反例（一个具体的请求和实体库）。完整性质列表见 [符号验证 symcc](../../catalog/cedar/symcc.md)。它支持检查：

- 策略永不出错（`check_never_errors`）；
- 策略集总是允许（`check_always_allows`）；
- 策略集总是拒绝（`check_always_denies`）；
- 策略集蕴含关系（`check_implies`）；
- 策略集等价（`check_equivalent`）；
- 策略集互斥（`check_disjoint`）。

每个检查都有带反例的版本。典型用法是对 schema 的每个请求环境逐一验证：

```rust
for req_env in schema.request_envs() {
    // Encode the request environment symbolically
    let sym_env = SymEnv::new(&schema, &req_env).unwrap();

    // Validate/type check the policy set
    let typed_policies = WellTypedPolicies::from_policies(&policy_set, &req_env, &schema).unwrap();

    // Verify that `policy_set` does not always allow any request
    let always_denies = compiler.check_always_allows(&typed_policies, &sym_env).await.unwrap();
    assert!(!always_denies);
}
```

它最适合验证安全不变量，而不是替代全部单元测试：例如证明“私有文档永远不会被非 owner 查看”，或证明新旧两套策略在迁移期间等价。运行前需要安装 cvc5 1.3.1 并设置 `CVC5` 环境变量；symcc 在 CLI 中属于实验性功能，需要 experimental flavor，接口可能随版本变化。把 symcc 放进 nightly 或发布前检查，而不是每次提交都跑，可以控制成本。

## 版本固定与变更记录

Cedar 生态的版本至少有三层：Rust crate、CLI、策略/schema 文本。crate 用 `Cargo.lock` 锁定实际依赖，升级时一次只动一个 minor，并重跑全部夹具；CLI 从 GitHub release 的 `cedar-policy-cli-v*` 标签安装，`cedar --version` 的输出应写进 CI 日志；symcc 还要固定 cvc5 版本。策略文本本身没有版本号，但策略库应有快照 commit 或发布号，审计时能回答“这条判定当时用的是哪版策略”。

变更记录要写清三件事：改了什么策略或 schema、为什么改、验证了哪些夹具和性质。Cedar 仓库的 `cedar-policy/CHANGELOG.md` 和 CLI changelog 是升级前必读，尤其注意 parser、validation 和 extension 的行为变化。按 CLI 的约定给策略加 `@id`，并在日志里记录命中的 id，可以让“某次拒绝是谁造成的”从猜测变成可追踪。

## Schema 演进与迁移策略

schema 变更通常比策略变更更危险，因为它会一次性影响所有策略和实体。比较稳妥的顺序是“扩展—迁移—收缩”：

1. **扩展**：先加可选属性或新动作，不动旧字段。Cedar schema 用 `?` 标记可选属性，例如 `department?: String`；新策略对缺失属性做存在性检查。
2. **双写/回填**：应用开始写新字段，离线任务回填历史实体；此阶段旧策略仍能工作。
3. **切换**：新策略上线，旧策略保留但不再被新请求命中；用 symcc 或影子流量比较新旧决策。
4. **收缩**：确认没有读取方后，删除旧属性和旧策略。

改名、改变实体类型、复用 id 都属于破坏性变更，不能靠“先发布再看”。动作语义变化时，新增 action 而不是改旧 action 的含义；模板参数变化时，先加新模板并迁移链接，再删旧模板。迁移期间保留上一版策略包和实体快照，出问题时能整体回滚，而不是在现场逐条改策略。

## 发布前检查清单

- 所有策略通过 `cedar validate`，且使用与运行时相同的 schema；
- `ALLOW/` 与 `DENY/` 夹具全绿，关键用例断言了策略 id；
- Rust 集成测试覆盖真实请求构造和 context；
- 关键不变量用 symcc 证明，或至少用反例搜索跑过；
- crate、CLI、cvc5 版本已记录，CHANGELOG 中的破坏性变更已评估；
- 策略包有版本号和回滚路径，`@id` 进入审计日志。

做到这些，策略变更才具备和普通代码同等的可回滚性。下一章的术语表和阅读路线，可以把这些实践对应回具体章节和官方条目。