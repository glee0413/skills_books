---
id: gstack/ios-clean
title: ios-clean
description: 从 iOS 应用里移除 DebugBridge 这个 SPM 包以及所有 #if DEBUG 接线，逐项确认、可回退，并在 Release 构建上验证干净。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: ios-clean/SKILL.md
snapshotPath: source-snapshots/gstack/ios-clean/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 从 iOS 应用里剥离 DebugBridge

本技能是一条**便利流程**，不是安全机制。防止 DebugBridge 混进 Release 的结构性防线在 `Package.swift.template` 里（`.when(configuration: .debug)`），再加上那条 CI 不变量测试 —— 它会跑 `swift build -c release` 并断言 DebugBridge 符号不存在。两者都随 `/ios-qa` 的模板安装一起交付。

本技能面向这几类开发者：

- 手动拷贝过 DebugBridge 文件（没用 `/ios-qa` 的 SPM 安装）的人。
- 想在安全审计前走一遍有引导、可回退的移除流程的人。
- 正在迁离 gstack、想要一个干净退出的人。

## 它移除什么

每一项都只在 AskUserQuestion 确认之后才回退：

1. `Package.swift` 里 `DebugBridge` 这个 SPM target。
2. 应用 `@main` 入口里调用 `DebugBridgeManager.shared.start()` 的那段 `#if DEBUG` 代码块。
3. 规范应用状态类上任何独立的 `// @Snapshotable` 生成器标记注释。
4. `gstack-ios-qa-regen` 写在应用源码目录下的生成包目录 `DebugBridge/` 和 `DebugBridgeGenerated/`（访问器与 `.gstack-version`），以及其他任何生成的 `StateAccessor.swift` 文件。
5. 设备上 `NSTemporaryDirectory()` 下的 `gstack-ios-qa.token` 文件（尽力而为 —— 只有 /ios-clean 运行时设备连着才有效）。

## 它不碰什么

- 应用的业务逻辑、视图模型、视图代码。
- `#if DEBUG` 代码块之外的任何东西。
- 其他测试或 QA 基础设施。

## 第 1 阶段：清点

1. 在应用源码里 Glob 找 `import DebugBridge`。
2. Glob 找 `#if DEBUG ... DebugBridgeManager` 代码块。
3. 在 `StateAccessor.swift` 文件里 Grep 生成器头部
   `// AUTO-GENERATED — DO NOT EDIT. Regenerate with /ios-sync.`
4. 解析 `Package.swift`，找 DebugBridge 依赖条目。
5. 把即将被移除的东西展示给用户（文件列表 + 行数）。
   AskUserQuestion：继续、试运行，还是中止。

## 第 2 阶段：移除

对用户批准的每一项：

1. 用 Edit 工具剥掉 import 和 `#if DEBUG` 代码块（保持周围代码完整）。
2. 用 Edit 工具从 `Package.swift` 移除本地的 `.package(path: ...DebugBridge...)` 条目，以及所有对 `DebugBridge*` 产品（`DebugBridgeUI`、`DebugBridgeCore`、`DebugBridgeTouch`）的 target 依赖。
3. 删除生成的 `DebugBridge/` 和 `DebugBridgeGenerated/` 目录，以及其他任何生成的 `StateAccessor.swift` 文件。
4. 运行 `xcodebuild -scheme <SchemeName> -destination 'platform=iOS,id=<UDID>'
   build install -configuration Release`，验证在没有 bridge 的情况下 Release 能构建。如果它因为缺少 DebugBridge 符号而失败，说明移除不完整 —— 停下并报告。

## 第 3 阶段：验证

1. `! grep -r "DebugBridge" <app-source-dir>`（无匹配）。
2. `! grep -r "@Snapshotable" <app-source-dir>`（无匹配）。
3. `swift build -c release` 成功。
4. 对构建出的二进制执行 `nm -j`，不出现 DebugBridge 符号。

报告清理结果，并用一行说明移除了什么。

## 可回退性

每一次 Edit 和删除都是 git 操作；用户可以用 `git restore` 撤销。
本技能绝不 force-push、绝不 amend、绝不删除 SPM 缓存 ——
那些由用户自己决定。