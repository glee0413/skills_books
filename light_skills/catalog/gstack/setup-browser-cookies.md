---
id: gstack/setup-browser-cookies
title: setup-browser-cookies
description: 把用户真实 Chromium 浏览器里的 cookie 导入 headless 浏览会话，动手前先问清来源、目标页面和各项开关。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: setup-browser-cookies/SKILL.md
snapshotPath: source-snapshots/gstack/setup-browser-cookies/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# 配置浏览器 Cookie

## 1. 检查 Aside

如果当前 checkout 里同时有 `BROWSER.md` 和 `browse/SKILL.md`，就把它当作 gstack 根目录；否则使用包含 `bin/gstack-skill-start` 的已安装根目录，绝不要使用生成出来的宿主 stub。读该根目录下 `browse/SKILL.md` 的 **BROWSER SETUP** 一节，并运行其中的 Aside 探测。

- **Aside 探测打印 `READY`：** 不需要导入，因为 Aside 里已经有用户登录好的会话。告诉用户直接用 Aside，或在其中登录，然后结束本技能。
- **其他任何结果：** 继续使用 gstack 自带的 headless 浏览器（`$B`）。

## 2. 先向用户问清每一个决定

在运行任何 `$B` 命令之前，把这些一次性问完。绝不猜答案，也不要把默认的 Comet 浏览器当成同意。

1. **来源浏览器与配置文件。** `--profile` 接收的是配置文件的目录名（`Default`、`Profile 2`），不是它的显示名。读不到的配置文件算“未知”，不算“为空”。
2. **要导入的域名**，以及**目标**：会话应当打开的、所选域名上的某一个页面，用 URL 给出。
3. **要不要做登录校验（`--verify-auth`）？** 默认不做。它会重新加载目标页面，只有在同源响应成功、且用 CSS 选择器恰好找到一个可见元素、其空白归一化后的文本等于预期身份时，才报告 **verified**。若选是，由用户私下提供选择器和预期身份。
4. **是否清理残留存储（`--clear-storage`）？** 默认不清理；需要明确批准。仅限 Chromium。它只清目标 origin 的 localStorage（该 origin 的各标签页共用）和目标标签页的 sessionStorage，别的都不动；其他浏览器引擎会拒绝这次重置，但仍然照常导入。重置失败时可能已经清掉一部分存储，且不会回滚。
5. **是否导入配置文件里的全部 cookie（`--all`）？** 默认不导入；需要明确同意。它不能与域名同时使用，也不能与清理存储同时使用。

如果第 1、2 项里还有没答的，就用选择器（picker），它会追问这些。如果用户已经点名了浏览器、配置目录和域名，就用直接导入。

## 3. 准备 gstack 的浏览器

1. 如果用户要校验，让他在运行 `$B` 的那个 shell 里私下设置 `GSTACK_COOKIE_AUTH_SELECTOR` 和 `GSTACK_COOKIE_AUTH_EXPECTED_IDENTITY`。浏览器 daemon 只在启动时读取这两个变量，所以如果已经有 gstack daemon 在跑，先执行 `$B stop`。绝不自己编造这两个值。
2. 按 `browse/SKILL.md` 的 **Browser fallback** 一节找到 `$B`；如果检查打印 `NEEDS_SETUP`，就先把它构建出来。
3. 运行 `$B status`。如果它报告 `Mode: cdp`，说明 `$B` 接的是用户真实浏览器，已经有那边的会话：告诉用户不需要导入，然后结束本技能。
4. 打开第 2 项里的目标 URL，在导入完成前不要碰那个标签页：

```bash
$B goto "<url>"
```

## 4. 导入

选择器（用户在那里确认浏览器、配置和域名，如果之前要求校验就勾上，完成后告诉你；链接只能用一次、有效期五分钟，过期就重跑命令）：

```bash
$B cookie-import-browser
```

直接导入：用选定的浏览器名运行 `$B cookie-import-browser`，每次运行只带一个 `--domain`，`--profile` 填配置目录（不是显示名）；只有用户在第 2 步说了“要”，才加 `--verify-auth` 或 `--clear-storage`。

如果导入因为缺少校验设置被拒绝，说明什么都没变：告诉用户缺哪个变量，然后回到第 3 步。其他错误和回执失败原因去读同一根目录下的 `BROWSER.md` **Choosing a source and checking sign-in** 一节；那里有错误表、示例、配置标签、支持的来源和平台设置。

## 5. 如实报告

按导入回执报告，不要拿原始的 `$B cookies` 来报告，写成三行：

- `Imported: <count> (<imported|partial|empty|failed>, as the receipt says) from <browser> for <domains>`
- `Storage reset: <done|failed|not requested>`
- `Sign-in: <verified|not verified|not checked>`

**not checked** 表示没有请求校验；**not verified** 表示跑了但没通过；**verified** 必须身份匹配。cookie 数量、导入为零、HTTP 200 都不能证明已登录。导入的 cookie 作用于整个浏览器上下文，不是单个标签页。

绝不在公开日志里索取或发布 cookie 值、密码、身份或配置文件内容、会话细节、原始错误。

## 平台边界

Dia 只支持 macOS。钥匙串授权由用户决定。数据库重试有次数上限；权限被拒需要用户处理，而不是反复弹窗。

Windows 支持 DPAPI 兼容的 cookie，不是所有 App-Bound Encryption；原生提取在通过资格验证前保持关闭。关闭 Chrome 绕不过 Chrome 136+ 的默认目录保护，编号配置也一样。没有 TCP 回退，也不会复制真实配置。只有在有显示环境时才提供带界面的手动登录。