---
id: cedar-docs/policy-examples
title: 策略示例
description: 以 PhotoFlash 场景演示从精确授权、组与容器、ABAC 条件到 forbid 的典型策略写法。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/policy-examples.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/policy-examples.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/policy-examples.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 策略示例

这些示例基于 PhotoFlash 应用的 schema，覆盖从最窄到最宽的作用域，以及属性和上下文条件。示例场景见[PhotoFlash 示例场景](./scenario.md)，schema 写法见 [Cedar Schema 格式](./schema-format.md)。

## 授权到单个实体

允许 `alice` 查看照片 `VacationPhoto94.jpg`：

```Cedar
permit(
  principal == User::"alice", 
  action == Action::"view", 
  resource == Photo::"VacationPhoto94.jpg"
);
```

三个作用域都用 `==` 锁定到具体实体，这是范围最小的写法，适合处理例外授权。作用域越具体，策略越好读，验证时也越容易判断其影响范围。

## 组、容器与动作组

把主体换成组成员，就能一次授权整组人：

```Cedar
permit(
  principal in Group::"alice_friends", 
  action == Action::"view", 
  resource == Photo::"VacationPhoto94.jpg"
);
```

资源侧用 `in` 可以覆盖整个容器。下面的策略允许 `alice` 查看相册 `alice_vacation` 中的任意照片：

```Cedar
permit(
  principal == User::"alice", 
  action == Action::"view", 
  resource in Album::"alice_vacation"
);
```

动作也可以列成集合，或引用 schema 中定义的动作组。`action in [Action::"viewer_actions", Action::"edit"]` 这种写法把动作组和单个动作混在一个列表里；`action in Action::"admin_actions"` 则完全依赖动作组，组内新增的动作会自动被这条策略覆盖。这正是“动作映射到业务领域”带来的可维护性。

## 放开某一维

把某一维写成裸关键字，表示该维不加约束。下面的策略允许任何主体查看 `alice_vacation` 相册：

```Cedar
permit(
  principal,
  action == Action::"view", 
  resource in Album::"alice_vacation"
);
```

裸写 `principal` 并不意味着“任何未认证用户”——Cedar 只做授权，请求中的主体已经过应用认证。若三项全裸写，就得到一条允许一切的策略，实践中几乎总是配合条件使用。

## 基于属性的访问控制

ABAC 把判断建立在主体、资源或上下文的属性上。下面的策略要求主体属于 `HardwareEngineering` 部门且职级不低于 5：

```Cedar
permit(
  principal,
  action in [Action::"listPhotos", Action::"view"],
  resource in Album::"device_prototypes"
)
when {
  principal.department == "HardwareEngineering" &&
  principal.jobLevel >= 5
};
```

属性也可以用来表达归属关系：

```Cedar
permit(
  principal,
  action,
  resource
)
when {
  principal == resource.owner
};
```

这条策略允许所有主体对自己拥有的资源执行任意动作，是“每个资源都有 owner”这一建模习惯的直接回报。同理，`principal.department == resource.owner.department` 可以把可见性扩展到同部门。

需要注意原文的提醒：**若实体缺少条件中引用的属性，该策略在此次决策中被忽略**，因为求值失败。例如没有 `department` 属性的主体，永远无法通过上面那条同部门策略获得访问权。这不是报错中断，而是静默跳过，设计 schema 时要把属性设为必填或先用 `has` 检查。

## 使用 context

Context 承载随请求变化的信息，其可用字段由动作的 `appliesTo` 定义：

```Cedar
permit(
  principal == User::"alice",
  action in Action::"delete",
  resource
) when { 
    context has authentication.usedMFA &&
    context.authentication.usedMFA
};
```

这里先用 `has` 检查嵌套路径是否存在，再取值，避免上下文缺字段导致策略被跳过。若某类信息在所有请求中都一致，例如“只读动作”，更好的做法是建动作组，而不是塞进 context。

## 用 forbid 收紧权限

`forbid` 不授予权限，只约束权限；`permit` 与 `forbid` 同时命中时 `forbid` 优先。下面的策略拒绝访问所有带 `private` 属性的资源，除非主体就是资源所有者：

```Cedar
forbid (
  principal,
  action,
  resource
)
when {
  resource.private
}
unless {
  principal == resource.owner
};
```

原文还给出一个反例，说明 `forbid` 的强度：把“允许 alice 使用只读动作组”改写为“除非动作属于只读组，否则拒绝 alice”，语义并不等价——由于 `forbid` 覆盖 `permit`，alice 将永远无法执行其他任何动作。这类改写必须非常小心，判断顺序见[授权如何工作](./authorization.md)。