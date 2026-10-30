---
id: gstack/ios-qa
title: ios-qa
description: 通过 USB 驱动真实 iPhone/iPad，生成类型化状态访问器、部署调试桥，并跑完整的发现—修复—验证闭环。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: ios-qa/SKILL.md
snapshotPath: source-snapshots/gstack/ios-qa/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 真机 iOS 质量检查

这个技能通过 USB 驱动真实的 iPhone 或 iPad。agent 阅读你的 Swift 源码、生成类型化的状态访问器、部署调试桥，然后跑一个闭合的"发现→修复→验证"循环。不用模拟器，不用 XCTest，不用 WebDriverAgent。

## 架构

```
       ┌──────────────────────┐   USB CoreDevice (IPv6)   ┌──────────────────┐
       │ gstack-ios-qa daemon │ ────────────────────────▶ │ iOS app          │
       │ (Mac, bun/TS)        │   bearer + X-Session-Id   │ StateServer      │
       │                      │                           │ (loopback only)  │
       │ - boot token rotate  │                           │ - /tap /swipe    │
       │ - session minting    │                           │ - /type /state   │
       │ - audit + redact     │                           │ - /snapshot      │
       └──────────────────────┘                           └──────────────────┘
                ▲
                │ Tailscale (optional, --tailnet)
                │
       ┌──────────────────────┐
       │ Remote agent         │
       │ (OpenClaw, etc.)     │
       └──────────────────────┘
```

> 译者注：这张框图保留原文，因为框内多为组件名和接口名。Mac 侧的 `gstack-ios-qa daemon` 通过 USB CoreDevice（IPv6）访问设备上的 `StateServer`，媒体类型为 bearer + `X-Session-Id`；`StateServer` 只绑定回环地址。可选开启 Tailscale（`--tailnet`）让远程 agent（如 OpenClaw）经守护进程接入。

iOS 应用里的 `StateServer` 只绑定回环地址（`::1` + `127.0.0.1`）。tailnet 入口完全由 Mac 上的守护进程负责。守护进程通过本地 `tailscaled` socket 校验 Tailscale 身份，并为远程 agent 签发短期会话令牌（默认 1h）。

## 前置条件

- macOS（守护进程使用 Xcode 自带 `devicectl`）。
- 通过 USB 连接、已配对并信任的 iPhone 或 iPad。连接了多台时，启动守护进程前先选定一台：
  `export GSTACK_IOS_TARGET_UDID=<udid>`（`xcrun devicectl list devices` 会列出 UDID）。否则守护进程拒绝猜测，会列出每台设备及其 UDID，并打印这行 export。
- 已安装 Xcode 与 Swift 工具链（`swift --version` 报告 >= 5.9）。
- 应用源码在磁盘上可访问，且至少包含一个 `@Observable` 类。
- 远程控制模式另需：已安装 Tailscale 且用户已登录。

## Phase 0：会话热启动（可选）

每次成功 bootstrap 后，守护进程会把轮换后的 StateServer bearer 写入 `$GSTACK_STATE_ROOT/ios-qa-session.json`（权限 0600），并绑定设备 UDID、bundle ID 和 StateServer 端口。重启的守护进程会在第一次设备请求时接着使用该 bearer，于是应用保留其 QA 状态，而不是被重新启动。以下情况则改为正常 bootstrap：应用被重启过（应用会拒绝该 bearer）、应答的是另一台设备或另一个应用、devicectl 报告绑定的 UDID 没有隧道地址，或其他用户可读该文件。

如果文件存在且守护进程有应答，说明桥已装好：跳过 Phase 1-2，直接进入 Phase 3。`--cold` 会删除该文件，使下次守护进程启动时走完整 bootstrap（应用会重启一次）；已经在运行的守护进程则保留其内存中的会话。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SESSION="$GSTACK_STATE_ROOT/ios-qa-session.json"
PORT="${GSTACK_IOS_DAEMON_PORT:-9099}"
if [ "$COLD" = "1" ]; then
  rm -f "$SESSION"
elif [ -f "$SESSION" ] && curl -sf "http://127.0.0.1:$PORT/healthz" > /dev/null; then
  echo "Warm start: daemon alive on port $PORT with a persisted device session"
fi
```

## Phase 1：阅读源码，规划代码生成

1. 在改动应用或替换已安装的构建之前，先确认桥与项目兼容：
   - 生成器目前只支持文件作用域的 `@Observable` 类；`ObservableObject`、`@StateObject` 等其他观察模型不会产生访问器。
   - 文档中的依赖接线假设应用清单是 SwiftPM 的。对于 `.xcodeproj` 或 `.xcworkspace`，不要凭空发明 package 或 target 接线。
   任一条不满足，就在不改动应用的前提下停止桥的 bootstrap。保留任何已安装的生产版或 TestFlight 构建。优先使用现成的真机 XCUITest 测试框架；确实需要单独的 QA 构建时，使用独立的 bundle identifier 和非生产环境的 entitlement，使其能与生产应用共存。报告时把固定数据驱动的状态、服务商 UI、以及真实外部服务商成功调用列为三个不同的证据等级。
2. 遍历应用源码（通过 `--source <dir>` 传入），找出所有 `@Observable` 类。注意那些紧跟在生成器标记注释 `// @Snapshotable` 之后的属性——它们是可快照字段。标记是注释，因此能与 `@Observable` 宏共存。每个被标记的字段必须属于文件作用域的可观察类，且是可写的实例 `var`，带显式类型和 internal 或 public 的 setter。快照类型限于 JSON 原生标量（`String`、`Bool`、各宽度整数、`Float`、`Double`、`CGFloat`）、数组、String 键字典，以及它们的 Optional 组合。键名必须在所有可观察类之间唯一。任一约束被违反时，代码生成会以源码诊断报错停止，而不是产出一个破损或有损的测试框架。
3. 把访问器清单展示给用户，并询问是否要把 DebugBridge 这个 SPM 依赖装进他们的 `Package.swift`（一次 AskUserQuestion）。

## Phase 2：启动设备桥

1. 用一条确定性命令生成规范的本地桥 package、类型化访问器和已安装版本标记：
   ```bash
   ~/.claude/skills/gstack/bin/gstack-ios-qa-regen \
     --app-source "<source-dir>" \
     --bridge-dir "<source-dir>/DebugBridge"
   ```
   重新生成器还会删除旧版 ios-sync 留下的那些明确的过时平铺文件，防止应用 target 里残留第二套陈旧测试框架。
   源码管理：`DebugBridge/` 是生成物，绝不手改。当队友或 CI 在没有 gstack 的情况下构建 Debug 配置时，把它提交进去（gstack 升级后重跑生成器）；否则把 `DebugBridge/` 加入 `.gitignore`，让每位开发者自行运行生成器。告诉用户你选了哪一种。
2. 把生成的 `DebugBridge` 本地 SPM 依赖加入应用的 `Package.swift`。这个 package 提供三个仅限 Debug 配置的库产物：
   - `DebugBridgeCore`（Swift，跨平台）——StateServer 与桥协议。
   - `DebugBridgeTouch`（Objective-C，仅 iOS）——源自 KIF 的进程内触摸合成，配合 iOS 18+ 的 `_UIHitTestContext` 做 SwiftUI 命中测试。
   - `DebugBridgeUI`（Swift，仅 iOS）——截图 / 元素 / 变更桥的实现。
   应用 target 以 `.when(configuration: .debug)` 依赖 `DebugBridgeUI`（会传递引入 Core + Touch）。Release 构建拒绝链接这些 target。
3. 在 `@main` App 的 init 里接上这些桥，用 `#if DEBUG` 门控：
   ```swift
   #if DEBUG
   import DebugBridgeCore
   #if canImport(UIKit)
   import DebugBridgeUI
   // Install resolvers before StateServer opens its listener.
   DebugBridgeUIWiring.installAll()
   #endif
   // Replace AppState/AppStateAccessor with the type discovered in Phase 1.
   DebugBridgeManager.shared.start(
       appState: appState,
       register: AppStateAccessor.register
   )
   #endif
   ```
4. 用 `xcodebuild -scheme <SchemeName>
   -destination 'platform=iOS,id=<UDID>' build install` 构建并部署到设备。
5. 通过 `devicectl device process launch --device <UDID> <bundle-id>` 启动。启动时 StateServer 会把一次性 boot token 写入应用 `tmp/` 下的 0600 文件；守护进程用 `devicectl` 把它取出来。该 token 永远不会打印到 `os_log`。如果应用写不了这个文件，它会记录 `NOT READY`，守护进程则报告 `boot_token_unavailable` 并附上原因。
6. 按需启动 Mac 侧守护进程——`gstack-ios-qa-daemon`。守护进程会对 `~/.gstack/ios-qa-daemon.pid` 取独占 flock。如果已有守护进程在跑，第二次调用会发现它的端口并连上去。
7. 守护进程立即用仅存在于内存中的新 token 调用 iOS StateServer 的 `POST /auth/rotate`。轮换会删除 boot-token 文件，因此此后取得的副本都是失效凭证。
   如果新起的守护进程发现应用仍在运行、而一次性 token 已被另一个守护进程消费，它会校验 bundle 归属、把目标重启一次、等待新 token、再次校验归属，然后轮换。

## Phase 3：视觉驱动的 agent 循环

每轮迭代：

1. `GET /screenshot`（经守护进程）→ 保存 PNG。
2. `GET /elements` → 无障碍树。
3. `GET /state/snapshot`（仅 `// @Snapshotable` 字段）→ 当前状态。
4. 根据屏幕内容与测试目标的差距决定下一步动作。
5. `POST /session/acquire` 取得设备锁。
6. 执行 `POST /tap`、`/swipe`、`/type`，或 `POST /state/<key>` 写入。
7. 重新截图；比对；如有缺陷则记录发现。
8. 本轮结束后 `POST /session/release`。

每个经 tailnet 监听器（若启用了远程模式）认证的写请求，都会往
`~/.gstack/security/ios-qa-audit.jsonl` 写一行审计记录。

## 模式

**本地 USB 模式（默认）。** 守护进程只绑定回环地址，不需要 Tailscale。发起调用的技能获得全部能力。适合单人开发。

**Tailnet 模式（`--tailnet`）。** 守护进程额外绑定 Tailscale 接口（绝不绑定 `0.0.0.0`）。需要本地运行 `tailscaled`，且守护进程能读取 `/var/run/tailscale.sock`。一旦 socket 缺失、权限不足或返回无法解析的 WhoIs 响应，就 fail closed（直接失败，不降级放行）。远程 agent 经 tailnet 调用 `POST /auth/mint`，守护进程通过 WhoIs 规范化身份、检查白名单文件、签发会话令牌。见 `ios-qa/docs/tailscale-acl-example.md`。

**能力分级（tailnet 模式）。** 签发的令牌默认是 `interact`（点击、滑动、输入）。更高等级需要所有者显式签发：

- **observe：** `/screenshot`、`/elements`、`GET /state/*`、`/healthz`、
  `/session/heartbeat`。
- **interact：** observe + `/tap`、`/swipe`、`/type`。
- **mutate：** interact + `POST /state/<key>`。
- **restore：** mutate + `POST /state/restore`。

所有者在 Mac 上通过 `gstack-ios-qa-mint --remote <identity> --capability <tier>`
签发。经 tailnet 自助签发只对已在白名单中的身份生效。

**录制模式（`--recording`）。** DebugOverlay 会在角落渲染一个小号斜向 "AGENT DEMO" 水印，让录屏对"设备由 agent 驱动"这一事实没有歧义。

## 演示模式

如果用户说 "demo"、"demo mode"、"show me" 或 "I want to see it working"，就以 **DEMO MODE** 运行。这会改变 agent 与应用交互的方式：

演示模式下，每个动作都通过可见的 UI 完成（`/tap`、`/swipe`、`/type`），而不用 `POST /state/*` 写入，因为观众会盯着每一步：他们看到 agent 敲下每一个键、点下每一个按钮。本技能的其他规则仍然适用。设备上的 DebugOverlay 归属标签会显示 "Driven by Claude Code (demo)" 或远程 agent 的身份。

演示模式下，截屏频率提升到 4fps，让录像看起来是实时的。

## 失败模式与恢复

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 对守护进程 `curl: connection refused` | 守护进程崩溃 | 重新运行 `/ios-qa`；防止启动竞争的锁会 fail closed |
| `/auth/mint` 返回 `403 identity_not_allowed` | 身份不在白名单里 | 在 Mac 上运行 `gstack-ios-qa-mint --remote <identity>` |
| `/state/restore` 返回 `409 schema_mismatch` | 快照来自旧版应用构建 | 丢弃快照，重新抓取 |
| 代理返回 `503 device_disconnected` / `504 upstream_timeout` | USB 路由断开、应用停止或应用被重启 | 守护进程会用会话 bearer 探测正在运行的应用并保留会话（不重启，应用状态完好）。只有当应用拒绝了 bearer（401）、应用未运行，或当前选中了另一台设备时才重新 bootstrap。丢失的 `/tap`/`/swipe`/`/type` 响应绝不重放：重试前先看屏幕。若仍不恢复，重连或解锁设备 |
| bootstrap 时出现 `multiple_devices` | 连接了 iPhone 和 iPad（或两台设备），但没设目标 | 运行打印出的 `export GSTACK_IOS_TARGET_UDID=<udid>`，然后重启守护进程 |
| `boot_token_unavailable ... could not write` | 应用的 `tmp/` 不可写 | 修复应用容器，重启应用 |
| 守护进程重启后应用被重启 | 新守护进程没有会话 bearer，而一次性 boot token 已不存在 | 这是预期行为：首次 bootstrap 会把应用重启一次；一个会话期间保持单个守护进程存活 |
| `/auth/mint` 返回 `429 rate_limited` | 单个身份每分钟签发超过 10 次 | 等 60s；检查审计日志是否有异常 |
| `/state/restore` 返回 `413 body_too_large` | 快照超过 1MB | 提高 `--max-body` 或裁剪快照 |

## 已知限制

以下限制经用户真机确认，目前无法在桥内修复。请围绕它们制定方案：

- **iOS 26 上的 SwiftUI 手势。** 进程内合成的触摸会报告成功，但永远到不了 SwiftUI 的 `DragGesture`（例如由拖拽输入驱动的 `Canvas`），即使把触摸分成多个 phase 也一样（在 iOS 26.5 上观察到）。按钮和 UIKit 控件仍然响应。对于手势驱动的视图，让应用在 `#if DEBUG` 下把输入处理暴露给桥，通过状态写入来驱动它们，或者用 XCUITest 测试框架覆盖该流程。
- **`/swipe` 只能滚动。** 它移动最近的外层 `UIScrollView`，没有这样的视图时返回 `false`；它不是拖拽。自定义的 pan 或拖拽视图需要用上面的输入路由办法。
- **iOS 26 上的 `/elements`。** 进程内的 SwiftUI 无障碍树经常没有被实体化：一台 iOS 26.3.1 的 iPhone 12 Pro 只返回了三个承载视图，没有任何标识或标签。此时从截图定位控件，按坐标点击。
- **iPad 窗口。** iPad 会话与 iPhone 会话工作方式相同，但覆盖层和窗口选择尚未在台前调度（Stage Manager）或多场景下验证过；把看到的情况报告出来。

## 清理

在 Release 构建前，用 `/ios-clean` 移除 DebugBridge 这个 SPM 依赖和所有 `#if DEBUG` 接线。这是便利流程；真正与安全相关的是结构性防线（Package.swift 中的 `.when(configuration: .debug)` 加上 CI 的 `swift build -c release` 检查）。