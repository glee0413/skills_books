# 术语表

| 英文 | 中文 | 说明 |
|---|---|---|
| authorization | 授权 | 判断一个已认证主体能否对资源执行某个动作 |
| authentication | 认证 | 验证主体身份，Cedar 不负责这一步 |
| principal | 主体 | 发起请求的用户、服务或其他身份 |
| action | 动作 | 主体想执行的操作 |
| resource | 资源 | 动作作用的对象 |
| context | 上下文 | 请求时的瞬时信息，如 IP、时间、MFA 状态 |
| entity | 实体 | Cedar 中的主体、动作、资源及其属性 |
| UID | 实体唯一标识 | 由实体类型和 id 组成，如 `User::"alice"` |
| policy | 策略 | 声明允许或拒绝什么的文本规则 |
| permit | 允许策略 | 匹配时产生 Allow |
| forbid | 拒绝策略 | 匹配时产生 Deny，优先级高于 permit |
| scope | 作用域 | 策略中 principal、action、resource 的匹配范围 |
| condition | 条件 | `when` 或 `unless` 子句 |
| schema | 模式 | 声明实体类型、属性和动作的结构 |
| validation | 验证 | 用 schema 检查策略中的类型和引用 |
| template | 模板 | 带占位符的可复用策略 |
| template-linked policy | 模板链接策略 | 用具体值填充模板后形成的策略 |
| namespace | 命名空间 | 用 `::` 分隔的类型前缀 |
| RBAC | 基于角色的访问控制 | 通过角色/组授予权限 |
| ABAC | 基于属性的访问控制 | 通过主体和资源属性做判断 |
| default deny | 默认拒绝 | 没有 permit 匹配时结果为 Deny |
| forbid overrides permit | 拒绝优先 | 任一 forbid 匹配即 Deny |
| PARC | 主体/动作/资源/上下文 | 授权请求的四个部分 |
| TinyTodo | TinyTodo | Cedar 官方教程中的任务管理应用 |
| PhotoFlash | PhotoFlash | 文档中的照片分享示例应用 |
| WASM | WebAssembly | Cedar 的浏览器/JS 接口 |
| symcc | 符号编译器 | 用 SMT 对策略做形式化分析 |
| level validation | 分级验证 | 按策略层级/切片验证请求所需数据 |