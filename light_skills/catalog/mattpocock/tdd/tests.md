---
id: mattpocock/tdd/tests
title: tests
parentSkill: mattpocock/tdd
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/tdd/tests.md
snapshotPath: source-snapshots/mattpocock/tdd/tests.md
license: MIT
translatedAt: 2026-10-29
---

# 好测试与坏测试

## 好测试

**集成风格**：通过真实接口测试，而不是 mock 内部部件。

```typescript
// 好：测试可观察的行为
test("用户可以拿有效购物车结账", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

特征：

- 测试用户/调用方关心的行为
- 只使用公共 API
- 在内部重构后仍然成立
- 描述做什么，而不是怎么做
- 每个测试一个逻辑断言

## 坏测试

**实现细节测试**：耦合到内部结构。

```typescript
// 坏：测试实现细节
test("checkout 调用 paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

危险信号：

- mock 内部协作者
- 测试私有方法
- 断言调用次数/顺序
- 重构后测试坏了，但行为没变
- 测试名称描述怎么做，而不是做什么
- 通过外部手段验证，而不是通过接口

```typescript
// 坏：绕过接口去验证
test("createUser 保存到数据库", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// 好：通过接口验证
test("createUser 让用户可以被取回", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**同义反复的测试**：期望值复述实现，所以测试按构造通过。

```typescript
// 坏：期望值用代码同样的方式重新计算
test("calculateTotal 汇总行项目", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// 好：期望值是一个独立、已知的字面量
test("calculateTotal 汇总行项目", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```