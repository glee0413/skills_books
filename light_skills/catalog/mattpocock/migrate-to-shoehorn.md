---
id: mattpocock/migrate-to-shoehorn
title: migrate-to-shoehorn
description: 把测试文件里的 `as` 类型断言迁移到 @total-typescript/shoehorn，用类型安全的替代方案传入部分测试数据。
invocation: model
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/misc/migrate-to-shoehorn/SKILL.md
snapshotPath: source-snapshots/mattpocock/migrate-to-shoehorn/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 迁移到 Shoehorn

## 为什么用 shoehorn？

`shoehorn` 让你在测试中传入部分数据，同时让 TypeScript 保持满意。它用类型安全的替代方案取代 `as` 断言。

**只用于测试代码。** 绝不要在生产代码里使用 shoehorn。

测试中 `as` 的问题：

- 训练里就不该用它
- 必须手动指定目标类型
- 为了故意写错的数据，得双重断言（`as unknown as Type`）

## 安装

```bash
npm i @total-typescript/shoehorn
```

## 迁移模式

### 只需要少量属性的大对象

迁移前：

```ts
type Request = {
  body: { id: string };
  headers: Record<string, string>;
  cookies: Record<string, string>;
  // ...20 more properties
};

it("gets user by id", () => {
  // Only care about body.id but must fake entire Request
  getUser({
    body: { id: "123" },
    headers: {},
    cookies: {},
    // ...fake all 20 properties
  });
});
```

迁移后：

```ts
import { fromPartial } from "@total-typescript/shoehorn";

it("gets user by id", () => {
  getUser(
    fromPartial({
      body: { id: "123" },
    }),
  );
});
```

### `as Type` → `fromPartial()`

迁移前：

```ts
getUser({ body: { id: "123" } } as Request);
```

迁移后：

```ts
import { fromPartial } from "@total-typescript/shoehorn";

getUser(fromPartial({ body: { id: "123" } }));
```

### `as unknown as Type` → `fromAny()`

迁移前：

```ts
getUser({ body: { id: 123 } } as unknown as Request); // 故意写错类型
```

迁移后：

```ts
import { fromAny } from "@total-typescript/shoehorn";

getUser(fromAny({ body: { id: 123 } }));
```

## 何时用哪一个

| 函数 | 使用场景 |
| --------------- | -------------------------------------------------- |
| `fromPartial()` | 传入仍能通过类型检查的部分数据 |
| `fromAny()`     | 传入故意写错的数据（保留自动补全） |
| `fromExact()`   | 强制完整对象（之后可与 fromPartial 互换） |

## 工作流

1. **收集需求** - 问用户：
   - 哪些测试文件里的 `as` 断言正在造成问题？
   - 他们是否在处理只有部分属性重要的大对象？
   - 他们是否需要为错误测试传入故意写错的数据？

2. **安装并迁移**：
   - [ ] 安装：`npm i @total-typescript/shoehorn`
   - [ ] 找到带 `as` 断言的测试文件：`grep -r " as [A-Z]" --include="*.test.ts" --include="*.spec.ts"`
   - [ ] 用 `fromPartial()` 替换 `as Type`
   - [ ] 用 `fromAny()` 替换 `as unknown as Type`
   - [ ] 添加来自 `@total-typescript/shoehorn` 的导入
   - [ ] 运行类型检查来验证