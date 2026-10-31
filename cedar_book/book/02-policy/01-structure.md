# 策略结构与 permit/forbid

Cedar 的授权决策不是应用代码里层层嵌套的 `if`，而是一组策略声明共同推导出来的结果。一条策略回答的问题是：在什么范围内、满足什么条件时，允许或拒绝。读懂一条策略只需要认出四块内容：效果（effect）、作用域（scope）、条件（conditions）和注解（annotations）。前两块必需，后两块可以省略，整条策略以分号结束。

## 效果：permit 与 forbid

`permit` 表示这条策略匹配时产生 `Allow`，`forbid` 表示匹配时产生 `Deny`。两者描述的都是单条策略的贡献，而不是最终决策。效果写在策略最外层，后面紧跟一对括号包起来的作用域。括号内三个元素用逗号分隔，顺序固定为 principal、action、resource；漏掉任何一个，策略都无法通过解析。

## 作用域：三个必填的匹配位

作用域由 `principal`、`action`、`resource` 三个元素组成，分别对应“谁在请求”“想做什么”“对什么做”。三者都必须出现，但可以写得很宽，也可以收得很窄：

```cedar
//matches any principal entity of any type
principal

//matches only the one specified entity of type User
principal == User::"alice"

//matches any principal in the hierarchy of the specified Group
principal in Group::"alice_friends"

//matches any principal of type User
principal is User

//matches any principal of type User in the hierarchy of the specified Group
principal is User in Group::"alice_friends"
```

`action` 和 `resource` 的写法对称。动作可以用列表一次列出多个，也可以指向动作组：

```cedar
action in [Action::"listAlbums", Action::"listPhotos", Action::"view"]
action in Action::"admin"
```

资源同样支持 `==`、`in`、`is`。因为 `in` 在实体层级上是传递的，`resource in Album::"alice_vacation"` 会同时覆盖嵌套子相册里的照片。作用域的宽窄不改变策略的结构，只改变它覆盖多少请求：把所有位置都写成裸关键字，等于对全系统放行；把三个位置都收成具体实体，则只影响那一个组合。默认拒绝的前提下，当一条规则本来就适用于整类资源时，宽 scope 加条件通常比逐条枚举更易维护，因为新增资源不需要新增策略。

有一个容易忽略的取舍：Cedar 文档建议不要把角色或组直接当作 principal。主体一旦是“角色”，就失去了用户属性，`principal.level >= 10` 这类条件再也写不出来。组更适合放在 `in` 的右边，而不是占据 principal 的位置。

## 条件：when 与 unless

条件是可选的补充约束。所有 `when` 子句必须为真，所有 `unless` 子句必须为假，策略才算匹配。最简单的用法是把主体和资源属性关联起来：

```cedar
permit (
    principal, 
    action == Action::"editPhoto", 
    resource
)
when {
   resource.owner == principal
};
```

这条策略没有限定具体的人或照片，只限定“操作者就是资源拥有者”，因此对任意用户、任意照片都成立。另一种常见写法是拒绝未使用多因素认证的请求：

```cedar
forbid ( principal, action, resource )
unless {
  context.authentication.usedMFA
};
```

`when` 和 `unless` 按书写顺序求值。如果两个子句都可能出错，顺序决定了你最终看到哪一个错误。条件也不限于实体属性，请求时刻的上下文一样可以参与判断，例如只允许在某个时间点之前提交的请求：

```cedar
when {
  context.time.now < 1698423180
}
```

## 注解：不影响决策的元数据

注解是挂在策略顶部的键值对，只能出现在效果之前。Cedar 求值时完全忽略它，但读取策略的服务可以拿它做审计、分组或灰度标记。注解的值可以省略，省略时等价于空字符串，所以 `@shadow_mode` 与 `@shadow_mode("")` 相同。

```cedar
@advice("My advice")
@id("My ID")
@shadow_mode
permit (
    ...
);
```

`@id` 在语言层面并不特殊，只是 Cedar CLI 恰好用它来设置策略 ID；通过 API 写入策略时，ID 通常由接口参数指定。

## 一个允许，一个拒绝

把两条策略放在一起，才能看出 permit 与 forbid 的分工。下面这条允许 Jane 的朋友查看和评论她旅行相册中的所有照片：

```cedar
permit (
    principal in Group::"janeFriends",
    action in [Action::"view", Action::"comment"], 
    resource in Album::"janeTrips"
);
```

但“朋友”不应该看到标记为私密的照片。于是再加一条全局兜底：

```cedar
forbid ( principal, action, resource )
when { resource.tags.contains("private") }
unless { resource in principal.account };
```

第二条策略没有指定任何主体、动作或资源，因此匹配所有请求，只在“资源带 private 标签且不在主体自己的账户下”时生效。它不授予任何权限；相册拥有者想看自己的私密照片，仍然需要第一条或其他 permit 明确允许。

## 默认拒绝与拒绝优先

所有策略求值完成后，Cedar 按两条规则合并结果：

- 至少有一条策略产生 `Allow`，且没有任何策略产生 `Deny`，最终才是 `Allow`。
- 只要有任意一条策略产生 `Deny`，或者一条 `Allow` 都没有，最终就是 `Deny`。

第一条规则的另一面是默认拒绝：策略库为空、或者没有一条 permit 匹配，请求都会被拒绝。第二条规则叫拒绝优先：显式 `Deny` 永远压过其他策略的 `Allow`。

这带来一个实用的建模习惯：permit 用来“发通行证”，forbid 用来“划硬边界”。不要试图用 permit 表达“除了某人以外都允许”，那应该写成一条宽泛的 permit 加一条精确的 forbid。也不要把 forbid 当成“取消某条 permit”的开关，它作用于整个请求，与 permit 之间没有配对关系。

还要记住一点：求值出错的策略会被跳过，而不是让请求失败。一条 permit 出错，可能表现为“本该允许却被拒绝”；一条 forbid 出错，可能表现为“本该拦住却放行”。因此条件里访问可能不存在的属性时，应先用 `has` 保护，这一点会在下一章展开。

想继续深入，可以对照阅读 [策略语法基础](../../catalog/cedar-docs/policy-syntax.md)、[策略示例](../../catalog/cedar-docs/policy-examples.md)，以及本书前一部分的 [授权请求与 PARC](../01-model/01-parc.md) 和 [实体、属性、组与层级](../01-model/02-entities.md)。