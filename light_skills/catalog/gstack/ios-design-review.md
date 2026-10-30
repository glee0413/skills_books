---
id: gstack/ios-design-review
title: ios-design-review
description: 在真实 iOS 设备上做设计师视角的视觉审查，按 10 个维度逐屏打分并给出改进建议。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: ios-design-review/SKILL.md
snapshotPath: source-snapshots/gstack/ios-design-review/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# iOS 设计审查

在真实 iOS 设备上做设计师视角的质量检查（QA）。找出视觉不一致、间距问题、层级问题、AI 生成的敷衍套路，以及无障碍缺口。每个维度按 0-10 打分。评分细则沿用 `/plan-design-review`，但换成 iOS 的表达方式。

## 连接

使用正在运行的 `gstack-ios-qa-daemon`。如果没有守护进程在跑，按 `/ios-qa` 同样的流程（Phase 0-2）启动一个。默认只读——不做任何写操作调用。

## 维度与评分

对应用里的每个屏幕，按 0-10 打分，并说明做什么能让它到 10 分：

1. **字体层级。** 标题、正文、辅助说明的字号与 Apple HIG 一致。SF Pro 使用正确的动态字体（Dynamic Type）档位。行高与字号匹配。任何地方都不要出现 12pt 的正文。
2. **间距节奏。** 一致使用 4pt 或 8pt 网格。不要出现 17/23/31pt 这类凭感觉的魔法内边距。尊重安全区（safe area）内缩。
3. **颜色层级。** 主操作对比度最高；次要操作弱化；破坏性操作要能区分。深色模式渲染正确。对比度满足 WCAG AA：正文 4.5:1，大字号文本 3:1。
4. **触摸目标。** 每个可交互元素不小于 44x44pt。不要有小于 24pt 的"可点文字"。
5. **加载、空态与错误态。** 三种状态都存在且是刻意设计的。异步工作期间不要出现空白屏。空态要说明下一步该做什么。
6. **无障碍。** 每个可交互元素都有 VoiceOver 标签。动态字体放到 XXL 时布局不破。尊重"减弱动态效果"（Reduce Motion）。色盲配色经过验证（红绿色盲最常见）。
7. **动画克制。** 同时进行的动画不超过 2 个。UI 反馈时长 200-300ms。弹簧阻尼合适（严肃流程里不要弹来弹去）。
8. **符合 iOS 习惯。** 在合适的地方使用原生组件（`NavigationStack`、`List`、`Form`、系统 sheet）。不要重新发明导航。手机端不要用网页式的汉堡菜单。
9. **信息密度。** 单屏内容不需要横向滚动就能看全。长页面要有分节锚点。列表使用真正的 iOS 列表模式（滑动删除、上下文菜单）。
10. **AI 敷衍检查。** 通用素材站式布局、残留的 "lorem ipsum" 数据、从 Android 照搬来的 Material Design、闻起来像 AI 生成的渐变。

## 循环

1. `POST /session/acquire`，能力声明为 `observe`（只读）。
2. 对每个主要屏幕（屏幕列表由用户提供，或从无障碍树自动发现）：
   - `GET /screenshot`
   - `GET /elements`
   - 应用这 10 个维度的评分细则。
   - 记录发现。
3. 产出一份 markdown 报告，内嵌截图、每屏得分，以及每个维度的"性价比最高的修法"建议。
4. 任何低于 7 分的项都用 AskUserQuestion 提出——给出问题、推荐修法和对价，让用户决定是否处理。

## 输出

把 markdown 报告写到
`$GSTACK_STATE_ROOT/projects/<slug>/ios-design-review-<date>.md`，路径用下面这段代码打印的 `PROJECT_DIR`：

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
```

截图内嵌在报告里。CEO/工程审查类技能在规划 UI 改动时可以引用这份报告。

## 失败模式

| 现象 | 处理 |
|---|---|
| /screenshot 返回 `403 capability_insufficient` | 守护进程处于 tailnet 模式，令牌低于 `observe` 级别——需要所有者用 `--capability observe` 重新签发 |
| 截图全黑或空白 | 应用可能在前台但还没渲染；用 AskUserQuestion 确认应用处于预期状态 |
| 只拿到 10 个屏幕，但基准屏幕清单说应有 12 个 | 用 AskUserQuestion 询问：是否有 2 个藏在尚未触发的状态后面？ |