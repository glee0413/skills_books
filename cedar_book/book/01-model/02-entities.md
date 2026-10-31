# 实体、属性、组与层级

上一篇里，请求由主体、动作、资源组成，策略靠比较这些值来决定放行。但 `User::"jane"` 到底是什么？`resource in Album::"janeTrips"` 里的“在……里”又是怎么判断的？答案都在实体（entity）这套模型里。Cedar 的实体不只是三个特殊变量，它是一套通用的对象系统：有类型、有标识符、有属性，还能组成层级。

## 实体是授权世界的建模单位

一个实体由两部分唯一确定：**实体类型**和**实体标识符**（EID）。两者合起来叫实体唯一标识（UID），写法是 `类型::"标识符"`：

```cedar
User::"jane"                 // 类型 User，标识符 jane
Action::"ViewPhoto"          // 类型 Action，标识符 ViewPhoto
UserGroup::"kevinFriends"    // 类型 UserGroup，标识符 kevinFriends
```

主体、动作、资源都是实体，但它们的类型不必互不相同。用户目录就是典型例子：读自己的资料时，主体和资源是同一个用户。Cedar 允许这样写：

```cedar
// Allow every user to read their own data in the user directory
permit (
    principal,
    action == Action::"readUser",
    resource
)
when {
    principal == resource // The same entity
};
```

除了 `Action` 这个保留类型——动作必须用它，且动作实体不允许有属性和标签——语言层面并不区分一个实体“应该”当主体还是资源。这个约束交给 Schema 去表达。另一个保留字是 `__cedar`，任何包含它的类型名都不能使用。

## 属性与标签

属性是实体的附加信息：用户有部门，照片有拍摄时间，相册有所有者。策略里用点号读取：

```cedar
SomeUser.name
SomeEmployee.department
SomePhoto.description
```

也可以用下标写法，两者等价：`SomeUser["name"]`。

读属性有两个陷阱。第一，**属性不存在会报错**，不是返回 `false`。所以在读可选属性之前，先用 `has` 确认：

```cedar
when {
    principal has jobLevel && principal.jobLevel >= 5
}
```

第二，**类型必须匹配**。Schema 里声明 `age` 是 `Long`，写成 `principal.age > "21"` 就会验证失败——带引号的 `21` 是字符串，`>` 不接受字符串。这类错误在验证阶段就能抓出来，不用等到线上。

标签（tag）和属性很像，区别在于**键名是运行时才知道的**。属性名在写策略和 Schema 时就固定了，标签的键则可以由用户自定义。因此读标签要用专门的方法：`.hasTag()` 判断存在，`.getTag()` 取值。标签适合“用户自己打的标记”，属性适合“系统建模时就确定的字段”。把用户自定义的键塞进属性，Schema 会变得无法描述。

## 实体数据长什么样

实体不是 Cedar 凭空知道的，应用要在请求里把它们送进来。官方 README 的最小例子是一段 JSON：

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

三个字段各司其职：`uid` 是身份，`attrs` 是属性，`parents` 是它属于哪些组或容器。第一张照片的 `parents` 指向 `Album::"jane_vacation"`，第二张指向 `Album::"jane_secrets"`。只改这一个字段，同一批策略对两张照片的判断就完全不同——层级关系是数据，不是代码。JSON 的完整格式见[实体 JSON 格式](../../catalog/cedar-docs/json-format.md)。

## 组与层级

Cedar 没有专门的“组”类型。所谓组，就是一个被其他实体写进 `parents` 的实体。如果 A 的 `parents` 里有 B，我们就说 A 是 B 的成员。

这个定义的好处是它不限于“用户属于组”。你可以用它表达：

- **组的嵌套**：`collegeFriends` 可以是 `janeFriends` 的成员，组里有组，形成多层结构；
- **资源容器**：相册套相册，照片放进最内层，和外层文件夹天然连通；
- **动作分组**：把 `viewPhoto`、`listPhotos` 归入 `readOnly` 动作组，策略里写 `action in Action::"readOnly"` 就能一次覆盖一组动作。

一个实体可以有**多个** parent。一张照片既在 `Vacations` 相册里，也可以同时在 `picturesOfBob` 里，只要在 `parents` 数组里多写一项。这让“同时属于多个集合”不需要任何额外机制。

## `in` 判断的是后代关系

层级建好之后，策略用 `in` 来查询：

```cedar
// Jane's friends can view all photos in her janeTrips album
permit (
    principal in Group::"janeFriends",
    action in [Action::"view", Action::"comment"], 
    resource in Album::"janeTrips"
);
```

理解 `in` 需要记住四条性质：

- **传递**：A 在 B 里，B 在 C 里，则 A 在 C 里。所以 `janeTrips` 里嵌套的 `janeVacation` 和 `conference` 也自动被这条策略覆盖，不需要为每个子相册再写一条。
- **自反**：实体总在自己的层级里，`principal in User::"bob"` 在主体就是 bob 时为真。这意味着 `resource in Album::"janeTrips"` 在资源就是那个相册本身时也成立。
- **不对称**：`Group::"all" in User::"bob"` 为假。方向反了就是另一个问题。
- **右侧可以是集合**：`principal in [Group::"a", Group::"b"]` 表示属于其中任意一个。

另外，`in` 的左侧必须是实体。`1 in Group::"janeFriends"` 会同时导致求值错误和验证错误。层级是实体之间的关系，不是值之间的关系。

## 命名空间：给类型加前缀

当一个策略库里同时存在多个产品时，类型名会撞车。厂商既提供托管数据库，又提供家具设计服务，那么 `Action::"createTable"` 到底是建表还是做桌子？`Table::"0d6169ca-b246-43a7-94b9-8a68a9e8f8b3"` 是数据库表还是家具？

解法是命名空间：给类型加一个用 `::` 分隔的前缀。

```cedar
Database::Action::"createTable"
Database::Table::"c7b981f1-97e4-436b-9af9-21054a3b30f1"
Furniture::Action::"createTable"
Furniture::Table::"c7b981f1-97e4-436b-9af9-21054a3b30f1"
```

命名空间可以任意嵌套，`ExampleCo::Database::Table::"…"` 也是合法 UID。要注意的是，这种层级只是名字上的约定，语言并不赋予它结构含义，也不会自动产生父子关系。真正的关系仍然由 `parents` 决定。命名空间在 Schema 中声明，详见[用 Schema 建模](../03-schema/01-schema.md)。

## 标识符会变，权限不会

最后是一条安全警告，值得单独成节。

本书的例子用 `jane`、`bob` 这样的短标识符，是为了好读。**生产环境绝不能这样**。假设员工 jane 离职，账号被删除，半年后公司招了一个新 jane，复用了同一个用户名。所有写着 `User::"jane"` 的策略会立刻把前员工的全部权限授予新人，而 Cedar 无法分辨这两个人——对它来说，UID 相同就是同一个实体。

规则是：**标识符必须唯一且永不复用**。实践上用 UUID，并在后面加注释写清是谁：

```cedar
principal == User::"a1b2c3d4-e5f6-a1b2-c3d4-EXAMPLE11111", // alice
```

这条规则对主体和资源同样适用。资源 ID 被回收同样危险：删掉的相册 ID 分配给了别人的相册，旧策略就会把访问权交给错误的对象。标识符是策略与数据之间唯一的连接点，连接点一旦可复用，整套授权模型就失去了确定性。这也是[安全模型](../../catalog/cedar-docs/security.md)反复强调的一条工程约束。