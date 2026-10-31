# 授权请求与 PARC

上一篇说 Cedar 只做判断。这一篇拆开看：它到底被问了什么，又按什么步骤给出答案。理解这两件事之后，策略里那些看似奇怪的写法——为什么 `forbid` 总是赢、为什么属性写错不一定报错——都会变得顺理成章。

## 一次请求问四个问题

Cedar 的授权请求在问：**这个主体，能不能在这个上下文里，对这个资源执行这个动作？** 四个要素合称 PARC：

- **P**（principal）：主体，发起请求的用户、服务或其他身份；
- **A**（action）：动作，主体想执行的操作；
- **R**（resource）：资源，动作作用的对象；
- **C**（context）：上下文，这次请求特有的瞬时信息，比如来源 IP、时间、是否通过了多因素认证。

前三项是实体引用，第四项是一条记录（record）。一个具体请求可以写成：

```text
P = User::"jane"
A = Action::"viewPhoto"
R = Photo::"vacation.jpg"
C = {}            // 空记录
```

这四项的分工不是随意的。P、A、R 是系统里相对稳定的部分，描述“谁对什么做什么”；C 是每次请求都可能不同的部分，描述“这一次调用有什么特殊之处”。把 IP 白名单、MFA 状态塞进主体的属性里，会让实体数据随请求漂移；放进 `context` 才是本意。官方文档把这一点列为一条最佳实践：[不要把主体、动作、资源的信息放进 context](../../catalog/cedar-docs/best-practices.md)。

## 请求之外：策略与实体数据

光有 PARC 还不够。引擎还要两样东西：**策略集合**，以及**实体数据**——主体属于哪些组、照片在哪个相册、资源有哪些属性。

概念上，你可以认为引擎在判断时能看到应用的全部策略和全部实体数据。工程上这往往做不到，也没必要：一个请求只可能命中一小部分策略，只需要与它相关的那片实体数据。哪些算相关，是个需要认真回答的问题，漏掉一个组关系就可能把本该放行的请求判成拒绝。Cedar 提供了分级验证（level validation）来帮你推导每个请求需要哪些数据，详见[策略验证](../03-schema/02-validation.md)。

有一条保守但常用的做法：策略全给，实体数据按请求范围裁剪。策略数量通常可控，漏策略比漏实体更难发现。

## 匹配：只看作用域的三个表达式

拿到请求后，引擎逐条策略判断它是否**满足**（satisfy）这个请求。第一步是**匹配**（match），只看作用域里的三个表达式：

- 主体约束，比如 `principal == User::"jane"` 或 `principal in Group::"janeFriends"`；
- 动作约束，比如 `action == Action::"viewPhoto"`；
- 资源约束，比如 `resource == Photo::"vacation.jpg"` 或 `resource in Album::"janeTrips"`。

把请求里的 P、A、R 分别代入，三个都得到 `true`，这条策略才匹配。作用域没写的部分视为 `true`：`permit (principal, action, resource)` 匹配一切请求。

一个重要的设计细节：这三个表达式**不会**求值出错。它们只做实体比较和层级判断，不读取属性，因此不存在“属性不存在”这类错误。错误只可能出现在后面的条件里。

## 条件：按书写顺序求值

匹配之后才轮到 `when` 和 `unless`。规则很简单：

- `when` 的表达式必须为 `true`；
- `unless` 的表达式必须为 `false`。

但求值顺序有讲究。引擎按书写顺序逐个条件求值，遇到第一个不满足的条件就停下，整条策略返回 `false`，后面的条件不再看。如果某个条件求值出错，整条策略返回 `error`，同样不再往下走。

这意味着 `when` 和 `unless` 的先后不只是风格问题。当两个子句都可能出错时，你在诊断信息里看到的错误取决于谁先被求值。写条件时，把“便宜且能排除大多数请求”的判断放在前面，既省时间，也让错误更容易定位。

## 合并：三条规则

每条策略现在都有了一个结果：`true`、`false` 或 `error`。引擎按三条规则合并：

1. 只要有任意一条 `forbid` 为 `true`，最终结果是 `Deny`；
2. 否则，只要有任意一条 `permit` 为 `true`，最终结果是 `Allow`；
3. 否则，最终结果是 `Deny`。

请注意规则 1 的措辞：任意一条。一百条 `permit` 也压不住一条命中的 `forbid`。这就是“拒绝优先”（forbid overrides permit）——`forbid` 定义的是权限的护栏，而不是与 `permit` 投票。

## 完整例子：Deny 是怎么来的

把上一节的规则跑一遍。请求是“`jane` 能否对 `vacation.jpg` 执行 `viewPhoto`”，实体数据里 `User::"jane"` 属于 `Group::"kevinsFriends"`，`Photo::"vacation.jpg"` 的所有者是 `User::"kevin"`，标签是 `["Private","Work"]`。策略库有四条：

```cedar
// P1: Jane can perform any action on photo vacation.jpg
permit (
    principal == User::"jane",
    action,
    resource == Photo::"vacation.jpg"
);
```

```cedar
// P2: Members of kevinFriends can view Kevin's photos tagged Holiday
permit (
    principal in UserGroup::"kevinFriends",
    action == Action::"viewPhoto",
    resource
)
when {
    resource.tags.contains("Holiday")
};
```

```cedar
// P3: Nobody can view a Private photo unless they own it
forbid (
    principal,
    action == Action::"viewPhoto",
    resource
)
when { resource.tags.contains("Private") }
unless { principal == resource.owner };
```

```cedar
// P4: Owners can update tags
permit (
    principal,
    action == Action::"updateTags",
    resource
)
when { principal == resource.owner };
```

逐条看：

- **P1 满足**。主体和资源都精确命中，动作未受限，没有条件。
- **P2 不满足**。作用域全部匹配——按给定的实体数据，`jane` 确实在 `kevinsFriends` 组里（原文这里 `UserGroup` 与 `Group`、`kevinFriends` 与 `kevinsFriends` 的拼写不一致，不影响结论）——但 `when` 要求标签含 `"Holiday"`，而这张照片只有 `"Private"` 和 `"Work"`，条件为 `false`。
- **P3 满足**。动作是 `viewPhoto`，资源带 `"Private"`，而 `jane` 不是所有者 `kevin`，所以 `unless` 为 `false`，条件链通过。
- **P4 不满足**。它在匹配阶段就失败了：请求的动作是 `viewPhoto`，不等于 `updateTags`，条件根本不会被求值。

结果是 `Deny`，起决定作用的是 P3。这里有两点值得记住：**一条 `permit` 满足并不能保证放行**（P1 就满足了）；**`forbid` 不需要和 `permit` 成对出现**，它只拒绝，不授予。P3 命中时，即使 P1 再宽松，结果仍然是拒绝。

## 出错跳过与诊断信息

`error` 怎么处理？Cedar 的选择是**跳过**（skip on error）：出错的策略不参与合并，就像它不存在一样。这个选择看起来危险，其实是经过权衡的。

如果改成“任何策略出错就整体拒绝”，那么一个跑了很久、有一百条策略的系统，可能因为新加的第一百零一条策略写错了属性名，突然拒绝所有请求。这种故障模式杀伤力太大。跳过则把错误的爆炸半径限制在那一条策略上，同时引擎会把出错的策略 ID 和错误细节放进响应里，应用可以自行决定：记日志、告警，或者在关键路径上把错误升级为拒绝。

除了错误，响应里还有**决定策略**（determining policies）：`Allow` 时是那些满足的 `permit`，`Deny` 时是那些满足的 `forbid`，如果是因为无人命中而拒绝，这个列表就是空的。排查“为什么他能看”和“为什么他不能看”时，先看这个列表，比逐条读策略快得多。

最后提醒一句：不要吞掉诊断信息。把 `Deny` 和 `error` 都当成拒绝在安全上是保守的，但在可维护性上是灾难——你会在某个凌晨发现所有照片都打不开，却不知道是哪条策略在报错。授权引擎的返回值不是布尔值，而是一份带证据的决定；完整的算法描述见[授权如何工作](../../catalog/cedar-docs/authorization.md)。