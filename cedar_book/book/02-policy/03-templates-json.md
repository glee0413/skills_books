# 模板与 JSON 策略

前面两章写的都是静态策略：主体、动作、资源在文本里写死。真实系统里有两类需求会打破这种写法。第一类是“同一条规则要套用到很多主体或资源上”，例如每个用户分享相册时都生成一条权限；第二类是“策略由程序生成、存储和读取”，例如管理后台或策略服务。Cedar 分别用策略模板和 JSON 策略格式来应对。

## 模板：把变化的部分挖空

策略模板就是含有占位符的策略。占位符只有两个：`?principal` 和 `?resource`。下面这条模板允许某个主体查看和评论某个资源，除非资源带 `private` 标签：

```cedar
permit (
  principal in ?principal,
  action in [Action::"view", Action::"comment"], 
  resource in ?resource
)
unless {
  resource.tag =="private"
};
```

模板本身不是可执行的策略，不能直接参与授权决策。它描述的是一个“策略形状”，等待调用方填入具体的实体。

## 槽位能放在哪里

占位符的位置限制很严：只能出现在作用域中 `==` 或 `in` 的右侧。与 `is` 组合的 `in` 也算，但单独的 `is` 不算，因为 `?principal` 代表的是一个实体，而不是一个类型。两个槽位可以只用一个，也可以同时使用。

```cedar
principal == ?principal
resource in ?resource
```

把槽位放到条件里、动作上，或者放到 `==` 左边，都会被拒绝。这也说明模板的参数化能力是有边界的：它只能替换“哪个主体”和“哪个资源”，不能替换动作、属性名或条件里的常量。如果一条模板同时用了两个槽位，每次链接都必须为两个槽位都提供实体值，不能只填其中一个。

## 链接策略：填值并保持联动

填入具体值后得到的是模板链接策略（template-linked policy）。假设用户把 `vacationTrip` 相册分享给 `friendsAndFamily` 组，链接时传入 `UserGroup::"friendsAndFamily"` 和 `Album::"vacationTrip"`，其效果等同于下面这条静态策略：

```cedar
permit (
  principal in UserGroup::"friendsAndFamily",
  action in [Action::"view", Action::"comment"], 
  resource in Album::"vacationTrip"
)
unless {
  resource.tag =="private"
};
```

区别在于它并没有被真正展开成文本。链接策略始终指向模板，模板一改，所有链接策略立即使用新版本。修模板里的 `unless` 条件，比逐条改几百条策略安全得多。

代价是策略库和用户生命周期绑在了一起。新用户入职、转岗、离职，都要相应地创建或归档链接策略。离职时应该归档而不是删除，否则会丢失“谁曾经被允许做什么”的审计记录。角色越复杂，需要创建和清理的链接策略越多，这部分运维成本要在设计阶段就算进去。

## JSON 策略格式

手写用 Cedar 文本，程序读写则用 JSON。Cedar 为单条策略和整个策略集都定义了 JSON 表示。下面是一条普通策略：

```cedar
permit (
    principal == User::"12UA45",
    action == Action::"view",
    resource in Folder::"abc"
) when {
    context.tls_version == "1.3"
};
```

它的 JSON 表示如下：

```json
{
    "effect": "permit",
    "principal": {
        "op": "==",
        "entity": { "type": "User", "id": "12UA45" }
    },
    "action": {
        "op": "==",
        "entity": { "type": "Action", "id": "view" }
    },
    "resource": {
        "op": "in",
        "entity": { "type": "Folder", "id": "abc" }
    },
    "conditions": [
        {
            "kind": "when",
            "body": {
                "==": {
                    "left": {
                        ".": {
                            "left": {
                                "Var": "context"
                            },
                            "attr": "tls_version"
                        }
                    },
                    "right": {
                        "Value": "1.3"
                    }
                }
            }
        }
    ]
}
```

顶层固定是 `effect`、`principal`、`action`、`resource`、`conditions`，有注解时再加 `annotations`。作用域用 `op` 表示匹配方式：`All` 对应裸关键字，`==` 和 `in` 配 `entity`，`is` 配 `entity_type`，模板槽位则写成 `"slot": "?principal"`。

条件部分是一棵表达式树。变量写成 `{"Var": "context"}`，字面量写成 `{"Value": "1.3"}`，属性访问写成 `{".": {"left": {"Var": "context"}, "attr": "tls_version"}}`，二元运算写成 `{"==": {"left": {"Var": "context"}, "right": {"Value": "1.3"}}}` 这样的单键对象，集合和记录分别用 `Set` 与 `Record`。扩展函数直接用函数名作键，例如 `{"decimal": [{"Value": "10.0"}]}`。JSON 不保留注释、空白和换行，所以可读性要靠格式化工具补回来。

## JSON 策略集与模板链接

整个策略集用三个键表示：`staticPolicies`、`templates`、`templateLinks`。静态策略和模板都是“ID 到策略内容”的映射，链接则单独列出模板 ID、新策略 ID 和槽位取值：

```json
{
    "staticPolicies": {
        "policy0": {
            "effect": "permit",
            "principal": {
                "op": "==",
                "entity": { "type": "User", "id": "12UA45" }
            },
            "action": {
                "op": "==",
                "entity": { "type": "Action", "id": "view" }
            },
            "resource": {
                "op": "in",
                "entity": { "type": "Folder", "id": "abc" }
            },
            "conditions": []
        }
    },
    "templates": {
        "template0": {
            "effect": "forbid",
            "principal": {
                "op": "==",
                "entity": { "type": "User", "id": "12UA45" }
            },
            "action": {
                "op": "==",
                "entity": { "type": "Action", "id": "view" }
            },
            "resource": {
                "op": "in",
                "slot": "?resource"
            },
            "conditions": []
        }
    },
    "templateLinks": [
        {
            "templateId": "template0",
            "newId": "policy1",
            "values": {
                "?resource": {
                    "type": "Folder",
                    "id": "def"
                }
            }
        }
    ]
}
```

把模板误放进 `staticPolicies` 会直接报错，因为静态策略不允许含槽位；`values` 的键只能是 `?principal` 或 `?resource`，值必须是实体对象。

## 用模板，还是拼接字符串

最直接的替代方案是拼字符串：把实体 id 插进策略文本再解析。它看起来简单，问题却不少。id 里出现引号或反斜杠就会破坏语法；拼出来的策略无法在写入前确认类型正确；模板更新时，你得找出所有生成的文本逐条替换，漏掉一条就产生行为不一致；审计时也看不出这些策略来自同一条规则。

模板把这些问题交给 Cedar：槽位只接受实体值，链接时由 API 校验类型；模板与链接的关系被显式记录；改模板是一次原子操作。JSON 则进一步让程序不必生成文本，直接构造结构化对象，避免引号转义这一类错误。

但模板不是万能参数化。它只能替换主体和资源，不能替换动作或条件常量；它也会把策略数量和用户数量绑定。如果一条规则对所有同类主体都成立，优先用属性或组来表达，例如 `principal.department == "HardwareEngineering"`，而不是给每个人建一条链接。只有当“授权事实”确实是逐个主体、逐个资源累积出来的时候，模板才是合适的工具。

继续阅读：[策略模板](../../catalog/cedar-docs/templates.md)、[JSON 策略格式](../../catalog/cedar-docs/json-format.md)、[策略语法基础](../../catalog/cedar-docs/policy-syntax.md)，以及讲验证的 [策略验证与 level validation](../03-schema/02-validation.md)。