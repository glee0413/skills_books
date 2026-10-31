# CLI 快速上手

Cedar CLI 是验证策略直觉最快的工具。不用写一行 Rust，就能完成“解析策略、装载实体、发起请求、读诊断”的闭环；同一套策略文件随后可以原样交给应用里的 SDK。这一章先用一个最小例子跑通 `authorize`，再看 `validate` 和 `format` 如何把策略纳入日常检查。CLI 的完整说明见 [Cedar CLI 精读](../../catalog/cedar/cli.md)。

## 安装与构建

每个 GitHub Release 都附带 `cedar-policy-cli-v*` 标签的预编译二进制，覆盖 Linux 的 `x86_64`/`aarch64`、macOS 的 Intel/Apple Silicon，以及 Windows 的 `x86_64-msvc`。压缩包里有 `cedar`、许可证和 sha256 校验值，也可以用发布页的一行安装脚本。

默认构建不包含 `tpe` 和 `symcc`。需要符号验证时，要下载并行的 `cedar-policy-cli-experimental-<target>` 包，它在同名 `cedar` 二进制里启用 `tpe` 与 `analyze`，运行时还需要另装 cvc5。实验特性的接口可能随版本变化，追求稳定就用默认包。

从源码安装更适合追新或改代码：

```bash
cargo install cedar-policy-cli
# 或者在 cedar 仓库内构建
cargo build --release
cargo run -- --help
```

`cargo run -- --help` 会列出 `authorize`、`evaluate`、`validate`、`format`、`link`、`translate-policy`、`translate-schema`、`new` 等子命令。日常最常用的是前四个。

CLI 的输入都是文件或字符串，不依赖某种语言运行时；同一组策略、实体和 schema 可以反复用于本地调试、CI 和线上问题复现。预编译包与源码构建的授权行为一致，差别只在是否启用了实验子命令。

## 最小走查：策略、实体与请求

先写一条允许、一条拒绝，保存为 `policy.cedar`：

```
permit (
    principal in UserGroup::"jane_friends",
    action == Action::"view",
    resource == Photo::"VacationPhoto94.jpg"
);

forbid (
    principal == User::"tim",
    action,
    resource == Photo::"VacationPhoto94.jpg"
);
```

`permit` 表示 `jane_friends` 组成员可以查看这张照片；`forbid` 单独封死 `tim`，即使他也在组里。接着准备 `entities.json`，把用户、组和照片的层级告诉引擎：

```json
[
  {
    "uid": { "type": "User", "id": "alice" },
    "attrs": {},
    "parents": [{ "type": "UserGroup", "id": "jane_friends" }]
  },
  {
    "uid": { "type": "User", "id": "tim" },
    "attrs": {},
    "parents": [{ "type": "UserGroup", "id": "jane_friends" }]
  },
  {
    "uid": { "type": "UserGroup", "id": "jane_friends" },
    "attrs": {},
    "parents": []
  },
  {
    "uid": { "type": "Photo", "id": "VacationPhoto94.jpg" },
    "attrs": {},
    "parents": []
  }
]
```

现在发起请求。把主体换成 `alice`、`tim` 和一个不在组里的 `bob`，观察三次结果：

```bash
cedar authorize \
  --principal 'User::"alice"' \
  --action 'Action::"view"' \
  --resource 'Photo::"VacationPhoto94.jpg"' \
  --policies policy.cedar \
  --entities entities.json
```

`alice` 输出 `ALLOW`；`tim` 输出 `DENY`，因为 `forbid` 覆盖 `permit`；`bob` 也输出 `DENY`，因为没有任何 `permit` 匹配，Cedar 默认拒绝。请求的四个部分就是主体、动作、资源和上下文；这里没有上下文，所以省略 `--context`。不提供 schema 时，CLI 按无类型模式解析实体和上下文；加上 schema 后，属性类型和转义写法会被严格检查。

## 读懂 ALLOW、DENY 与诊断

`cedar authorize` 在标准输出打印一行 `ALLOW` 或 `DENY`，前面还有一个空行。退出码同样有含义：允许是 `0`，拒绝是 `2`，策略或输入解析失败是 `1`。因此 CI 里可以直接用退出码判断，而不必解析文字。把“业务拒绝”和“工具失败”分开很重要：前者是正常结论，后者说明策略没读进来，混在一起会把配置错误误判成安全拒绝。

加 `--verbose` 能看到是哪些策略起了作用：

```bash
cedar authorize \
  --principal 'User::"alice"' \
  --action 'Action::"view"' \
  --resource 'Photo::"VacationPhoto94.jpg"' \
  --policies policy.cedar \
  --entities entities.json \
  --verbose
```

输出会多出一段 `note: this decision was due to the following policies:`，下面列出策略 ID。没有策略命中时则提示 `note: no policies applied to this request`。默认策略 ID 是 `policy0`、`policy1`，按文件中的顺序编号；也可以在策略上加 `@id("...")` 注解改名。

如果某条策略在求值时出错，例如访问了不存在的属性，CLI 会在决策之后打印错误，但整个请求仍可能因为其它策略得出允许或拒绝。看到 `ALLOW` 不代表没有诊断，脚本化时应同时检查错误输出。`--timing` 会额外报告授权耗时，`--request-json` 可以把主体、动作、资源和上下文放进一个 JSON 文件。

想单独验证一个表达式时用 `evaluate`，它不跑策略，只对表达式求值，适合排查属性读取和集合运算：

```bash
cedar evaluate \
  --principal 'User::"alice"' \
  --action 'Action::"view"' \
  --resource 'Photo::"VacationPhoto94.jpg"' \
  --entities entities.json \
  'principal in UserGroup::"jane_friends"'
```

## cedar validate：先让策略通过 Schema

`authorize` 只检查语法和运行时求值，不检查策略是否符合应用的数据模型。`validate` 用 schema 做类型检查。准备 `schema.cedarschema`：

```
entity User in [UserGroup];
entity UserGroup;
entity Photo;

action view appliesTo {
  principal: [User],
  resource: [Photo]
};
```

然后运行：

```bash
cedar validate \
  --schema schema.cedarschema \
  --policies policy.cedar
```

通过时报告 `policy set validation passed`，并附上 `no errors or warnings`，退出码为 `0`。把策略里的 `UserGroup` 改成拼错的 `UsrGroup`，验证会失败并指出未识别的实体类型，退出码为 `3`。`validate` 不执行请求，因此不需要 entities；它只读 schema 和策略。schema 默认按 Cedar 格式解析，如果手头是 JSON schema，加 `--schema-format json`。`--deny-warnings` 会把非致命警告也当作失败，适合发布门禁；`--level` 用于分级验证；`--validation-mode permissive` 和 `partial` 属于实验特性，需要专门构建。验证规则本身见 [策略验证](../../catalog/cedar-docs/validation.md)。

## cedar format 与常用组合

`cedar format` 从文件或标准输入读取策略，把结果打印到标准输出；不传 `--policies` 就从标准输入读，适合接在管道后面：

```bash
cedar format --policies policy.cedar
```

`--write` 原地写回，`--check` 只检查格式是否已经规范，不修改文件；如果格式需要变化就以非零退出。`--line-width` 和 `--indent-width` 可以调整换行与缩进。格式化和验证都不会改变策略语义，把它们放进 pre-commit，既能减少纯格式 diff，也能在实体名或动作名拼错时尽早失败。一个实用的提交前顺序是：

```bash
cedar format --check --policies policy.cedar
cedar validate --schema schema.cedarschema --policies policy.cedar
cedar authorize \
  --principal 'User::"alice"' \
  --action 'Action::"view"' \
  --resource 'Photo::"VacationPhoto94.jpg"' \
  --policies policy.cedar \
  --entities entities.json \
  --verbose
```

## 用官方 sample-data 继续练

CLI 仓库自带 `sample-data` 目录。`sandbox_a` 是纯 RBAC 的 PhotoFlash 例子，覆盖组、`forbid` 覆盖和动作列表；`sandbox_b` 加入属性、可选字段、IP 地址和请求上下文；`sandbox_c` 演示模板与模板链接。每个目录都有自己的 `README.md` 和可直接运行的命令。

```bash
cd cedar-policy-cli/sample-data/sandbox_a
cedar authorize \
  --principal 'User::"alice"' \
  --action 'Action::"view"' \
  --resource 'Photo::"VacationPhoto94.jpg"' \
  --policies policies_1.cedar \
  --entities entities.json
```

把主体依次换成 `tim` 和 `bob`，就能复现“显式拒绝”和“默认拒绝”两种不同原因。跑完这些例子，再进入 [Rust SDK](01-rust-sdk.md) 看同样的 `Request`、`PolicySet`、`Entities` 如何进入应用代码。