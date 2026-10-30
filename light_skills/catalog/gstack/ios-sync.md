---
id: gstack/ios-sync
title: ios-sync
description: 在应用改动或 gstack 升级后原地重新生成 iOS 调试桥的代码与访问器，并校验结果。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: ios-sync/SKILL.md
snapshotPath: source-snapshots/gstack/ios-sync/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 重新同步 iOS 调试桥

在应用里装好 `/ios-qa` 之后，用户可能会：

1. 新增需要访问器覆盖的 `@Observable` 类或属性。
2. 把 gstack 升级到带加固修复的新版本。
3. 把 `// @Snapshotable` 生成器标记注释挪到另一个字段上。

这个技能原地重新生成相关产物。

**模板在上游 gstack 里。** 安装好的 `gstack-ios-qa-regen` 启动器会自行解析 gstack 根目录，只从 `ios-qa/templates/` 复制受支持的桥文件。

## Phase 1：检测已安装版本

1. 读取 `<app>/DebugBridgeGenerated/.gstack-version`（由 /ios-qa 在安装时写入）。如果不存在，把这次安装视为"未知的旧版本"。
2. 从 `$GSTACK_ROOT/VERSION` 读取上游版本。
3. 如果版本一致且没有新增 `@Observable` 类，直接以"已是最新"提前退出。

## Phase 2：重新生成代码

运行一次确定性生成器。`--app-source` 是访问器扫描器要检查的目录；`--bridge-dir` 是应用在 Debug 构建中链接的本地 Swift package：

```bash
~/.claude/skills/gstack/bin/gstack-ios-qa-regen \
  --app-source "$APP_SOURCE_DIR" \
  --bridge-dir "$APP_SOURCE_DIR/DebugBridge"
```

该命令在输出当前访问器之前，只会删除旧版平铺 `DebugBridgeGenerated/` 布局中已知的过时生成文件。代码生成接受文件作用域的可观察类，以及 JSON 原生标量、数组、String 键字典和 Optional 字段类型。它会在写入完成标记之前拒绝自定义类型、隐式解包 Optional、嵌套的可观察类和重复的快照键。

组合哈希缓存键决定是否真的需要重新生成；如果 Swift 版本、生成器 git rev、lockfile、源码内容和平台三元组都与缓存匹配，这就是约 50ms 的空操作。

## Phase 3：审查生成的 diff

1. 审查 `<app>/DebugBridge/` 和
   `<app>/DebugBridgeGenerated/StateAccessor.swift` 下的改动。
2. 确认命令没有改动应用手写的 Swift 文件。
3. 应用专属的接线留在应用 target 里；规范的桥 package 文件由上游重新生成，不应手工编辑。

## Phase 4：验证

1. 针对应用的 package，`swift build` 成功。
2. `xcodebuild -scheme <SchemeName>` 成功。
3. 在设备上重新启动应用；守护进程连接并轮换令牌。
4. `GET /state/snapshot` 返回新的访问器 schema 哈希。

## 失败模式

| 现象 | 处理 |
|---|---|
| 重新生成后 Swift 编译失败 | 用 `git restore` 回滚，并用 AskUserQuestion 把编译错误呈现出来 |
| 代码生成报告某个标记声明无效 | 使用文件作用域的可观察类，以及带显式 JSON 原生类型、internal/public setter、键名在各模型间唯一的可写实例 `var`；否则移除 `// @Snapshotable` 标记。 |
| 新增 @Observable 后 schema 哈希没变 | 没有任何字段带独立的 `// @Snapshotable` 标记注释——代码生成正确地排除了未标记的状态。在每个应当纳入快照的字段正上方加上该注释。 |
| 扫描器看到了生成的桥源码 | 传入范围更窄的应用源码目录；重新生成器会自动排除 `DebugBridgeGenerated` 和 `StateAccessor.swift`。 |