---
id: gstack/ios-fix
title: ios-fix
description: 从可复现快照出发，自动定位并修复真实 iOS 设备上的缺陷，再补上回归测试。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: ios-fix/SKILL.md
snapshotPath: source-snapshots/gstack/ios-fix/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 自动修复 iOS 缺陷

## 铁律

**没有可复现的快照，就不许改代码。** 在编辑任何 Swift 源码之前，agent 必须捕获一个能复现该缺陷的 `GET /state/snapshot`。这个快照会成为回归测试的固定数据（fixture），放在 `test/fixtures/ios-fix/`。没有可复现快照就落地的修复，三个月后你还要再修一遍。

## Phase 1：复现缺陷

1. 阅读 `/ios-qa` 的发现（缺陷描述、截图、可疑的无障碍树节点）。
2. 通过 `POST /tap`、`/swipe`、`/type` 或 `POST /state/<key>`（仅限可快照字段）把设备带入缺陷状态。
3. 捕获 `GET /state/snapshot` → 写入
   `test/fixtures/ios-fix/<bug-slug>-pre.json`。
4. 捕获 `GET /screenshot` → 写入
   `test/fixtures/ios-fix/<bug-slug>-pre.png`。
5. 留下对"哪里不对 + 预期行为"的一行描述。

## Phase 2：定位根因

遵循 `/investigate` 的铁律：没有根因就不修。agent 阅读 Swift 源码，从出问题的屏幕回溯到 view model、数据流和状态变更。找出能修好该行为的最小改动。

如果存在多个可能的根因，用 AskUserQuestion 让用户选定要修哪一个。

## Phase 3：实施修复

1. 编辑 Swift 源码。保持 diff 最小。
2. 重新构建：`xcodebuild -scheme <SchemeName>
   -destination 'platform=iOS,id=<UDID>' build install`。
3. 守护进程会检测到重建，并重新连接 StateServer 隧道。
4. 重新部署。同样会走一遍 boot token 轮换流程。

## Phase 4：验证

1. 用缺陷前的快照调用 `POST /state/restore` → 复现该状态。
2. 重新截图。与
   `test/fixtures/ios-fix/<bug-slug>-pre.png` 对比。
3. 如果缺陷肉眼可见地还在，说明修复无效——回滚重来（最多 3 轮，之后升级给用户）。
4. 如果缺陷消失，捕获 `<bug-slug>-post.png` 供回归测试使用。

## Phase 5：添加回归测试

用项目自己的测试运行器和惯例写回归测试（测试命令写在 CLAUDE.md 里；如果那里没有，问用户并把答案记进去）。这个测试要：

1. 加载缺陷前的快照。
2. 通过 `POST /state/restore` 恢复它。
3. 在真实设备上断言修复后的行为，没有连接设备时跳过。

把快照固定数据和测试文件同修复一起提交。

## 失败模式

| 现象 | 处理 |
|---|---|
| 3 轮之后缺陷仍在 | 停下，把当前最可能的假设报告给用户 |
| 重建后 /state/restore 返回 `409 schema_mismatch` | 用 `/ios-sync`（`gstack-ios-qa-regen`）重新生成访问器，重新抓快照 |
| 修复过程中设备断开 | 守护进程会自动重连；从 Phase 4 继续 |
| 构建失败 | 回滚 Swift 改动；先查编译错误，再重新应用修复 |