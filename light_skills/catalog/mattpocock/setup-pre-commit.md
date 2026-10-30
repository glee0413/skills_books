---
id: mattpocock/setup-pre-commit
title: setup-pre-commit
description: 在当前仓库里配好 Husky pre-commit 钩子，串起 lint-staged（Prettier）、类型检查和测试。
invocation: model
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/misc/setup-pre-commit/SKILL.md
snapshotPath: source-snapshots/mattpocock/setup-pre-commit/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 配置 Pre-Commit 钩子

## 这套配置会装上什么

- **Husky** pre-commit 钩子
- **lint-staged**，对所有已暂存文件跑 Prettier
- **Prettier** 配置（如果还没有）
- pre-commit 钩子里的 **typecheck** 和 **test** 脚本

## 步骤

### 1. 识别包管理器

检查 `package-lock.json`（npm）、`pnpm-lock.yaml`（pnpm）、`yarn.lock`（yarn）、`bun.lockb`（bun）。哪个存在就用哪个。判断不出来时默认用 npm。

### 2. 安装依赖

作为 devDependencies 安装：

```
husky lint-staged prettier
```

### 3. 初始化 Husky

```bash
npx husky init
```

这会创建 `.husky/` 目录，并在 package.json 里加上 `prepare: "husky"`。

### 4. 创建 `.husky/pre-commit`

写入这个文件（Husky v9+ 不需要 shebang）：

```
npx lint-staged
npm run typecheck
npm run test
```

**按情况调整**：把 `npm` 换成识别出的包管理器。如果 package.json 里没有 `typecheck` 或 `test` 脚本，就删掉对应行，并告诉用户。

### 5. 创建 `.lintstagedrc`

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

### 6. 创建 `.prettierrc`（如果还没有）

只有在不存在任何 Prettier 配置时才创建。使用下面这组默认值：

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

### 7. 验证

- [ ] `.husky/pre-commit` 存在且可执行
- [ ] `.lintstagedrc` 存在
- [ ] package.json 里的 `prepare` 脚本是 `"husky"`
- [ ] `prettier` 配置存在
- [ ] 运行 `npx lint-staged` 验证它能工作

### 8. 提交

暂存所有改动和新建的文件，用这条说明提交：`Add pre-commit hooks (husky + lint-staged + prettier)`

这次提交会走一遍新的 pre-commit 钩子：这是一次不错的冒烟测试，能确认一切正常。

## 说明

- Husky v9+ 的钩子文件不需要 shebang
- `prettier --ignore-unknown` 会跳过 Prettier 解析不了的文件（图片等）
- pre-commit 先跑 lint-staged（快，只处理已暂存文件），再跑完整的类型检查和测试