# TinyTodo 教程：从命令到授权决策

TinyTodo 是 Cedar 官方教程应用：用户创建任务列表，并把列表以 reader 或 editor 身份分享给其他用户或团队。它把“谁能做什么”全部写进 Cedar 策略，业务代码只负责在每条命令前问一次授权引擎。这一章沿着一条真实命令，走完从 HTTP 请求到 `Allow`/`Deny` 的整条链路。原文见 [TinyTodo 教程精读](../../catalog/cedar-examples/tinytodo-tutorial.md)。

## 架构：客户端发命令，服务器做决定

TinyTodo 由两部分组成：Rust 写的服务器，用 Warp 提供 HTTP 接口；Python 写的 CLI，用交互式命令调用服务器。列表、团队、用户和策略都放在服务器内存里，进程退出就消失。关键约束是：客户端不做任何强制执行，所有访问控制都在服务器端完成。

服务器收到命令后，先把请求翻译成 Cedar 的 `Request`，连同策略和实体一起交给授权引擎。引擎返回 `Allow` 才继续执行业务逻辑，返回 `Deny` 就直接把“未授权”错误发回客户端。

构建需要 Rust 和 Python 3：

```bash
git clone https://github.com/cedar-policy/cedar-examples
cd cedar-examples/tinytodo
pip3 install -r requirements.txt
cargo build --release
```

随后进入交互模式，启动服务器并以 `andrew` 身份创建列表、添加任务：

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
>>> toggle_task(0,1)
Toggled task on list ID 0
```

创建列表由策略 0 授权；添加任务和切换完成状态则由“所有者可以对其列表做任何事”的策略 1 授权。

## 实体模型：User、Team、List 与 Application

TinyTodo 的实体类型有 `User`、`Team`、`List` 和 `Application`。`User` 有 `location` 和 `joblevel` 属性；`Team` 没有属性；`List` 有 `name`、`owner`、`readers`、`editors` 和 `tasks`，其中 `tasks` 是记录集合，每条记录含 `id`、`name`、`state`。当请求没有具体列表可作为资源时，例如“创建列表”，就用 `Application::"TinyTodo"` 充当资源。

用户和团队的初始定义写在 `entities.json`，服务器启动时读取；TinyTodo 没有创建或删除用户、团队的命令，共享只会改动它们的父关系：

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
"Team::\"interns\"": {
    "uid": "Team::\"interns\"",
    "parents": [
        "Application::\"TinyTodo\"",
        "Team::\"temp\""
    ]
}
```

用户对象的标识字段叫 `euid`，团队叫 `uid`，这只是两个原生结构体的字段命名不同，最后都会被转成 `EntityUid`。

实体层级是有向无环图，`in` 判断的是可达性。因为 `aaron` 的父实体包含 `interns`，而 `interns` 的父实体包含 `temp`，所以 `User::"aaron" in Team::"interns"` 和 `User::"aaron" in Team::"temp"` 都成立；反向不成立。这一点直接决定了共享和越权测试的结果。

运行期的列表用 Rust 原生结构保存，再通过 `EntityStore::as_entities` 转成 Cedar 实体。原生 `List` 的字段刻意与实体属性一一对应，只是把引用换成 UID：

```rust
pub struct List {
    uid: ListUid,
    owner: UserUid,
    name: String,
    tasks: Vec<Task>, // Invariant, `tasks` must be sorted
    readers: TeamUid,
    editors: TeamUid,
}
```

## 四条策略：默认拒绝与拒绝优先

`policies.cedar` 的核心只有四条：

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

策略 0 让任何用户创建列表、列出自己拥有的列表；策略 1 把列表上的全部动作交给所有者；策略 2 只允许 reader 和 editor 读取；策略 3 只允许 editor 写入。reader 与 editor 的差别就落在这里：reader 能通过策略 2，却过不了策略 3。

Cedar 默认拒绝，没有 `permit` 命中就是 `Deny`。`forbid` 则优先于任何 `permit`，而且策略顺序不影响结果。教程后面新增的 `admin-omnipotence` 和“实习生不得创建列表”就是利用这两个性质，在不改服务器代码的情况下改变行为。

## 一次 CreateTask 的授权流程

以“用户想往列表里加任务”为例。HTTP 请求先被解析成 `CreateTask`，其中包含发起人、目标列表和任务名：

```rust
pub struct CreateTask {
    pub uid: UserUid,
    pub list: ListUid,
    pub name: String,
}
```

处理器第一行就调用授权，通过后才修改数据：

```rust
fn create_task(&mut self, r: CreateTask) -> Result<AppResponse> {
    self.is_authorized(&r.uid, &*ACTION_CREATE_TASK, &r.list)?;
    let list = self.entities.get_list_mut(&r.list)?;
    let task_id = list.create_task(r.name);
    Ok(AppResponse::TaskId(task_id))
}
```

`is_authorized` 把三个 UID 组装成 `Request`，上下文为空，并附带 schema 做请求校验：

```rust
pub fn is_authorized(
    &self,
    principal: impl AsRef<EntityUid>,
    action: impl AsRef<EntityUid>,
    resource: impl AsRef<EntityUid>,
) -> Result<()> {
    let es = self.entities.as_entities(&self.schema);
    let q = Request::new(
        Some(principal.as_ref().clone().into()),
        Some(action.as_ref().clone().into()),
        Some(resource.as_ref().clone().into()),
        Context::empty(),
        Some(&self.schema),
    )
    .map_err(|e| Error::Request(e.to_string()))?;
    info!(
        "is_authorized request: principal: {}, action: {}, resource: {}",
        principal.as_ref(),
        action.as_ref(),
        resource.as_ref()
    );
    let response = self.authorizer.is_authorized(&q, &self.policies, &es);
    info!("Auth response: {:?}", response);
    match response.decision() {
        Decision::Allow => Ok(()),
        Decision::Deny => Err(Error::AuthDenied(response.diagnostics().clone())),
    }
}
```

假设 `kesha` 想给 `andrew` 的 `List::"0"` 加任务。策略 0 的动作不匹配；策略 1 要求 `owner == principal`，不成立；策略 2 只匹配 `GetList`；策略 3 虽然包含 `CreateTask`，但 `kesha` 不在 `editors` 里。四条全部为假，请求被拒绝。把主体换成 `andrew`，策略 1 立即命中。设置 `RUST_LOG=info` 可以看到每次请求和响应，诊断里的 `reason` 会列出真正生效的策略 ID。

## 共享列表：reader 与 editor 的差别

`andrew` 把列表共享给 `interns` 团队，只读：

```shell
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
```

`aaron` 能读，因为他是 `interns` 成员，而 `interns` 是列表的 reader；他不能改，因为修改要求 editor。`kesha` 属于 `temp`，`interns` 属于 `temp`，但方向反过来不成立，所以 `kesha in interns` 为假。

共享的实现不是改策略，而是改实体层级：

```rust
fn add_share(&mut self, r: AddShare) -> Result<AppResponse> {
    self.is_authorized(&r.uid, &*ACTION_EDIT_SHARE, &r.list)?;
    let list = self.entities.get_list(&r.list)?;
    let team_uid = list.get_team(r.role).clone();
    let target_entity = self.entities.get_user_or_team_mut(&r.share_with)?;
    target_entity.insert_parent(team_uid);
    Ok(AppResponse::Unit(()))
}
```

每个列表创建时会生成自己的 `readers` 和 `editors` 团队。共享就是把目标用户或团队挂到对应团队下面，于是 `principal in resource.readers` 通过传递性成立。撤销共享则移除这条父关系，授权立即失效，不需要重新加载策略。

## Schema 校验与测试

`tinytodo.cedarschema` 描述实体属性和每个动作允许的主体、资源类型。`List` 的声明同时给出了父实体类型和属性形状：

```json
type Task = {
    "id": Long,
    "name": String,
    "state": String,
};

type Tasks = Set<Task>;
entity List in [Application] = {
  "editors": Team,
  "name": String,
  "owner": User,
  "readers": Team,
  "tasks": Tasks,
};
```

动作声明则把每个动作绑定到合法的请求形状。下面是创建列表、列举列表和编辑共享三个动作的片段：

```json
action CreateList, GetLists appliesTo {
  principal: [User],
  resource: [Application]
};
action EditShare appliesTo {
  principal: [User],
  resource: [List]
};
```

`appliesTo` 同时服务于策略验证和请求校验：验证器据此知道 `Action::"CreateList"` 的 `principal` 一定是 `User`、`resource` 一定是 `Application`，于是可以判断策略里的属性访问和实体引用是否可能成立；`Request::new` 带上 schema 时，运行期也会拒绝不符合这些类型假设的请求。服务器在反序列化时还要保证请求对象的 UID 类型正确，否则验证通过并不等于运行期安全。

在改代码前先用 CLI 验证策略与 schema 是否一致：

```bash
cedar validate \
  --schema tinytodo.cedarschema \
  --policies policies.cedar
```

服务器启动时也会做同样的验证。把策略 2 里的 `readers` 改成 `Readers`，或者把 `Action::"CreateTask"` 拼成 `Action::"CrateTask"`，验证会分别报“未知属性”和“未知动作”，服务器直接拒绝启动。schema 的写法见 [Schema 概览](../../catalog/cedar-docs/schema.md)，验证机制见 [策略验证](../../catalog/cedar-docs/validation.md)。

最后跑一遍仓库自带的单元测试，覆盖所有者读写、未授权访问、撤销共享、只读共享和可编辑共享：

```bash
python -m unittest test_tinytodo.py
```

测试会自己启动和停止服务器，因此运行前要确保 8080 端口没有残留实例。把这些场景与上面的策略逐条对照，就能理解 TinyTodo 为什么能在不改业务代码的前提下调整权限。