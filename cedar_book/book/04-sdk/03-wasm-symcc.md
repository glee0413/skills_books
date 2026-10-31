# WASM、语言服务器与符号验证

CLI 和 Rust SDK 覆盖了服务端的主要场景，但还有三个工具面值得单独认识：浏览器和 Node.js 里的 WASM 绑定、编辑器里的语言服务器，以及把策略编译成 SMT 约束的符号验证器 SymCC。前者决定前端能不能预演授权，后两者决定策略写完以后能不能被检查。

## 在 JS/TS 中安装与加载 WASM

WASM 包让 JavaScript 和 TypeScript 应用直接调用 Cedar 的解析、验证和授权函数，而不需要后端转发每一次判断：

```bash
npm i @cedar-policy/cedar-wasm --save
```

加载方式取决于运行环境，包因此提供三个入口。默认入口是 ES module，适合现代打包器；`@cedar-policy/cedar-wasm/nodejs` 用 Node 的 `fs` 同步读取 wasm，适合没有打包器的服务端脚本；`@cedar-policy/cedar-wasm/web` 暴露 `initSync`，让你自己决定 wasm 二进制怎么获取，某些 Jest 配置也需要它。

在裸 Node 里可以直接 require：

```js
const cedar = require('@cedar-policy/cedar-wasm/nodejs');
console.log(cedar.getCedarVersion());
```

用 Vite 时需要两个插件处理 wasm 和顶层 await：

```bash
npm i --save-dev vite-plugin-top-level-await vite-plugin-wasm
```

```js
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait()
  ]
});
```

然后动态导入并缓存模块：

```js
import('@cedar-policy/cedar-wasm').then(mod => {
  // cache it globally here or invoke functions like mod.getCedarVersion();
});
```

## WASM API 的形状

核心导出是 `isAuthorized`。它接收一个对象，字段对应一次授权请求：`principal`、`action`、`resource`、`context`，再加上策略集合 `policies`、实体数组 `entities`，以及可选的 `schema` 和 `validateRequest`。返回值是 `{ decision, diagnostics }`，`decision` 为 `"allow"` 或 `"deny"`，`diagnostics.reason` 列出起作用的策略 ID，`diagnostics.errors` 收集求值错误。

```ts
import { isAuthorized } from "@cedar-policy/cedar-wasm";

const answer = isAuthorized({
  principal: 'User::"alice"',
  action: 'Action::"view"',
  resource: 'Photo::"VacationPhoto94.jpg"',
  context: {},
  policies: {
    staticPolicies: `
      permit (
        principal in UserGroup::"jane_friends",
        action == Action::"view",
        resource
      );
    `,
  },
  entities: [
    {
      uid: { type: "User", id: "alice" },
      attrs: {},
      parents: [{ type: "UserGroup", id: "jane_friends" }],
    },
    {
      uid: { type: "UserGroup", id: "jane_friends" },
      attrs: {},
      parents: [],
    },
  ],
});

console.log(answer.decision); // "allow"
```

`policies.staticPolicies` 既可以是拼在一起的策略文本，也可以是策略数组，或“ID 到策略”的映射。`entities` 使用 Cedar 的实体 JSON 格式，`uid` 和 `parents` 里的 `{ type, id }` 会被识别为实体引用。提供 `schema` 时，上下文里的 `__entity`、`__extn` 转义可以省略，属性类型也会被检查。

同一套绑定还导出 `validate`、`formatPolicies`、`checkParsePolicySet`、`checkParseEntities`、`checkParseSchema`、`schemaToJson`、`policyToJson`、`linkSchemas` 等函数，足以在浏览器里做一个策略编辑器。函数命名和参数形状见 [WASM 精读](../../catalog/cedar/wasm.md)。

## 浏览器授权的边界

WASM 很适合做交互式预演：用户改一条策略，页面立刻显示某个请求会允许还是拒绝；也可以在前端做表单校验，避免把明显非法的请求发给后端。但它不是安全边界。浏览器里的 wasm 和策略都归用户所有，攻击者可以改代码、改实体，甚至直接调用后端接口。

正确的分工是：前端用同一份策略做体验优化，后端用可信的 `PolicySet` 和 `Entities` 做最终决定。两边共享策略文本和 schema，但不要把前端结果当作授权凭据。若前端与后端结果不一致，应视为策略分发或数据同步的 bug，而不是“以某一边为准”。

## 符号验证：把策略编译成 SMT

SymCC 把 Cedar 策略和 schema 编译成 SMT-LIB 逻辑约束，再交给 SMT 求解器判断性质是否成立。它支持检查：策略永不求值出错、策略集总是允许、策略集总是拒绝、策略集之间的蕴含、等价和不相交。每个检查都有带反例的版本；性质不成立时，它会合成一个具体的请求和实体集合，可以直接拿去复现。

它的编译器与验证器在 Lean 中做过形式化建模和验证，因此结果比“随机测试没发现问题”更强。使用前需要安装 cvc5 1.3.1，并让程序能找到它：

```sh
CVC5=<path to cvc5 1.3.1 executable>
```

Rust 里的调用方式如下：

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

这段代码遍历 schema 推出的每个请求环境，逐个证明“策略集不会永远允许”。`check_always_allows_with_counterexample` 返回的反例再交给普通 `Authorizer`，确认它确实被拒绝，形成一次交叉检查。

命令行也可以调用，但需要启用 `analyze` 的实验版 `cedar`。先准备一个只含单条策略的 `view.cedar`：

```
permit (
  principal,
  action == Action::"GetList",
  resource
)
when { principal in resource.readers };
```

选项放在子命令之前，cvc5 路径可以用 `--cvc5-path` 或 `CVC5` 环境变量指定：

```bash
cedar symcc \
  --schema tinytodo.cedarschema \
  --principal-type User \
  --action 'Action::"GetList"' \
  --resource-type List \
  never-errors \
  --policies view.cedar
```

成功时输出 `✓ Policy never errors: VERIFIED`；如果性质不成立，则打印 `✗ ...: DOES NOT HOLD` 和反例。`never-errors` 这类单策略检查要求文件里恰好有一条静态策略；策略集级别的检查用 `always-allows`、`always-denies`、`equivalent`、`implies`、`disjoint`。模板会被忽略并给出警告。

## 什么时候值得上形式化验证

形式化验证适合回答“所有可能的请求里，会不会有一条越过边界”，而不是“我这条测试过不过”。最典型的使用场景是策略重构：把一组细粒度策略合并成更少的规则后，用 `equivalent` 证明新旧策略集等价；拆分职责时，用 `disjoint` 证明两个策略集不会同时授权同一个请求；收紧权限前，用 `implies` 证明新策略集只覆盖旧策略集的子集。发现反例时，SymCC 给出的是完整的请求和实体，排查成本远低于线上事故。

它也有成本：需要 cvc5，求解可能超时，实验特性的命令行接口可能变化，模板不会参与分析。因此日常提交仍然以 `validate` 和单元测试为主，把 SymCC 放在高风险策略变更、权限模型迁移和发布前的关键门禁上。验证只能证明“策略符合写下来的性质”，无法证明性质本身写对了；后者仍要靠 schema、用例和业务评审。更多细节见 [符号验证精读](../../catalog/cedar/symcc.md)。

## 语言服务器：把反馈放进编辑器

仓库还提供 `cedar-language-server`，一个基于 LSP 的语言服务器。构建后把编辑器或 IDE 的 Cedar 客户端指向该可执行文件即可：

```bash
cargo build -p cedar-language-server --release
# 产物：target/release/cedar-language-server
```

它支持策略和 schema 文档的语法诊断、格式化、补全、悬停、跳转到定义、文档符号、折叠，以及针对部分诊断的快速修复。把策略与对应的 `.cedarschema` 关联后，验证错误可以直接显示在编辑器中，不必每次切回终端跑 `cedar validate`。对经常改策略的团队，这比单独维护一套编辑器插件更省事；语言服务器与 CLI、SDK 共用同一套解析器和验证器，反馈也更一致。