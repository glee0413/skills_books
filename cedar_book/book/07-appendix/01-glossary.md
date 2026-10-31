# 术语表与阅读路线

这份附录把全书反复出现的术语压缩成一张速查表，并给出三条阅读路线。术语的中文写法与 `GLOSSARY.md` 保持一致；需要看官方原文时，点每个概念后面的知识库条目。

## 授权与请求

| 术语 | 含义 | 对应条目 |
|---|---|---|
| 认证（authentication） | 验证“你是谁”，由应用完成，Cedar 不负责 | [术语与核心概念](../../catalog/cedar-docs/terminology.md) |
| 授权（authorization） | 判断已认证主体能否对资源执行动作 | [授权如何工作](../../catalog/cedar-docs/authorization.md) |
| 主体（principal） | 发起请求的用户、服务或角色 | [授权请求与 PARC](../01-model/01-parc.md) |
| 动作（action） | 主体想执行的操作，通常映射一个 API | [策略语法基础](../../catalog/cedar-docs/policy-syntax.md) |
| 资源（resource） | 动作作用的对象，如文档、仓库、剧集 | [实体与实体层级](../../catalog/cedar-docs/entities.md) |
| 上下文（context） | 请求时的瞬时事实，如 IP、时间、MFA、同意记录 | [授权如何工作](../../catalog/cedar-docs/authorization.md) |
| PARC | Principal、Action、Resource、Context 四元组 | [授权请求与 PARC](../01-model/01-parc.md) |

## 策略与实体

| 术语 | 含义 | 对应条目 |
|---|---|---|
| 实体（entity） | 有类型、id、属性和父级的对象 | [实体与实体层级](../../catalog/cedar-docs/entities.md) |
| UID | 实体唯一标识，写作 `Type::"id"` | [术语与核心概念](../../catalog/cedar-docs/terminology.md) |
| permit | 允许策略；至少一条命中且无 forbid 时才 Allow | [策略结构与 permit/forbid](../02-policy/01-structure.md) |
| forbid | 拒绝策略；任意一条命中即 Deny | [策略结构与 permit/forbid](../02-policy/01-structure.md) |
| 作用域（scope） | principal、action、resource 的匹配范围 | [策略语法基础](../../catalog/cedar-docs/policy-syntax.md) |
| 条件（condition） | `when` 或 `unless` 子句 | [数据类型与操作符](../02-policy/02-data-and-operators.md) |
| 模板（template） | 带 `?principal`、`?resource` 等占位符的可复用策略 | [策略模板](../../catalog/cedar-docs/templates.md) |
| 模板链接策略 | 用具体值填充模板后形成的独立策略 | [模板与 JSON 策略](../02-policy/03-templates-json.md) |
| 命名空间（namespace） | 用 `::` 分隔的类型前缀，如 `Taxpreparer::` | [Cedar Schema 格式](../../catalog/cedar-docs/schema-format.md) |

## 模型、验证与工程

| 术语 | 含义 | 对应条目 |
|---|---|---|
| schema | 声明实体类型、属性、父级和动作签名 | [Schema 概览](../../catalog/cedar-docs/schema.md) |
| validation | 用 schema 检查策略的类型、属性和动作引用 | [策略验证](../../catalog/cedar-docs/validation.md) |
| level validation | 按请求所需的数据切片验证策略，而不是要求全部实体 | [策略验证与 level validation](../03-schema/02-validation.md) |
| RBAC | 基于角色的访问控制，用组/角色授予权限 | [授权模式](../../catalog/cedar-docs/auth-patterns.md) |
| ABAC | 基于主体、资源、上下文属性的访问控制 | [授权模式](../../catalog/cedar-docs/auth-patterns.md) |
| default deny | 没有 permit 命中时默认拒绝 | [安全模型](../../catalog/cedar-docs/security.md) |
| forbid overrides permit | 任一 forbid 命中即拒绝，优先级高于 permit | [安全模型](../../catalog/cedar-docs/security.md) |
| symcc | 把策略编译成 SMT 约束并做形式化验证的工具 | [符号验证 symcc](../../catalog/cedar/symcc.md) |

## 阅读路线：初学者

目标是从零建立“请求—实体—策略—决策”的直觉，不急着写生产策略。

1. [为什么需要 Cedar](../00-intro/01-why-cedar.md)：先理解把授权从业务代码里拆出来的动机。
2. [授权请求与 PARC](../01-model/01-parc.md) 和 [实体、属性、组与层级](../01-model/02-entities.md)：掌握四个输入和实体图。
3. [PhotoFlash：贯穿全书的例子](../01-model/03-scenario.md)：用一个照片分享应用串起概念。
4. [策略结构与 permit/forbid](../02-policy/01-structure.md)：亲手写第一条策略。
5. [CLI 快速上手](../04-sdk/02-cli.md) 和 [TinyTodo 教程](../05-practice/01-tinytodo.md)：把策略跑起来，看真实请求怎样得到 ALLOW/DENY。

遇到不熟的词，回到本页表格；想读官方定义，点“对应条目”里的链接。

## 阅读路线：应用开发者

目标是把 Cedar 接进服务，并让策略可测试、可发布。

1. [用 Schema 建模授权世界](../03-schema/01-schema.md)：先定实体和动作，不要先写策略。
2. [策略验证与 level validation](../03-schema/02-validation.md)：让错误在 CI 暴露。
3. [Rust SDK：把 Cedar 集成进应用](../04-sdk/01-rust-sdk.md)：掌握 `Request`、`Entities`、`Authorizer` 的调用顺序。
4. [模板与 JSON 策略](../02-policy/03-templates-json.md)：需要动态授权时用模板，不要拼接字符串。
5. [授权模式](../../catalog/cedar-docs/auth-patterns.md)：把 HTTP 端点映射到单资源、创建、列表、批量等模式，决定实体切片怎么取。
6. [六个真实用例](../05-practice/02-use-cases.md)：看别人怎样处理租户、角色、层级和同意。
7. [测试、版本与生态](../06-security/02-testing-versioning.md)：上线前补齐夹具、CLI 回归和迁移方案。

## 阅读路线：安全审查者

目标是判断“这套策略在最坏情况下会不会放行不该放行的请求”。

1. [安全模型与最佳实践](../06-security/01-security.md)：共享责任、默认拒绝、输入边界、策略存储。
2. [策略验证](../../catalog/cedar-docs/validation.md)：确认验证覆盖了哪些错误，哪些仍需人工判断。
3. [安全模型](../../catalog/cedar-docs/security.md)：对照官方的责任划分和攻击面说明。
4. [策略示例](../../catalog/cedar-docs/policy-examples.md)：用官方例子检查自己的写法是否偏离惯例。
5. [六个真实用例](../05-practice/02-use-cases.md)：重点看 `forbid` 护栏、屏蔽列表、同意记录和 context 注入。
6. [测试、版本与生态](../06-security/02-testing-versioning.md)：检查 DENY 夹具、symcc 不变量和回滚路径。
7. [符号验证 symcc](../../catalog/cedar/symcc.md)：需要证明而非抽样时，读完全部性质和反例用法。

审查时建议固定问：有没有默认放行的路径；`forbid` 出错被跳过会怎样；实体 id 是否可复用；策略库谁能改；context 是否来自可信服务端；迁移期间旧策略是否仍然生效。

## 怎么用知识库

`catalog/` 是按来源组织的精读条目，和本书章节互相引用。每个条目顶部标注了来源 commit、原路径和许可证；`source-snapshots/` 保存同一 commit 的英文原文，适合对照代码和术语。若只想知道某个 API 或语法点，直接看对应条目；若想系统学习，按上面的路线读章节，再回到条目查细节。

书中所有相对链接都以 `book/` 下的章节为起点；在生成的 HTML 中，它们会自动指向对应页面。