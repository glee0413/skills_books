---
id: cedar-docs/json-schema
title: JSON Schema 格式
description: Cedar 的 JSON schema 格式，说明命名空间、entityTypes、actions 与 commonTypes 的结构和属性类型写法。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_schema/json-schema.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_schema/json-schema.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_schema/json-schema.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# JSON Schema 格式

这是 Cedar schema 的 JSON 表示，与 [Cedar 格式](./schema-format.md)等价，Cedar CLI 可以在两者之间转换。一个 schema 包含一个或多个命名空间。

## 命名空间

每个命名空间必须有两个 JSON 对象 `entityTypes` 与 `actions`，可选第三个 `commonTypes`，三者顺序任意。主体的类型与资源类型写在 `entityTypes`，具体动作写在 `actions`——这种分离是因为动作在 schema 里是逐个定义的实体（类型都是 `Action`），而主体和资源只定义**类型**，具体实体在实体存储中创建。命名空间名必须是合法标识符，不能包含保留的 `__cedar`，并会自动前置到作用域内所有类型上：

```json
{
    "ExampleCo::Database": {
        "entityTypes": {
            "Table": {
                ...
            }
        },
        "actions": {
            "createTable": {
                ...
            }
        }
    }
}
```

上面这段实际定义的是实体类型 `ExampleCo::Database::Table` 与动作实体 `ExampleCo::Database::Action::"createTable"`。跨命名空间引用要写全限定名，例如 `"name": "ExampleCo::Clients::Manufacturer"`。命名空间可以加 `annotations`，但没有命名空间的声明不能加注解。还有一条限制：不能用命名空间内的定义遮蔽空命名空间里的同名定义。改动命名空间名会连带要求修改策略和其他命名空间中的引用。

## entityTypes

`entityTypes` 是主体与资源类型的集合，每个条目包含类型名、`memberOfTypes`、`shape`、可选的 `tags` 与 `annotations`：

```json
"entityTypes": {
    "EntityTypeName1": {
        "memberOfTypes": [ "parentGroupTypeName1", "parentGroupTypeName2", … ],
        "shape": { … }
    },
    "EntityTypeName2": {
        "memberOfTypes": [ "parentGroupTypeName1", "parentGroupTypeName2", … ],
        "shape": { … }
    }
}
```

- **类型名**必须是规范化标识符，不能含空格、换行、控制字符或注释。
- **`memberOfTypes`** 列出可作为直接父实体的类型。留空或省略表示该类型不能有父实体。同命名空间只写类型名，跨命名空间要带前缀，例如 `"Aws::Cognito::UserPool_1::UserGroup"`。
- **`shape`** 必须是 `Record` 并给出 `attributes`；省略 `shape` 等价于没有数据，即属性为空 record。
- **`tags`** 指定该类型实体允许的标签类型；不写就不允许有标签。
- 某些版本还支持 `enum`，直接列出合法 EID。

属性默认**必填**，因此策略可以假定它一定存在；加 `"required": false` 才变为可选：

```json
"jobLevel": {
    "type": "Long",
    "required": false
},
```

## 属性类型

`type` 可以是 `"String"`、`"Long"`、`"Boolean"`（也接受等价的 `"Bool"`）、`"Record"`、`"Set"`、`"Entity"`、`"Extension"`、`"EntityOrCommon"`，或某个公共类型名。前三个无需附加信息，其余写法如下。

`Record` 内嵌属性表，结构与实体 `shape` 相同：

```json
"features" : {
    "type" : "Record",
    "attributes": {
        "age" : {
            "type": "Long"
        },
        "height": {
            "type": "Long"
        },
        "eyecolor": {
            "type": "String"
        }
    }
}
```

`Entity` 必须用 `name` 指明实体类型；`Set` 用 `element` 描述成员；`Extension` 用 `name` 指明扩展类型，也可以直接写 `{"type": "ipaddr"}`，两者等价：

```json
"Owner": {
    "type": "Entity",
    "name": "User"
}
```

```json
"Admins": {
    "type": "Set",
    "element": {
        "type": "Entity",
        "name": "User"
    }
}
```

```json
"gateway": {
    "type": "Extension",
    "name": "ipaddr"
}
```

`EntityOrCommon` 是更贴近 Cedar 格式的写法，名字既可能是实体类型也可能是公共类型；两者同名时优先按公共类型解释。它也是 CLI 从 Cedar 格式转 JSON 时的输出形式。

## actions

`actions` 里每个条目对应一个动作实体。键是**实体标识符**而不是类型名，因此可以包含 Cedar 字符串里合法的任意内容，例如 `"ViewPhoto"`。在策略中引用时写作 `MyApplicationNamespace::Action::"ViewPhoto"`。

`memberOf` 声明动作组归属，省略即不属于任何组；组本身也是动作，必须在 `actions` 中定义。跨命名空间的组要同时给出 `id` 与 `type`。下面的三个动作演示了两点：`read` 的两类类型列表都是 `[]`，因此它只能当动作组、不能出现在请求里；`viewPhoto` 与 `listAlbums` 只写 `id` 就加入了同命名空间的 `read` 组：

```json
"actions": {
    "read": {
        "appliesTo": {
            "principalTypes": [],
            "resourceTypes": []
        }
    },
    "viewPhoto": {
        "memberOf": [
            {
                "id": "read"
            }
        ],
        "appliesTo": {
            "principalTypes": [ "User" ],
            "resourceTypes": [ "Photo" ]
        }
    },
    "listAlbums": {
        "memberOf": [
            {
                "id": "read"
            }
        ],
        "appliesTo": {
            "principalTypes": [ "User" ],
            "resourceTypes": [ "Account" ]
        }
    }
}
```

`appliesTo` 的 `context` 与实体 `shape` 格式相同，省略即空 record，此时策略访问 `context` 属性会报验证错误。下面的写法要求请求必须带 `field1`（Boolean）与 `field2`（Long），可选的 `field3` 是 String：

```json
"actions": {
    "SomeAction": {
        "appliesTo": {
            "principalTypes": [ ... ],
            "resourceTypes": [ ... ],
            "context": {
                "type": "Record",
                "attributes": {
                    "field1": { "type": "Boolean" },
                    "field2": { "type": "Long" },
                    "field3": { "type": "String",
                                "required": false }
                }
            }
        }
    }
}
```

## commonTypes

公共类型把重复的结构抽出来，写法就是一份属性类型声明。最典型的场景是多个动作共享同一个上下文形状：定义 `ReusedContext` 后，`view` 与 `upload` 都写 `"context": { "type": "ReusedContext" }`，策略里照样用 `context.is_authenticated` 访问。公共类型也能用于实体 `shape`：把 `Person` 定义成 record，再让 `Employee` 与 `Customer` 都写 `"shape": { "type": "Person" }`。类型之间可以互相引用，但不能形成环——例如 `Name` 作为 `String` 的别名可用，若 `Name` 反过来依赖 `Person` 就会报错。

## 完整示例的结构

原文的 PhotoFlash schema 把上述内容串了起来：`User` 可属于 `UserGroup`，带 `department` 与 `jobLevel`；`Account` 有一个 `owner` 和可选的 `admins` 集合；`Album` 可嵌套 `Album`，带 `private` 与 `account`；`Photo` 可放入 `Album`，同样带 `private` 与 `account`。动作 `viewPhoto` 面向 `User` 与 `Photo`，`listAlbums` 面向 `User` 与 `Account`，`uploadPhoto` 面向 `User` 与 `Album`，三者的 context 都要求 `authenticated`，其中上传还带一个嵌套的 `photo` record（`file_size` 与 `file_type`）。

对应的 Cedar 格式见 [Cedar Schema 格式](./schema-format.md)，验证行为见[策略验证](./validation.md)。