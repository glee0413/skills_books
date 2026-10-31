# PhotoFlash：贯穿全书的例子

模型讲完了，接下来需要一个具体的世界，把抽象概念落在地上。Cedar 官方文档造了一个照片分享应用，叫 **PhotoFlash**。本书后面几乎所有策略都围绕它展开——同一套实体、同一批用户、同一批相册，这样你每读一章，都能看到新语法作用在熟悉的对象上，而不是每章换一个玩具例子。

## 一个虚构的照片应用

PhotoFlash 让用户存储、整理和分享照片。用户可以上传照片到自己的账户，再把照片组织进相册。相册可以嵌套，一张照片也可以同时属于多个相册。照片还能打标签，比如 `private`、`work`、`fun`，也可以记录可见人物这类自定义元数据，之后按标签或拍摄时间、地点搜索。

分享是核心功能。用户可以把照片和相册分享给其他用户，也可以分享给**用户组**。组和相册一样灵活：组可以嵌套，一个人可以同时属于多个组。这正是授权模型要处理的东西——不是一张静态的权限表，而是一张会生长、会嵌套的关系网。

## 类型名与标识符的写法

在进入细节之前，先记住文档的命名约定，本书沿用：

- **实体类型**用 PascalCase：`User`、`UserGroup`、`Album`、`Photo`、`Account`；
- **实体标识符和属性名**用 camelCase：`janeFriends`、`createdDate`、`sharedWith`。

类型首字母大写、标识符首字母小写，这条约定让策略一眼能分清 `Group::"janeFriends"` 里哪部分是类型、哪部分是 ID。它不是语法要求，但在一个几十条策略的文件里，可读性就是可维护性。

## Jane 的相册、照片和三个组

主角叫 jane。她有一个账户，账户里放着她的相册和照片。她建了三个组来代表人脉：

- `janeFamily`：家人；
- `janeFriends`：朋友；
- `janeCoworkers`：同事。

这些组可以互相嵌套：`collegeFriends` 可以是 `janeFriends` 的成员，项目组也可以并进 `janeCoworkers`。她的相册同样嵌套：`janeTrips` 是旅行总相册，里面套着 `janeVacation`（度假）和 `conference`（会议）。照片放在最内层。

画成实体数据，大致是这样几条关系：

```json
{ "uid": { "type": "User", "id": "bob" },
  "attrs": {},
  "parents": [{ "type": "Group", "id": "janeFriends" }] }
```

```json
{ "uid": { "type": "Photo", "id": "vacation.jpg" },
  "attrs": { "tags": ["private"] },
  "parents": [{ "type": "Album", "id": "janeVacation" }] }
```

`bob` 的 `parents` 说明他是 `janeFriends` 的成员；`vacation.jpg` 的 `parents` 只有 `janeVacation`，没有 `janeTrips`。后者不需要写——`janeVacation` 自己的 `parents` 指向 `janeTrips`，`in` 的传递性会把这条链补全。层级只需记录直接父级，这是它能保持简洁的原因。

照片的所有者和 jane 的账户也是属性，分别指向 `User::"jane"` 和 `Account::"jane"`，上面为了篇幅省略了。还要注意组类型的名字：官方文档有时写 `Group`，有时写 `UserGroup`，这不是两个类型，而是示例之间的命名差异；真实系统里由你的 Schema 定一个，然后全文统一。

## 三条起步策略

Jane 想让朋友们看她旅行相册里的照片，还能评论：

```cedar
// Jane's friends can view all photos in her janeTrips album

permit (
    principal in Group::"janeFriends",
    action in [Action::"view", Action::"comment"],
    resource in Album::"janeTrips"
);
```

一条策略同时用了三个 `in`：主体在组里、动作在动作集合里、资源在相册层级里。因为 `in` 传递，`janeVacation` 和 `conference` 里的照片自动被覆盖，将来新建的子相册也自动生效。这就是“按关系授权”相对“按清单授权”的优势。

第二条是护栏：带 `private` 标签的资源，只有账户主人能碰。

```cedar
// Only the owner can access any resource tagged "private"

forbid ( principal, action, resource )
when { resource.tags.contains("private") }    // assumes that resource has "tags"
unless { resource in principal.account };     // assumes that principal has "account"
```

这条策略没有限定任何主体、动作或资源，它对全部请求生效。`when` 判断资源是否带私密标签，`unless` 给账户主人留了例外：只要资源在请求者的账户层级里，就不触发拒绝。

第三条把修改标签的权限收紧到照片所有者：

```cedar
// Only the photo's owner can change its tags
permit (
    principal,
    action == Action::"updateTags",
    resource
)
when { principal == resource.owner };
```

三条策略覆盖了三种典型形态：基于组和层级的授权、全局护栏、基于所有权的属性判断。后面的章节会把它们逐步改写成模板、加上 Schema 约束、用 CLI 跑出决策。

## forbid 只拒绝，不授予

上面那条 `forbid` 有一个容易误解的地方。它写的是“除账户主人外，谁都不能访问私密资源”。很多人读完会以为账户主人因此获得了访问权。**并没有。**

`unless` 只是让这条 `forbid` 不命中，它不产生任何 `Allow`。账户主人要真正访问自己的私密照片，还需要一条 `permit` 明确授予：

```cedar
// The account owner may do anything inside their own account
permit (
    principal,
    action,
    resource
)
when { resource in principal.account };
```

这是 Cedar 默认拒绝的直接后果：**豁免不等于授权**。`forbid` 的例外只是“不拦”，放行必须另有出处。设计策略时，先想清楚每条 `forbid` 豁免了谁，再确认这些人在别处确实有 `permit`——否则你会得到一个安全但不可用的系统，而且很难查出少写了哪一条。

## 两个容易踩的细节

**第一，例子里的 ID 不能照搬到生产。** `jane`、`bob` 是为了好读。真实系统必须用 UUID 这类永不复用的值，否则前员工离职、新人复用用户名时，旧策略会把权限自动交给新人。资源 ID 同理。写 UUID 时在后面加注释标明是谁：

```cedar
principal == User::"a1b2c3d4-e5f6-a1b2-c3d4-EXAMPLE11111", // alice
```

**第二，`when` 和 `unless` 的顺序会影响你看到哪个错误。** 引擎按书写顺序求值条件，遇到错误就停。上面那条 `forbid` 里，`when` 读 `resource.tags`，`unless` 读 `principal.account`。如果某个资源没有 `tags`、某个主体没有 `account`，两个子句都会出错，但你只会看到先求值的那个。排查线上问题时，这个细节决定了你第一眼看到的是什么。

## 接下来读什么

这一章只搭了舞台。后面的路线是：

- 想弄清策略的语法骨架，读[策略结构与 permit/forbid](../02-policy/01-structure.md)；
- 想理解条件里能写哪些表达式，读[数据类型与操作符](../02-policy/02-data-and-operators.md)；
- 想让 PhotoFlash 的实体有正式定义，读[用 Schema 建模授权世界](../03-schema/01-schema.md)；
- 想马上跑一次授权，读 [CLI 快速上手](../04-sdk/02-cli.md)；
- 想看一个完整应用的端到端实现，读 [TinyTodo 教程](../05-practice/01-tinytodo.md)。

PhotoFlash 的原文描述、图示和完整注意事项在[示例场景](../../catalog/cedar-docs/scenario.md)。读的时候不妨留意：文档用同一批实体讲了整本手册，这个选择本身就是一堂课——好的授权模型是稳定的，语法和工具会变，实体和关系不该跟着变。