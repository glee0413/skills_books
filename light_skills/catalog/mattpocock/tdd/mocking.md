---
id: mattpocock/tdd/mocking
title: mocking
parentSkill: mattpocock/tdd
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/tdd/mocking.md
snapshotPath: source-snapshots/mattpocock/tdd/mocking.md
license: MIT
translatedAt: 2026-10-29
---

# 什么时候该 mock

只在**系统边界**上 mock：

- 外部 API（支付、邮件等）
- 数据库（有时，优先使用测试数据库）
- 时间/随机性
- 文件系统（有时）

不要 mock：

- 你自己的类/模块
- 内部协作者
- 任何你能控制的东西

## 为可 mock 而设计

在系统边界上，设计容易 mock 的接口：

**1. 使用依赖注入**

把外部依赖传进来，而不是在内部创建：

```typescript
// 容易 mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// 难以 mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 优先使用 SDK 风格接口，而不是通用 fetcher**

为每个外部操作创建具体函数，而不是用一个带条件逻辑的通用函数：

```typescript
// 好：每个函数都可以独立 mock
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// 坏：mock 需要在内部写条件逻辑
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 风格意味着：

- 每个 mock 返回一种具体形状
- 测试准备里没有条件逻辑
- 更容易看出一个测试覆盖了哪些端点
- 每个端点都有类型安全