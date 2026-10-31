# 六个真实用例：文档云、GitHub、酒店、标签角色、税务、流媒体

上一章的 TinyTodo 是完整应用，重点在“请求怎样进入 Cedar”。这一章看官方示例仓库的六个用例，学习把业务语言翻译成实体、动作和策略。每个目录都有策略、schema、实体和 `ALLOW/`、`DENY/` 夹具；酒店还提供静态与模板两版，税务用模板表达临时授权。

读时固定问四件事：谁在什么条件下能做什么；实体图怎样表达关系；哪条规则写成 `permit`，哪条写成 `forbid`；哪些反例进了 `DENY/`。总览见 [六个真实用例条目](../../catalog/cedar-examples/use-cases.md)。

## 文档云：三条共享轴与跨租户屏蔽

文档云模拟 Google Drive 或 Dropbox：用户创建、查看、评论、修改、删除文档，也管理共享权限；系统多租户，必须防止用户通过共享或屏蔽列表骚扰他人。

实体模型把共享拆成三条轴：`Document.isPrivate` 控制是否私有，`viewACL`、`modifyACL`、`manageACL` 指向 `DocumentShare` 组，`publicAccess` 取 `none`、`view`、`edit`。`User` 有 `personalGroup` 和 `blocked`，`Group` 有 `owner`，`Public::"public"` 代表未认证访问者。

关键策略先用 owner 兜底，再用 ACL 扩展：

```cedar
permit (
  principal,
  action == Action::"ViewDocument",
  resource
)
when { principal in resource.viewACL }
unless { resource.isPrivate };
```

真正体现多租户安全的是 `forbid`：只要双方任意一侧的 `blocked` 包含对方，查看、修改、删除、改共享等动作全部拒绝。策略先写 `principal has blocked`，因为 `ViewDocument` 的主体可能是 `Public`，而 `blocked` 只在 `User` 上；没有存在性检查，策略无法通过验证。用例还有两条护栏：私有文档只有 owner 能碰，请求必须已认证。护栏不替代具体授权，而是把“任何情况下都不能发生”的条件钉死。

值得学的是：把看、改、分享拆成不同 ACL，不要让一个布尔值承担全部语义；把认证状态放进上下文，而不是主体属性；用 `forbid` 表达屏蔽、私有性这类跨动作不变量。

## GitHub：用组层级表达五种仓库角色

GitHub 用例只覆盖组织视角的一个子集。`User` 和 `Team` 都能加入 `UserGroup`，`UserGroup` 还可以继续嵌套；`Repository` 用五个 `UserGroup` 属性表示 reader、triager、writer、maintainer、admin 五档角色；`Issue` 通过 `repo` 指回仓库，通过 `reporter` 指回报告人。

策略几乎全部是“主体是否在某个组里”：

```cedar
permit (
  principal,
  action == Action::"delete_issue",
  resource
)
when { principal in resource.repo.readers && principal == resource.reporter };
```

这一条同时用了角色（reader）和资源属性（报告人）。维护者删除 issue 由另一条策略按 `resource.repo.maintainers` 放行；管理员执行五个 `add_*` 动作，靠 `action in [...]` 一次覆盖。

值得学的是“资源到角色的映射放在资源属性里”。五档角色不是全局角色，而是每个仓库各自的一组人；把组实体挂到 `Repository` 上，就不需要维护巨大的“用户—仓库—角色”外部表。`Issue` 存 `Repository` 实体引用而不是仓库 id，策略用 `resource.repo.readers` 跳转，实体图承担关联查询。

## 酒店连锁：层级资源与模板化授权

酒店用例的资源是一棵树：`Hotel` 可以嵌套 `Hotel`，`Property` 属于 `Hotel`，`Reservation` 属于 `Property`。用户对某家酒店或物业拥有 viewer、member、admin 三种角色之一，角色只覆盖特定资源类型，例如只能看预订，不能看支付信息。

静态版本把授权写进用户属性：`viewPermissions`、`memberPermissions` 是 `PermissionsMap`，按资源类型存放 `Set<Hotel>` 和 `Set<Property>`；admin 直接存两个集合。策略检查 `resource in principal.viewPermissions.hotelReservations`，利用 `in` 沿实体层级向上匹配。

模板版本删掉这些 map，改成每个“角色—资源类型”一个模板：

```cedar
@id("MemberReservation")
permit (
  principal == ?principal,
  action in
    [Action::"viewReservation",
     Action::"updateReservation",
     Action::"createReservation"],
  resource in ?resource
);
```

授予 Alice 对 `Property::"Green"` 的 member 权限，就新增一条链接：

```json
    {
        "template_id": "MemberReservation",
        "link_id": "AliceMemberGreen",
        "args": {
            "?principal": "User::\"Alice\"",
            "?resource": "Property::\"Green\""
        }
    }
```

模板版把“谁被授予了什么”从用户属性搬到策略存储，实体数据更干净，授权变更也不必重写 `entities.json`。静态版更容易整体快照和审查，模板版更适合频繁授予和撤销；两版共用 schema 和夹具。

值得学的是：层级资源用 `in` 表达继承，不要把父链拍平成字符串；授权关系会随业务增长时，优先考虑模板而不是膨胀的属性集合；`@id` 让策略可被测试输出和审计日志引用。

## 标签与角色：ABAC 与动态生成的策略

标签角色用例来自虚构公司 ABC Technologies。用户属于一个或多个 `Role`，每个角色对应一个动作组，例如 `Role-A Actions`；用户在每个角色下还有一组标签，按“标签组”组织，例如 `country` 的取值为 `germany`、`italy`，特殊值 `ALL` 匹配一切。资源 `Workspace` 也有标签。规则是：用户在该角色下的标签与资源标签匹配时，才允许执行该角色动作组的动作。

标签存在嵌套的可选属性里：`User.allowedTagsForRole["Role-A"].country`、`Workspace.tags.country`。策略对每个标签组写一段几乎相同的 `when`，逻辑是“资源标签值全部包含在用户标签值中”，并特判 `ALL`：

```cedar
when
{
  // match the country tag if present for this role
  principal.allowedTagsForRole has "Role-A" &&
  (if
     principal.allowedTagsForRole["Role-A"] has country
   then
     if
       resource.tags has country
     then
       principal.allowedTagsForRole["Role-A"].country.contains("ALL") ||
       resource.tags.country.contains("ALL") ||
       principal.allowedTagsForRole
         ["Role-A"]
         .country
         .containsAll(
           resource.tags["country"]
         )
     else
       true
   else
     true)
}
```

独特之处不在语法，而在生命周期：新增角色要同时改 schema、增加动作组成员、复制策略；新增标签要改 schema，并给所有角色策略补一段 `when`。README 讨论了用 map 类型、宏和通用模板减少重复。ABAC 的“数据驱动”不免费，标签维度越多，同步成本越高；若标签频繁演进，先设计生成策略的模板和测试。

## 税务：组织匹配加客户同意

税务用例模拟一家为客户报税的公司。`Professional` 要读 `Client` 的 `Document`，必须同时满足两个条件：专业人员在组织、服务线、地点上与文档匹配（或被临时授权），且文档所有者已经同意该地区团队查看。组织匹配写成 `permit`，同意写成 `forbid`：

```cedar
permit (
  principal,
  action == Taxpreparer::Action::"viewDocument",
  resource
)
when
{
  principal.assigned_orgs
    .contains(
      {
        organization: resource.owner.organization,
        serviceline: resource.serviceline,
        location: resource.location
      }
    )
};

forbid (
  principal,
  action == Taxpreparer::Action::"viewDocument",
  resource
)
unless
{
  context.consent.client == resource.owner &&
  context.consent.team_region_list.contains(principal.location)
};
```

临时授权用模板 `adhoc-access`，链接时填入具体的 `Professional` 和 `Document`。把同意写成 `forbid` 而不是给每条 `permit` 加 `when`，以后新增临时授权就自动受同意约束，不会漏掉；代价是审计要同时看允许和拒绝。

值得学的是：把“资格”和“同意”分开建模，前者是主体与资源的匹配，后者是请求时携带、由所有者签发的凭证；`context.consent` 是结构化 record，不是布尔标志，能精确到地区列表；用 `forbid` 守住跨策略的全局前提。

## 流媒体：时间、会员档位与就寝时间

流媒体用例把内容分成 `Movie` 和 `Show`，会员分成 `FreeMember` 和 `Subscriber`，订阅又有 `standard`、`premium` 两档。基本规则很直白：订阅者能看非早鸟剧集、非付费点播电影；免费会员只能看免费内容。复杂的是三条时间规则：奥斯卡提名影片在颁奖礼前一个月可租可买；premium 会员提前 24 小时看早鸟剧集；儿童档案在就寝时段禁止观看。

这些规则依赖实验性的 `datetime` 扩展。请求上下文带 `now.datetime` 和 `now.localTimeOffset`，策略用 `datetime(...)`、`duration(...)`、`offset()`、`toTime()` 比较：

```cedar
@id("early-access-show")
permit (
  principal is Subscriber,
  action == Action::"watch",
  resource is Show
)
when
{
  resource.isEarlyAccess &&
  principal.subscription.tier == "premium" &&
  context.now.datetime >= resource.releaseDate.offset(duration("-24h"))
};
```

就寝规则是一条 `forbid`，在 6:00 到 21:00 之外拒绝儿童档案观看。它和早鸟 `permit` 同时命中时仍然拒绝，因为 `forbid` 优先。时间不是普通资源属性，必须由应用在请求时注入，并明确时区和本地偏移；策略只负责比较。

值得学的是：把当前时间放进 context，让决策可重放、可测试；用 `is` 限定主体和资源类型，避免不同会员共享策略时属性缺失；促销、早鸟、宵禁等临时规则用带 `@id` 的独立策略，结束后单独删除。

## 六个用例的共同模式

六个例子排成一条从静态到动态的光谱：文档云和 GitHub 用固定策略读实体属性；酒店把授权放进用户 map 或模板链接；标签角色按角色生成策略；税务把同意放进 context 并用 `forbid` 守住；流媒体进一步把时间变成 context。

它们都把关系放进实体图，把规则放进策略，把当下的事实放进 context。关系可以用属性、组或模板表达：属性适合读多写少、需要整体快照；模板适合频繁授予和精确撤销；动态生成策略适合标签维度多、结构稳定。

接下来读 [安全模型与最佳实践](../06-security/01-security.md)，看这些建模方式在安全上要注意什么；也可以回到 [TinyTodo 教程](01-tinytodo.md)，把策略片段放进可运行的请求链路。六个目录里的 `ALLOW/`、`DENY/` 夹具，则是下一章测试方法的现成素材。