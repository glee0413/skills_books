---
id: cedar-examples/tinytodo-tutorial
title: TinyTodo 教程
description: 跟随官方教程跑通 TinyTodo，理解实体层级、四条策略和一次授权判定的完整路径。
project: cedar-examples
sourceCommit: f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37
sourceRef: f4d2dbb
sourcePath: tinytodo/TUTORIAL.md
snapshotPath: source-snapshots/cedar-examples/tinytodo/TUTORIAL.md
sourceUrl: https://github.com/cedar-policy/cedar-examples/blob/f4d2dbbab361a38372e6d6fcfc7b777eb1b30c37/tinytodo/TUTORIAL.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# TinyTodo 教程

TinyTodo 是官方最完整的示例：Rust 写的 HTTP 服务端，加一个 Python 写的交互式 CLI，用户和团队在其中组织、共享任务清单。教程的价值不在于应用本身，而在于它把“命令 → Cedar 请求 → 策略判定 → 业务执行”这条链路完整摊开给你看。

## 架构：判定只在服务端

服务端用 Warp（构建在 tokio 之上）接收 HTTP 请求，数据（`List`、`Team`、`User`）和策略都放在内存里。CLI 只是客户端，**不做任何强制**；所有权限检查都发生在服务端。

当用户执行命令，服务端把请求解析成内部对象，交给对应的 handler。handler 先调用 Cedar 授权引擎，引擎结合策略与实体数据给出 `Allow` 或 `Deny`。允许才继续业务逻辑，拒绝则返回 “Access denied”。这个顺序很关键：授权是业务的前置守卫，不是事后审计。

## 构建与一次完整会话

需要 Rust 和 Python3：

```sh
> git clone https://github.com/cedar-policy/cedar-examples
> cd cedar-examples/tinytodo
> pip3 install -r requirements.txt
> cargo build --release
```

`cargo build` 会从 crates.io 拉取 `cedar-policy-core`、`cedar-policy-validator` 等包，产出服务端 `tiny-todo-server`；CLI 是 `tinytodo.py`。若报 `error: no matching package named cedar-policy found`，说明 Cargo 找不到 Cedar 包，应检查 registry 配置。

下面是教程会话的节选，覆盖了主线操作：

```shell
> python -i tinytodo.py
>>> start_server()
TinyTodo server started on port 8080
>>> set_user(andrew)
User is now andrew
>>> create_list("Cedar blog post")
Created list ID 0
>>> create_task(0,"Draft the post")
Created task on list ID 0
>>> create_task(0,"Revise and polish")
Created task on list ID 0
>>> toggle_task(0,1)
Toggled task on list ID 0
>>> share_list(0,interns,read_only=True)
Shared list ID 0 with interns as reader
>>> set_user(aaron)
User is now aaron
>>> get_list(0)
=== Cedar blog post ===
List ID: 0
Owner: User::"andrew"
Tasks:
1. [X] Draft the post
2. [ ] Revise and polish
>>> toggle_task(0,2)
Access denied. User aaron is not authorized to Toggle Task on [0, 2]
>>> set_user(kesha)
User is now kesha
>>> get_list(0)
Access denied. User kesha is not authorized to Get List on [0]
>>> stop_server()
TinyTodo server stopped on port 8080
```

`andrew` 是列表所有者，所以增删改查全通；`aaron` 属于 `interns`，被加为 reader，只能读不能写；`kesha` 属于 `temp`，而 `interns` 的父是 `temp` 而非反向，层级不可达，所以连读都不行。

## 数据建模：实体、层级与 entities.json

Cedar 把主体、资源、动作都建模为**实体**。实体由实体类型、EID（实体标识）、若干属性和若干父实体组成；类型加 EID 构成 UID，写作 `Type::"EID"`。父关系构成有向无环图，`in` 运算符判断可达性：`A in B` 成立，当且仅当 `A` 等于 `B`，或 `A` 是 `B` 的后代。

TinyTodo 有五类实体：`User`、`Team`、`Action`、`List`、`Application`。`List` 有 `name`、`owner`、`readers`、`editors` 和 `tasks` 五个属性；`readers`/`editors` 是列表创建时新建的 `Team` 实体，共享就是把目标用户或团队挂到这两个团队下面。除应用实体自身外，所有实体都以 `Application::"TinyTodo"` 为父；当请求没有具体资源时（如创建列表），就用它当资源。

服务端不会直接拿 `Entity` 对象做业务运算，而是在 `objects.rs` 里定义原生结构，例如 `List` 含 `uid`、`owner`、`name`、`tasks`、`readers`、`editors`。这些原生对象收在 `EntityStore` 里，通过 `as_entities` 和 `From<List>` 等转换 trait 变成 Cedar 实体。启动数据来自 `entities.json`：

```json
"User::\"aaron\"": {
    "euid": "User::\"aaron\"",
    "location": "ABC17",
    "joblevel": 5,
    "parents": [
        "Team::\"interns\"",
        "Application::\"TinyTodo\""
    ]
},
...
"Team::\"interns\"": {
    "uid": "Team::\"interns\"",
    "parents": [
        "Application::\"TinyTodo\"",
        "Team::\"temp\""
    ]
},
```

`aaron` 带 `location` 和 `joblevel` 两个属性，后面那条 ABAC 策略会用到；`interns` 没有属性，只有父团队。

## 请求路径：从 handler 到 is_authorized

`AppContext::spawn` 读取 `entities.json`、`tinytodo.cedarschema` 和 `policies.cedar`，校验策略后启动监听。每个 handler 的第一行几乎都是授权调用：

```rust
fn create_task(&mut self, r: CreateTask) -> Result<AppResponse> {
    self.is_authorized(&r.uid, &*ACTION_CREATE_TASK, &r.list)?;
    let list = self.entities.get_list_mut(&r.list)?;
    let task_id = list.create_task(r.name);
    Ok(AppResponse::TaskId(task_id))
}
```

请求对象 `CreateTask` 含 `uid`、`list`、`name` 三个字段，类型分别是 `UserUid`、`ListUid`、`String`——用包装类型强制实体类型正确。`is_authorized` 内部把三者组装成 `Request`，再调用：

```rust
let response = self.authorizer.is_authorized(&q, &self.policies, &es);
```

`es` 来自 `as_entities`，是本次判定可见的全部实体。返回 `Decision::Allow` 则 `Ok(())`，`Deny` 则包装成 `Error::AuthDenied` 并携带诊断信息。`?` 让拒绝直接短路，业务代码一行都不会执行。

## 四条核心策略与三个扩展

核心策略共四条：

```
// Policy 0: Any User can create a list and see what lists they own
permit (
    principal,
    action in [Action::"CreateList", Action::"GetLists"],
    resource == Application::"TinyTodo"
);

// Policy 1: A User can perform any action on a List they own 
permit (principal, action, resource)
when {
    resource is List &&
    resource.owner == principal
};

// Policy 2: A User can see a List and its tasks if they are either a reader or editor
permit (
    principal,
    action == Action::"GetList",
    resource
)
when {
    principal in resource.readers ||
    principal in resource.editors
};

// Policy 3: A User can update a List and its tasks if they are an editor
permit (
    principal,
    action in [
        Action::"UpdateList",
        Action::"CreateTask",
        Action::"UpdateTask",
        Action::"DeleteTask"
    ],
    resource
)
when { principal in resource.editors };
```

四条分别覆盖：任何用户可创建列表和列出自己的列表；所有者对列表有全部权限；读者或编辑者可读；编辑者可写。判定 `kesha` 对 `List::"0"` 执行 `CreateTask` 时，四条依次为假——动作不匹配、不是 owner、不是 `GetList`、不在 editors——于是拒绝。

`share_list` 走 `add_share`：先授权 `Action::"EditShare"`（policy 1 放行），再取出列表对应角色的团队 UID，把被共享方 `insert_parent` 到该团队。于是 `Team::"interns"` 成为 `Team::"1"` 的子节点，所有成员经传递闭包自动 `in List::"0".readers`。

教程还给了三个扩展，演示“改策略不改代码”。管理员全权策略用注解命名：

```
// Policy 4: Admins can perform any action on any resource
@id("admin-omnipotence")
permit (
    principal in Team::"admin",
    action,
    resource in Application::"TinyTodo"
 );
```

`@id` 在 Cedar 中没有内置语义，是应用自己赋予的命名约定，会出现在授权响应的 `reason` 里。另一条 `forbid` 禁止实习生建列表，说明 **forbid 永远压过 permit**，且与策略顺序无关。最后一条是 ABAC 风格的“护栏”：

```
forbid(
    principal,
    action,
    resource is List
) unless {
    principal.joblevel > 6 && principal.location like "DEF*" ||
    principal.location == resource.owner.location
};
```

它不授予权限，只撤销已有 permit 给出的访问，决策依据是主体和资源的字符串、数字属性，而不是团队关系。

## 验证与练习

`spawn` 里用 `Validator::new(schema.clone())` 配 `ValidationMode::default()` 校验策略，`output.validation_passed()` 为假就终止启动。可以故意把 policy 2 的 `readers` 改成 `Readers`，或把 `Action::"CreateTask"` 拼错，观察验证器报未知属性或未知动作。schema 分三部分：类型定义、实体定义（含父类型与属性）、动作定义（`appliesTo` 声明主体与资源的合法类型）。例如 `entity List in [Application] = {...}` 和 `action CreateList, GetLists appliesTo { principal: [User], resource: [Application] };`。

教程末尾留了四个练习：把实体存储持久化；为 `User`/`Team` 增加增删改命令；实现限时共享（`features/timebox` 分支有参考实现）；以及实现**实体切片**——只把请求相关的实体传给引擎，降低 `as_entities` 的开销。最后一个练习带警告：切片算法依赖当前策略形态，若新增一条需要 `resource.owner` 团队信息的策略，旧切片就会给出错误答案。这正是“优化必须跟着策略演进而复审”的典型例子。