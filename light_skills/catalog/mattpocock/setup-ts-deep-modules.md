---
id: mattpocock/setup-ts-deep-modules
title: setup-ts-deep-modules
description: 把 dependency-cruiser 接进 TypeScript 仓库，让每个包都成为只在入口文件暴露接口的深模块。
invocation: user
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/in-progress/setup-ts-deep-modules/SKILL.md
snapshotPath: source-snapshots/mattpocock/setup-ts-deep-modules/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 配置 TS 深模块

把这个仓库里的每个包都做成**深模块**：小接口背后藏着大量行为。一个包的公开面就是它的**入口文件**（包根目录下的那些文件），子文件夹里的一切都是隐藏的。这个技能会安装 [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) 以及那套“只能从入口文件进入”的规则，然后证明这些规则真的会咬人。

需要相关词汇（深模块、接口、接缝、深度）时，用 Skill 工具调用 "codebase-design"，并全程使用它的说法。

## 这套规则强制的形状

```
src/packages/
  <name>/
    index.ts        ← 一个入口文件（公开）。外部从这里导入。
    client.ts       ← 另一个入口文件。一个包可以暴露多个入口。
    lib/            ← 实现：对外隐藏，内部可以互相导入。
    tests/          ← 就近放置的测试 + 夹具（属于子文件夹，所以是私有的）。
```

公开面是包的**根文件**，而不是某个指定的 `index.ts`。按惯例，实现放在 `lib/`，测试放在 `tests/`，于是每个包都是同样的两个文件夹形状。但规则本身是通用的：*任何*子文件夹里的*任何东西*都是私有的，所以你永远不需要为了新增一个文件夹去改配置。

四条规则，全都设为 `error`：

1. **入口边界**：包外的代码（应用代码或其他包）只能导入该包的入口文件（它的根文件），绝不能碰它子文件夹里的任何东西。
2. **包内自由**：一个包自己的文件之间可以随意互相导入。
3. **测试走入口**：`<pkg>/tests/` 下的文件可以导入任何包的入口文件，以及本包 `tests/` 里的夹具，但绝不能导入任何包的子文件夹内部（连自己的也不行）。跨包的集成测试没问题；深层导入不行。
4. **无环**：不允许出现依赖环。

**用入口文件，不用 barrel。** 因为公开面是*每一个*根文件，一个包可以暴露多个小入口（`index.ts`、`client.ts`、`server.ts`），而不是把所有东西都塞进一个巨大的 `index.ts`。不鼓励把整棵子树重新导出的 barrel 文件；让入口保持小，把实现藏在子文件夹里。

分层（哪些包可以依赖哪些包）是**另一件**不同的事，在本仓库的配置里只留了一个注释掉的桩，等仓库自己填。

## 步骤

### 1. 探测环境

- **包管理器**：`pnpm-lock.yaml` → pnpm，`yarn.lock` → yarn，`bun.lockb` → bun，否则 npm。下面所有命令都用它（`pnpm`/`yarn`/`npm run`/`bunx`）。
- **包根目录**：如果存在 `src/`，用 `src/packages`，否则用 `packages`。如果仓库已经有另一种明显的既有约定，先和用户确认选择。
- **现有配置**：检查是否存在 `.dependency-cruiser.*` 文件。如果存在，**不要**覆盖它：把四条规则和选项合并进去，并告诉用户你加了什么。

**完成条件：** 包管理器、包根目录、现有配置的状态都已确认。

### 2. 安装 dependency-cruiser

用探测到的包管理器把 `dependency-cruiser` 装成 devDependency。

**完成条件：** `dependency-cruiser` 出现在 `devDependencies` 里。

### 3. 写配置

把 `dependency-cruiser.config.cjs` 复制到仓库根目录，命名为 `.dependency-cruiser.cjs`。把 `PACKAGES_ROOT` 设为第 1 步探测到的根目录。规则基于路径深度，且与扩展名无关，所以其他什么都不用改。

> 译者注：原文这里链接到技能目录内的 `dependency-cruiser.config.cjs`。本书不收录该配置文件，需要时请到上游仓库的 `skills/in-progress/setup-ts-deep-modules/` 目录取用。

**完成条件：** `.dependency-cruiser.cjs` 存在，`PACKAGES_ROOT` 正确，四条禁止规则都在。

### 4. 接进检查流程

- 加一个 `lint:boundaries` 脚本：`depcruise <packages-root>`（或 `depcruise src`）。
- 把它折进仓库的总检查命令，也就是那个已经在跑类型检查的命令（例如 `check` / `ci` / `validate` 脚本）。**不要**动 `tsconfig`，也不要加路径别名。
- 如果没有总检查脚本，就加上 `lint:boundaries`，并告诉用户要把它放进 CI。

**完成条件：** `lint:boundaries` 存在，并且和类型检查在同一条命令里运行。

### 5. 搭出示例包

创建一个提交进仓库的 `<packages-root>/example/`，作为可复制的模板：

- `index.ts` 是入口文件。导出一个函数，由它委托给内部文件（这样包是可见地*深*，而不是一层直通）。
- `lib/impl.ts`：**子文件夹**里的内部文件，由 `index.ts` 导入，从外部不可达。
- `tests/example.test.ts` **只**导入 `../index`（一个入口文件），并对公开函数做断言。

告诉用户这是一份起步模板，可以复制也可以删除。

**完成条件：** 示例包存在，通过根入口文件暴露行为，并把 `impl` 藏在子文件夹里。

### 6. 证明规则真的会咬人

这是整个技能的完成标准：一份不会在违规时失败的配置毫无价值。

1. 运行 `lint:boundaries`。在干净的示例上它必须**通过**。
2. 临时在 `tests/example.test.ts` 里加一个深层导入（例如 `import { thing } from "../lib/impl"`）。再跑一次 `lint:boundaries`；它必须**失败**，报出 `tests-through-entrypoints`。
3. 撤回那个深层导入。再跑一次，必须**通过**。

**完成条件：** 你观察到一次通过，然后深层导入导致一次失败，然后再次通过。如果第 2 步没有失败，说明规则没接对，收工前先修好。

### 7. 记录这套约定

**在包文件夹里**写一个 `README.md`（`<packages-root>/README.md`，和它管理的那些包放在一起），覆盖这些内容：`src/packages/<name>/` 布局（入口文件在根上，`lib/` 放实现，`tests/` 放测试）、“只通过包的入口文件（它的根文件）导入”、以及如何运行 `lint:boundaries`。明确**不鼓励 barrel 文件**：暴露多个小入口，而不是通过一个 index 把整棵子树重新导出。篇幅控制在复制模板加四条规则、每条一段。

然后从仓库的 agent 指令文件里给它加一个**上下文指针**（有 `CLAUDE.md` 就用它，否则用 `AGENTS.md`，两者都没有就创建 `AGENTS.md`）。一行就够，例如 `Packages are deep modules: see [src/packages/README.md](./src/packages/README.md) before adding or importing one.`。正是这一行让 agent 能发现边界规则，而不是一头撞上去。

**完成条件：** `<packages-root>/README.md` 存在且不鼓励 barrel，仓库的 `CLAUDE.md`/`AGENTS.md` 链到它。

## 说明

- 配置里的 `$1` 反向引用（dependency-cruiser 的分组匹配）正是让一个包能访问自己内部、而外人不能的原因。别把它们拆成每个包一条的独立规则。
- 公开还是私有由**深度**决定：包的根文件是入口文件；子文件夹里的任何东西都是私有的。惯用子文件夹是 `lib/`（实现）和 `tests/`，但规则并没有把这两个名字写死：任何子文件夹都是私有的，所以新增文件夹永远不需要改配置。新增一个入口就是新增一个根文件（不用 barrel）。
- 包是**平铺**的：根目录下只有一层直接子项。包的内部可以嵌套任意深；但一个包不能包含另一个包。
- 用 `.cjs`（而不是 `.js`），这样即使在 `"type": "module"` 的仓库里，配置里的 `module.exports` 也能工作。