# 用 Schema 建模授权世界

策略回答“谁可以对什么做什么”，Schema 则回答“这个世界里有哪些东西”。它声明应用支持的实体类型、这些类型的属性与父子关系，以及可用的动作和每个动作适用的主体、资源、上下文。没有 Schema，Cedar 仍能解析和运行策略；有了 Schema，才能做类型检查、请求校验，并把授权模型当成一份可审阅的契约。官方说明见 [Schema 概览](../../catalog/cedar-docs/schema.md)，语法细节见 [Cedar Schema 格式](../../catalog/cedar-docs/schema-format.md)。

## Schema 声明了什么

一个 Schema 由零个或多个命名空间组成。每个命名空间里可以有三类定义：实体类型（entity type）、动作（action）和公共类型（common type）。实体类型描述主体与资源，例如 `User`、`Album`、`Photo`；动作描述操作，例如 `viewPhoto`、`uploadPhoto`。公共类型只是给一组属性形状起名字，避免在多个实体或动作里重复抄写同一段 record。

Schema 不负责认证，也不负责判断“Alice 是不是管理员”。它只规定数据长什么样。真正的权限判断仍由 permit/forbid 策略完成，两者的分工见 [授权如何工作](../../catalog/cedar-docs/authorization.md)。

## 命名空间与限定名

命名空间用 `::` 分隔，作用域内的定义可以不加前缀互相引用；跨命名空间必须写全名。下面的 `PhotoFlash` 中可以直接写 `User`，而在策略或其他命名空间里要写 `PhotoFlash::User`。动作的全名还会带上固定的 `Action` 类型，例如 `PhotoFlash::Action::"viewPhoto"`。

```cedarschema
namespace PhotoFlash {
  entity User in UserGroup = {
    "department": String,
    "jobLevel": Long,
  };
  entity UserGroup;
  entity Album in Album = {
    "account": Account,
    "private": Bool,
  };
  entity Account = {
    "admins"?: Set<User>,
    "owner": User,
  };
  entity Photo in Album = {
    "account": Account,
    "private": Bool,
  };
}
```

命名空间名不能包含空白、控制字符或注释，也不能使用保留的 `__cedar`。同一个命名空间不能重复声明，里面的同名定义也不允许重复。

## 实体类型：成员关系与属性

`entity User in [Group]` 里的 `in` 声明成员关系，也就是这种实体的直接父实体可以是哪些类型。父类型可以写一个，也可以写方括号列表。属性写在 `{ ... }` 中，类型可以是 `Bool`、`String`、`Long`、实体类型、`Set<T>` 或嵌套 record。属性名既可以是标识符，也可以是字符串。

```cedarschema
entity User in [Group] {
    personalGroup: Group,
    delegate?: User,
    blocked: Set<User>,
    team: Team,
} tags String;
```

这里 `personalGroup` 必填，`delegate` 后面的 `?` 表示可选，`blocked` 是用户集合，`tags String` 表示该类型实体可以带任意多个字符串标签。省略属性声明等价于空 record。Cedar 4.3 之后还可以写 `entity Group enum ["G1", "G2", "G3"];` 限定实体 id 只能是枚举值；4.6 之后可以用 `external entity` 先声明、后链接定义。

成员关系不是“继承属性”。父实体主要用于 `in` 判断，例如 `principal in Group::"admins"`。层级与组的完整语义见 [实体与实体层级](../../catalog/cedar-docs/entities.md)。

## 可选属性与 has

属性默认必填。可选属性若直接读取，实体又恰好没有该属性，求值会报错；出错策略在授权时被忽略，只留下诊断信息。因此策略应先判断存在性：

```cedar
permit (
    principal,
    action == PhotoFlash::Action::"viewPhoto",
    resource
)
when {
    principal has delegate &&
    principal.delegate.jobLevel > 5
};
```

`has` 放在 `&&` 左侧，利用短路避免访问不存在的属性。验证器也会把未加保护的访问标为错误，详见 [策略验证](../../catalog/cedar-docs/validation.md)。

## 动作与 appliesTo

动作定义用 `appliesTo` 限定主体类型、资源类型和上下文形状。`principal` 与 `resource` 必填，可以是一个类型或类型列表；`context` 可省略，省略时等价于空 record。动作还可以用 `in` 加入动作组，便于写粗粒度策略。

```cedarschema
action ViewDocument in [ReadActions, ExampleNS::Action::"Write"] appliesTo {
    principal: [User,Public],
    resource: Document,
    context: {
        network: ipaddr,
        browser: String
    }
};
```

动作名是实体 id，不是实体类型；因此权限请求里的 action 是 `Action::"ViewDocument"`（带命名空间时再加前缀）。`appliesTo` 是验证器的关键输入：看到 `action == ...::"viewPhoto"`，它就能推断 `principal` 必然是 `User`、`resource` 必然是 `Photo`，从而检查属性访问是否合法。

## 公共类型：给重复形状起名

当多个动作共享同一段 context，或几个实体共享同一组属性时，反复抄写既冗长又容易写歪。公共类型用 `type 名字 = 类型` 声明一次，再在需要的地方引用。它可以出现在任何允许写类型的位置，也可以嵌套引用其他公共类型。

```cedarschema
type commonContext = {
    ip: ipaddr,
    is_authenticated: Bool,
    timestamp: Long
};
action view appliesTo {
    principal: User,
    resource: File,
    context: commonContext
};
action upload appliesTo {
    principal: User,
    resource: Server,
    context: commonContext
};
```

公共类型不能形成循环，例如 `type A = Set<B>; type B = {"a": A};` 会被解析器拒绝。类型名冲突时，Cedar 按“公共类型 > 实体类型 > 原始/扩展类型”的顺序解析；要强制指向内置类型，可写 `__cedar::Long` 这样的全限定名。Schema 中的实体、动作、公共类型和命名空间都可以加 `@doc("...")` 之类的注解，供文档工具读取。

## Cedar 格式与 JSON 格式

同一个 Schema 有两种等价写法。Cedar 格式接近策略语法，适合手写；JSON 格式基于 JSON Schema，适合程序生成和交换。JSON 中每个命名空间包含 `entityTypes`、`actions`，可选 `commonTypes`；成员关系写成 `memberOfTypes`，属性形状写成 `"type": "Record"` 加 `attributes`，可选属性写 `"required": false`。

```json
{
    "ExampleCo::Personnel": {
        "entityTypes": {
            "Employee": {
                "shape": {
                    "type": "Record",
                    "attributes": {
                        "name": { "type": "String" },
                        "jobLevel": { "type": "Long" },
                        "numberOfLaptops": {
                            "type": "Long",
                            "required": false
                        }
                    }
                }
            },
            "System": {}
        },
        "actions": {
            "remoteAccess": {
                "appliesTo": {
                    "principalTypes": ["Employee"],
                    "resourceTypes": ["System"]
                }
            }
        }
    }
}
```

两种格式可以互转：

```bash
cedar translate-schema --direction cedar-to-json --schema photoflash.cedarschema
cedar translate-schema --direction json-to-cedar --schema photoflash.json
```

建模时建议从请求的三个要素倒推：先列出主体类型和资源类型，再写属性，最后为每个动作填 `appliesTo` 和 `context`。这样得到的 Schema 既能验证策略，也能直接约束请求数据。Schema 还是人、策略和工具之间的共同语言；模型一旦写错，后面的验证只会巩固错误前提，所以值得在动手写策略前多花时间推敲。下一章会把它接入验证流程，并讨论 level validation 与数据切片。