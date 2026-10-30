---
id: mattpocock/codebase-design
title: codebase-design
description: 设计深模块时共用的词汇表，涵盖模块、接口、深度、接缝、适配器、杠杆和局部性。
invocation: model
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/codebase-design/SKILL.md
snapshotPath: source-snapshots/mattpocock/codebase-design/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 代码库设计

设计**深模块**：在干净的接缝上，用小接口托住大量行为，并且能透过这个接口测试。凡是在设计或重构代码的地方，都使用这套语言和这些原则。目标是给调用方杠杆、给维护者局部性、给所有人可测试性。

## 术语

严格使用这些术语：不要换成“组件”“服务”“API”或“边界”。统一语言就是全部的意义所在。

**Module（模块）**：任何有接口和实现的东西。刻意与规模无关：一个函数、类、包，或一个横跨多层的切片。_避免_：unit、component、service。

**Interface（接口）**：调用方要正确使用这个模块所需要知道的一切：类型签名，但也包括不变量、顺序约束、错误模式、必需的配置，以及性能特征。_避免_：API、signature（太窄，它们只指类型层面的表面）。

**Implementation（实现）**：模块内部的东西，它的代码体。与 **Adapter** 区分：一个东西可以是实现很大的小适配器（一个 Postgres 仓库），也可以是实现很小的大适配器（一个内存假件）。当话题是接缝时用“适配器”；其他情况用“实现”。

**Depth（深度）**：接口处的杠杆。调用方（或测试）每学习一单位接口，能撬动多少行为。当大量行为位于小接口之后时，模块是**深**的；当接口几乎和实现一样复杂时，是**浅**的。

**Seam（接缝）** _（Michael Feathers）_：一个你可以不修改该处就改变行为的地方；模块接口所在的*位置*。接缝放在哪里本身就是一项设计决策，与它背后放什么不同。_避免_：boundary（与 DDD 的限界上下文撞车）。

**Adapter（适配器）**：在接缝处满足某个接口的具体东西。描述的是*角色*（填哪个槽），而不是实质（里面是什么）。

**Leverage（杠杆）**：调用方从深度中得到的东西。每学习一单位接口，获得更多能力。一份实现，在 N 个调用点和 M 个测试上得到回报。

**Locality（局部性）**：维护者从深度中得到的东西。改动、bug、知识和验证集中在一个地方，而不是散布到各个调用方。修一次，处处已修。

## 深与浅

**深模块** = 小接口 + 大量实现：

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**浅模块** = 大接口 + 少量实现（要避免）：

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

设计接口时问：

- 我能减少方法的数量吗？
- 我能简化参数吗？
- 我能把更多复杂性藏到里面吗？

## 原则

- **深度是接口的属性，不是实现的属性。** 一个深模块内部可以由小的、可 mock 的、可替换的部件组成；它们只是不属于接口。一个模块可以有**内部接缝**（对其实现私有，供它自己的测试使用），也可以有位于其接口处的**外部接缝**。
- **删除测试。** 想象把这个模块删掉。如果复杂性消失了，它就是个直通件。如果复杂性在 N 个调用方那里重新出现，它就配得上自己的位置。
- **接口就是测试面。** 调用方和测试越过同一个接缝。如果你想测试到接口*之外*，那这个模块的形状大概是错的。
- **一个适配器意味着假想的接缝。两个适配器才意味着真实的接缝。** 除非确实有东西在接缝两侧变化，否则不要引入接缝。

## 为可测试性而设计

好的接口让测试变得自然：

1. **接受依赖，不要自己创建依赖。**

   ```typescript
   // 可测试
   function processOrder(order, paymentGateway) {}

   // 难以测试
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **返回结果，不要制造副作用。**

   ```typescript
   // 可测试
   function calculateDiscount(cart): Discount {}

   // 难以测试
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **表面积小。** 方法更少 = 需要的测试更少。参数更少 = 测试搭建更简单。

## 关系

- 一个 **Module** 恰好有一个 **Interface**（它向调用方和测试呈现的表面）。
- **Depth** 是 **Module** 的属性，对照它的 **Interface** 来衡量。
- **Seam** 是 **Module** 的 **Interface** 所在的地方。
- **Adapter** 坐在 **Seam** 上，满足 **Interface**。
- **Depth** 为调用方产出 **Leverage**，为维护者产出 **Locality**。

## 被弃用的说法

- **深度作为实现行数与接口行数的比值**（Ousterhout）：这奖励往实现里灌水。我们改用“深度即杠杆”。
- **“接口”指 TypeScript 的 `interface` 关键字或类的公开方法**：太窄了：这里的接口包括调用方必须知道的每一个事实。
- **“边界”（Boundary）**：与 DDD 的限界上下文撞车。说 **接缝** 或 **接口**。

## 深入

- **在给定依赖的情况下深化一个群集**，见 [DEEPENING.md](deepening.md)：依赖类别、接缝纪律，以及替换而非叠加的测试策略。
- **探索备选接口**，见 [DESIGN-IT-TWICE.md](design-it-twice.md)：启动并行的子代理，用几种截然不同的方式设计接口，再按深度、局部性和接缝位置做比较。