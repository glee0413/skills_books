---
id: cedar/wasm
title: Cedar WASM
description: cedar-wasm 的三个子包、在 Node、webpack 与 Vite 中的加载方式，以及自定义 wasm 加载策略。
project: cedar
sourceCommit: d5fb0422e6edb8617b595428530224663e122668
sourceRef: v4.3.0-782-gd5fb0422
sourcePath: cedar-wasm/README.md
snapshotPath: source-snapshots/cedar/cedar-wasm/README.md
sourceUrl: https://github.com/cedar-policy/cedar/blob/d5fb0422e6edb8617b595428530224663e122668/cedar-wasm/README.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# Cedar WASM

`cedar-wasm` 把 Cedar 的能力编译成 WebAssembly，让 TypeScript/JavaScript 应用也能在本地完成策略解析、验证和授权判定。README 的核心判断是：**安装很简单，加载很难**——难在 wasm 文件如何进入运行时，而这取决于打包器和部署环境。

## 安装与三个子包

```sh
npm i @cedar-policy/cedar-wasm --save
```

包名相同，但通过 `exports` 暴露三种加载策略：

- **es modules（默认）**，即 `@cedar-policy/cedar-wasm`。用动态导入时 wasm 会被打进单独文件，用静态导入时则嵌入主 bundle。
- **commonjs（Node）**，即 `@cedar-policy/cedar-wasm/nodejs`。通过 Node 的 `fs` 同步读取 wasm，不面向打包或浏览器分发。
- **web**，即 `@cedar-policy/cedar-wasm/web`。暴露 `initSync`，适合完全自定义加载流程的场景。

选错子包的典型症状是：在浏览器里报 `fs` 找不到，或在 Node 里 wasm 初始化时机不对。先确认运行时，再选入口。

## 裸 Node：require 或动态 import

Node 默认走 CommonJS，所以要么 `require`，要么用动态 `import()`：

```
const cedar = require('@cedar-policy/cedar-wasm/nodejs');
console.log(cedar.getCedarVersion());
```

用 ESM 异步导入则写：

```
import('@cedar-policy/cedar-wasm/nodejs')
  .then(cedar => console.log(cedar.getCedarVersion()));
```

`getCedarVersion()` 是最小的连通性检查：能打印出版本号，说明 wasm 已正确实例化，可以继续调用解析与授权函数。

## webpack 5：打开 asyncWebAssembly

webpack 需要显式允许异步 wasm。README 给了一份最小 `package.json`，依赖 `@cedar-policy/cedar-wasm`，开发依赖包括 `ts-loader`、`typescript`、`webpack`、`webpack-cli`、`webpack-dev-server` 和 `html-webpack-plugin`。`tsconfig.json` 的关键项是 `"module": "es2020"`、`"moduleResolution": "node"` 和 `"allowJs": true`。

`webpack.config.js` 的要点只有一处：

```
  experiments: {
    asyncWebAssembly: true, // enables wasm support in webpack
  },
```

配合 `entry: './src/index.ts'`、`ts-loader` 规则和 `HtmlWebpackPlugin`，最后在入口文件里动态导入：

```
import('@cedar-policy/cedar-wasm').then(mod => {
  // cache it globally here or invoke functions like mod.getCedarVersion();
});
```

注释里的建议值得照做：把 `mod` 缓存到全局，避免每次判定都重新触发加载。Cedar 的授权调用本身很快，重复初始化 wasm 往往才是瓶颈。

## Vite 5：两个插件

从 Vite 的 TypeScript 模板起步，先装两个开发依赖：

```
npm i --save-dev vite-plugin-top-level-await vite-plugin-wasm
```

然后在 `vite.config.js` 里注册：

```
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait()
  ]
});
```

加载代码与 webpack 一致，仍是 `import('@cedar-policy/cedar-wasm').then(...)`。两个插件分别解决 wasm 模块解析和顶层 await 的兼容问题，缺一个就可能在构建期或运行期报错。

## 备用加载策略与 initSync

如果不能用 ES modules，就走 `web` 或 `nodejs` 子包。`nodejs` 已在上文出现；`web` 适合需要自己掌控 wasm 二进制获取时机的场景，例如测试环境：

```
const wasmBuffer = ... // `fetch` it or use `fs` to read it from `node_modules` in jest setupTests
import * as cedarJsBindings from '@cedar-policy/cedar-wasm/web';
cedarJsBindings.initSync(wasmBuffer);
```

注释点明了两个常见来源：浏览器里用 `fetch` 拿二进制，Jest 的 `setupTests` 里用 `fs` 从 `node_modules` 读。某些 Jest 配置也必须用这种方式，因为默认子包依赖的动态导入在测试环境中不一定可用。

## 选型小结

浏览器应用优先默认子包加动态导入；Node 服务端脚本用 `nodejs` 子包；打包器不兼容或测试环境受限时用 `web` 加 `initSync`。三条路径导出的是同一组 Cedar 能力：版本查询、策略解析与验证、实体构造、授权判定。差别只在 wasm 二进制如何被找到和实例化，因此业务代码可以先按默认子包写，等到部署环境暴露问题再替换入口。

无论哪条路径，都建议在启动时做一次版本检查并缓存模块实例，把加载失败与授权拒绝区分开——前者是部署问题，后者才是策略问题。另一个容易忽略的点是构建产物：wasm 文件必须随前端资源一起发布，若服务器只托管 JS 而漏掉 `.wasm`，本地开发正常、线上却初始化失败。上线前用生产构建跑一次最小判定，比在开发服务器上反复刷新更可靠。