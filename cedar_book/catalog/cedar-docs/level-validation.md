---
id: cedar-docs/level-validation
title: 分级验证
description: 说明如何用 level validation 限制策略的实体解引用深度，并用按层切片只取请求真正需要的实体数据。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_policies/level-validation.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_policies/level-validation.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_policies/level-validation.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 分级验证

一次授权请求要评估策略，需要 `principal`、`action`、`resource`、`context`，以及所有可能相关的实体数据。听起来直白，但“哪些实体数据算相关”并不总是显然。最省事的做法是把全部实体数据都塞进每个请求：这永远安全，可对数据量大的应用来说，成本常常无法接受。

**分级验证（level validation）**就是为此设计的：它让应用能限制一次请求所需的实体数据量。它是标准[策略验证](./validation.md)之后的**额外**阶段——普通验证尽量不限制你能写什么策略，分级验证则额外加约束，使“这条策略可能访问哪些实体数据”更容易界定。在 level `n` 上验证时，它保证策略中不存在长度超过 `n` 的实体解引用链，也就是：实体只有在距离根实体少于 `n` 步可达时才会被访问。

## 被限制的操作

分级验证只约束**实体解引用**表达式——那些读取实体数据的操作。因为这类操作一旦访问到请求未包含的实体就可能失败或给出意外结果，必须限制，才能保证策略不依赖切片不会收集的数据。

- **实体属性**：`.` 访问与 `has` 存在性判断需要实体数据。注意它们作用在 record 上时不受限。
- **标签**：`getTag` 与 `hasTag` 需要实体数据；它们是二元操作，但分级验证只约束第一个操作数。
- **层级成员**：二元 `in` 需要第一个操作数的祖先实体列表；第二个操作数不必知道祖先，因此不受限。

其他操作都不受分级验证约束，只受普通策略验证的规则约束。

## Level 0

Level 0 的策略不能使用任何实体解引用操作，因此完全不访问实体数据。你可以比较实体是否相等、检查实体类型，但不能读属性和标签，也不能用 `in` 查询层级。`context` 是 record 而不是实体，所以读取上下文属性是允许的。

```cedar
principal is User
action == Action::"view"
context.is_authenticated
```

这些操作虽然用到请求变量，却不需要实体数据，因此在任何层级都合法。如果所有策略都通过 level 0 验证，选取相关数据就变得极其简单——一条都不用取。代价是限制很重：连 `principal in Group::"admins"` 都会报错，因为 `in` 需要 `principal` 的实体数据。

## Level 1

Level 1 允许直接访问根实体的数据，但不能顺着根实体的属性再访问更深一层。也就是说，一次属性访问或一次 `in` 层级查询可以，连续串联多个属性或标签访问不行。

```cedar
principal.is_admin
action in Action::"read_only"
principal has manager && principal.manager == User::"Ethel"
resource.hasTag("level") && resource.getTag("level") > 4
```

如果全部策略都在 level 1 通过验证，就只需收集请求中直接出现的实体数据，不必为“再跳一次属性才能到达”的实体取数。

## 更高层级与实体字面量

更高层级向下兼容，并允许组合解引用：level 1 只能写 `resource.owner`，level 2 可以写 `resource.owner.is_admin` 或 `resource.owner in Group::"admins"`；level 3 以上继续支持更复杂的组合，如 `principal.getTag("file0.txt").` 再接后续访问。

有一条例外：**实体字面量**上的解引用在任何层级都被禁止。字面量不在请求的 principal/action/resource/context 里，切片过程根本收不到它；若允许访问其属性，就无法保证该实体的数据被选中，决策可能改变。因此下面这些在任何层级都不合法：

```cedar
User::"alice".is_admin
User::"alice" has manager
Doc::"my_doc" in principal.folder
```

## 按层切片

有了层级上限，就可以**按层切片（level-based entity slicing）**：从一个授权请求出发，选出一定包含全部相关数据的实体子集。Cedar 库不提供实现，因为具体做法取决于实体如何存储；如果实体在数据库里，应当用查询逐层取出，而不是把整库载入内存。

通用算法是一个迭代过程：

1. **根实体**：工作集初始化为请求中直接引用的实体——`principal`、`action`、`resource`，以及 `context` 里引用的实体。
2. **初始化切片**：结果集（slice）初始为空。
3. **迭代 n 次**：每轮新建“下一工作集”；对工作集中每个实体标识查出实体数据，放入 slice；把它属性或标签中引用的实体标识放入下一工作集；最后用下一工作集替换工作集。

结束时 slice 就是最终数据，包含所有通过 level `n` 验证的策略可能访问的实体。用这份切片做请求，决策与用全量数据完全一致。

固定层级时不必实现通用版本：全部策略通过 level 0，就可以直接展开成“永远取空集”；通过 level 1，则只需一轮——按请求里的 UID 取一次实体数据。这也是分级验证最实际的价值：把“该给 Cedar 多少数据”从猜测变成可计算的结论。