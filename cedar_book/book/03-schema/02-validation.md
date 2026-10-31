# 策略验证与 level validation

一段策略可以通过语法解析，却在语义上全错。下面这段来自官方文档的例子把 `User` 拼成 `Uzer`、动作写成 `ReadFile`，还访问了不存在的 `isAcctive`，并把字符串和数字比较：

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

解析器无法判断作者想写 `Uzer` 还是 `User`；只有把应用的结构告诉它，才能发现这些错误。这份结构就是 Schema。验证（validation）用 Schema 检查策略中的实体类型、动作、属性名、属性类型和作用域是否自洽。它发生在授权请求之外，通常在策略入库或发布前调用。概念说明见 [策略验证](../../catalog/cedar-docs/validation.md)。

## 验证能抓到什么

错误级问题会让策略在运行时求值失败或被忽略，包括：实体类型或动作名拼错；动作被套用到不支持的主体或资源；该用 `in` 的地方用了 `==`；访问未声明的属性；未用 `has` 保护就读取可选属性；操作符两端类型不匹配；枚举实体使用了未声明的 id。

警告级问题不一定报错，但通常不是作者本意：条件恒为 false，例如主体永远不可能是某个类型却写 `principal is Admin`；字符串混用多种 Unicode 文字系统；包含双向文本控制字符；实体 id 中出现不可打印字符。警告值得当错误处理，尤其在安全相关的策略里。

下面这段策略配合 `ExampleCo::Personnel` 的 Schema，会得到两个错误和一个警告：

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

(1) 属性名拼错，Schema 中没有 `numberOfLatpops`；(2) `name` 是 `String`，而 `>` 只接受 `Long`，运行时必然出错；(3) `jobLevel` 是 `Long`，与 `String` 比较永远为 false，因此只是警告。

## 验证工作流

验证器需要两个输入：已解析的 Schema，以及一个 `PolicySet`。在 Rust 中通常先解析 Schema，再创建 `Validator`，最后对策略集调用 `validate`：

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

用 CLI 更直接：

```bash
cedar validate --schema photoflash.cedarschema --policies policies.cedar
cedar validate --schema photoflash.cedarschema --policies policies.cedar --level 1
```

`--level` 会同时执行分级验证；`--deny-warnings` 可让警告也导致失败，适合 CI。

## Schema 链接：拆分大型模型

从 Cedar 4.6 起，Schema 可以先声明 `external entity` 或 `external action`，再用链接（linking）把多个文件合并。链接把每个外部声明与同名定义配对，结果与文件顺序、分组方式无关。

```cedarschema
external entity User;
entity Document {
    owner: User,
};
```

另一个 Schema 定义 `User`：

```cedarschema
entity User;
```

链接后得到完整的 `Document` 与 `User`。规则有两条要特别注意：已定义实体类型的祖先集合在链接前后不能改变，否则拒绝链接；同名动作的所有声明必须给出相同祖先。链接后仍可能留下未解析的外部声明。此时可以验证已定义类型的实体、动作和针对已定义动作的请求，但不能验证策略，也不能验证外部类型的实体或外部动作的请求。细节见 [Schema 链接](../../catalog/cedar-docs/schema-linking.md)。

## level validation：限制解引用深度

普通验证保证类型安全，却不限制策略沿着实体属性走多远。level validation 在普通验证之后运行，规定策略中实体解引用链的长度不得超过层级 `n`。它限制三类操作：属性访问 `.` 与 `has`、标签 `getTag` 与 `hasTag`、以及层级判断 `in` 的第一个操作数；record 的字段访问不受限。

level 0 不允许任何实体解引用，但仍可比较实体、检查类型、读取 context：

```cedar
principal is User
action == Action::"view"
context.is_authenticated
```

level 1 允许直接读取请求中根实体的数据，例如 `principal.is_admin`、`action in Action::"read_only"`，也允许先 `has` 再访问一层属性；但不能写 `resource.owner.is_admin` 这样的二级链。level 2 起可以逐层组合。无论哪一级，都不能对实体字面量做解引用，例如 `User::"alice".is_admin`，因为切片过程无法从请求出发找到这个字面量对应的数据。

## 数据切片：只取相关实体

有了层级上限，就可以做 level-based slicing：从请求中的 `principal`、`action`、`resource` 以及 context 里引用的实体出发，迭代 `n` 次，每次查出当前工作集中实体的数据放进切片，并把它属性或标签中引用的实体加入下一轮工作集。最终切片包含策略可能访问的全部数据；用切片数据授权与用全量数据授权结果相同。

Cedar 库不提供切片实现，因为实体通常存在数据库里。应用应把每一轮变成按 UID 批量查询，而不是把全库加载进内存。若所有策略都在 level 0 通过，切片为空；若都在 level 1 通过，只需取请求直接引用的实体。

## 验证的边界

验证可靠性（validation soundness）保证：通过验证的策略，在请求符合 Schema 的前提下不会出现大多数运行时错误。但有三类问题它管不了：`Long` 相加溢出；请求中缺少策略引用的实体；非严格模式下把非字面量字符串传给扩展类型构造函数。请求校验和基于 Schema 的 JSON 解析能减少后两类问题，但不会确认实体一定存在。

因此，验证不是一次性的。Schema 改动后，旧策略可能失效，必须重新验证；请求数据也必须符合 Schema，否则“已验证”的策略仍可能在运行时被忽略。把这些检查放进 CI，并与 [Rust SDK](../04-sdk/01-rust-sdk.md) 的启动流程结合，才能让验证真正发挥作用。