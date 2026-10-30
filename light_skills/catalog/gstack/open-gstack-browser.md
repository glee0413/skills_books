---
id: gstack/open-gstack-browser
title: open-gstack-browser
description: 启动带侧栏扩展、反爬隐身的 GStack Browser（受 AI 控制的 Chromium），并引导用户打开侧栏面板。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: open-gstack-browser/SKILL.md
snapshotPath: source-snapshots/gstack/open-gstack-browser/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /open-gstack-browser —— 启动 GStack Browser

启动 GStack Browser —— 受 AI 控制的 Chromium，内置侧栏扩展、反机器人隐身和定制品牌。你能实时看到每一个动作。

## SETUP（任何 browse 命令之前先跑这个检查）

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B="$HOME/.claude/skills/gstack/browse/dist/browse"
if [ -x "$B" ] && "${B%/browse/*}/bin/gstack-browser-ensure"; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

`gstack-browser-ensure` 会在安装时跳过 Chromium 的情况下（惰性安装）于首次使用时装上它；它先打印 `BROWSER_OK` 或 `BROWSER_UNAVAILABLE <reason>`。

如果输出 `NEEDS_SETUP`：
1. 告诉用户："gstack browse 需要一次性构建（约 10 秒）。可以继续吗？"然后 STOP 等待。
2. 运行：`cd <SKILL_DIR> && ./setup`
3. 如果没有安装 `bun`：
   ```bash
   if ! command -v bun >/dev/null 2>&1; then
     BUN_VERSION="1.4.2"
     BUN_INSTALL_SHA="bab8acfb046aac8c72407bdcce903957665d655d7acaa3e11c7c4616beae68dd"
     tmpfile=$(mktemp "${TMPDIR:-/tmp}/bun-install.XXXXXX")
     curl -fsSL "https://bun.sh/install" -o "$tmpfile"
     # shasum 属于 macOS/perl；只有 coreutils 的 Linux 提供的是 sha256sum ——
     # 选存在的那个，校验就不会因为缺工具而失败。
     if command -v sha256sum >/dev/null 2>&1; then
       actual_sha=$(sha256sum < "$tmpfile" | awk '{print $(1)}')
     else
       actual_sha=$(shasum -a 256 < "$tmpfile" | awk '{print $(1)}')
     fi
     if [ "$actual_sha" != "$BUN_INSTALL_SHA" ]; then
       echo "ERROR: bun install script checksum mismatch" >&2
       echo "  expected: $BUN_INSTALL_SHA" >&2
       echo "  got:      $actual_sha" >&2
       rm "$tmpfile"; exit 1
     fi
     bash "$tmpfile" "bun-v$BUN_VERSION"
     rm "$tmpfile"
   fi
   ```

## Step 0：检查是否已有 browse 守护进程在运行

正在运行的 browse 守护进程可能持有打开的标签页、cookie 和已登录会话，替换它就会丢掉这些。先探测但不要启动新的（`BROWSE_NO_AUTOSTART=1` 可以阻止 `status` 自己拉起点守护进程）：

```bash
_STATUS=$(BROWSE_NO_AUTOSTART=1 $B status 2>&1); _STATUS_RC=$?
printf '%s\n' "$_STATUS" | head -5
if [ "$_STATUS_RC" -ne 0 ]; then echo "DAEMON: none"
elif printf '%s' "$_STATUS" | grep -q 'Mode: headed'; then echo "DAEMON: headed"
else echo "DAEMON: live"; fi
```

- **`DAEMON: none`**：没有守护进程响应。清掉崩溃留下的 Chromium profile 锁，然后执行 Step 1 里普通的 `$B connect`。CLI 会自己回收孤立的 Chromium 和过期状态，并且仍然会拒绝替换一个活着但太忙没空应答的守护进程；如果它拒绝了，展示它的输出然后停止。

  ```bash
  GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
  _PROFILE_DIR="$GSTACK_STATE_ROOT/chromium-profile"
  for _LF in SingletonLock SingletonSocket SingletonCookie; do
    rm -f "$_PROFILE_DIR/$_LF" 2>/dev/null || true
  done
  ```

- **`DAEMON: headed`**：GStack Browser 已经打开了。Step 1 里普通的 `$B connect` 会报告这一点；继续到 Step 2。

- **`DAEMON: live`**：有一个 headless 守护进程在跑。如果 `SESSION_KIND:` 是 `spawned` 或 `headless`，不要询问，也不要替换它。打印下面这行然后停止：

  ```bash
  printf 'Live browse daemon left running. Run %s stop, then re-run /open-gstack-browser to replace it.\n' "$B"
  ```

  否则使用 AskUserQuestion。替换守护进程不可撤销：

  > 已经有一个 browse 守护进程在运行（标签页和登录状态可能仍活跃）。
  > 打开 GStack Browser 会替换它，那个守护进程里的一切都会
  > 丢失。
  >
  > 建议：选 B，除非你已经用完了当前会话。

  选项：
  - A) 替换它（运行 `$B connect --force-restart`；它的标签页、cookie 和登录状态都会丢失）
  - B) 保持运行并在此停止

  只有明确选 A 才用 `--force-restart` 执行 Step 1。选 B，或回复看不出是 A 时，打印上面那行 "Live browse daemon left running" 然后停止。

## Step 1：连接

```bash
$B connect
```

只有在 Step 0 明确选 A 之后才用：

```bash
$B connect --force-restart
```

这会以 headed 模式启动 GStack Browser（重 branding 的 Chromium），带来：
- 一个你可以盯着看的可见窗口（不是你的日常 Chrome——它不受影响）
- 通过 `launchPersistentContext` 自动加载 gstack 侧栏扩展
- 反机器人隐身补丁（Google 和 NYTimes 这类站点不用验证码就能用）
- 定制的 user agent，以及 Dock/菜单栏里的 GStack Browser 品牌
- 一个用于聊天命令的侧栏 agent 进程

`connect` 命令会从 gstack 安装目录自动发现扩展。它始终使用端口 **34567**，这样扩展才能自动连接。

连接后，把完整输出打印给用户。确认输出里有 `Mode: headed`。

如果输出显示错误或模式不是 `headed`，运行 `$B status` 并把输出给用户看，然后再继续。

## Step 2：验证

```bash
$B status
```

确认输出显示 `Mode: headed`。从状态文件里读出端口：

```bash
cat "$(git rev-parse --show-toplevel 2>/dev/null)/.gstack/browse.json" 2>/dev/null | grep -o '"port":[[:space:]]*[0-9]*' | grep -o '[0-9]*'
```

端口应当是 **34567**。如果不是，记下来——用户打开 Side Panel 时可能需要它。

同时找出扩展路径，方便在用户需要手动加载时帮他：

```bash
_EXT_PATH=""
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -n "$_ROOT" ] && [ -f "$_ROOT/.claude/skills/gstack/extension/manifest.json" ] && _EXT_PATH="$_ROOT/.claude/skills/gstack/extension"
[ -z "$_EXT_PATH" ] && [ -f "$HOME/.claude/skills/gstack/extension/manifest.json" ] && _EXT_PATH="$HOME/.claude/skills/gstack/extension"
echo "EXTENSION_PATH: ${_EXT_PATH:-NOT FOUND}"
```

## Step 3：引导用户打开 Side Panel

使用 AskUserQuestion：

> Chrome 已经以 gstack 控制的方式启动。你应该能看到 Playwright 的 Chromium
> （不是你的日常 Chrome），页面顶部有一条金色闪光细线。
>
> Side Panel 扩展应当已经自动加载。打开它：
> 1. 在工具栏里找 **拼图图标**（Extensions）——如果扩展加载成功，
>    它可能已经显示 gstack 图标
> 2. 点击 **拼图图标** → 找到 **gstack browse** → 点击 **图钉图标**
> 3. 点击工具栏里固定好的 **gstack 图标**
> 4. Side Panel 应当从右侧打开，显示实时活动流
>
> **端口：** 34567（自动探测——在 Playwright 控制的 Chrome 里扩展会自动连接）。

选项：
- A) 我能看到 Side Panel——开始吧！
- B) 我能看到 Chrome，但找不到扩展
- C) 出问题了

如果选 B：告诉用户：

> 扩展在启动时被加载进 Playwright 的 Chromium，但有时它不会立刻出现。
> 试试这些步骤：
>
> 1. 在地址栏输入 `chrome://extensions`
> 2. 找 **"gstack browse"**——它应当已被列出并启用
> 3. 如果它在那儿但没固定，回到任意页面，点拼图图标，把它固定住
> 4. 如果它根本没被列出，点击 **"Load unpacked"** 并定位到：
>    - 在文件选择框里按 **Cmd+Shift+G**
>    - 粘贴这个路径：`{EXTENSION_PATH}`（用 Step 2 得到的路径）
>    - 点击 **Select**
>
> 加载后固定它，再点图标打开 Side Panel。
>
> 如果 Side Panel 的徽章一直是灰色（未连接），点 gstack 图标
> 手动输入端口 **34567**。

如果选 C：

1. 运行 `$B status` 并展示输出
2. 如果服务端不健康，重跑 Step 0 的清理 + Step 1 的连接
3. 如果服务端健康但浏览器看不见，试试 `$B focus`
4. 如果还是不行，问用户看到了什么（错误信息、白屏等）

## Step 4：演示

用户确认 Side Panel 能用后，做个快速演示：

```bash
$B goto https://news.ycombinator.com
```

等 2 秒，然后：

```bash
$B snapshot -i
```

告诉用户："看 Side Panel——你应该能在活动流里看到 `goto` 和 `snapshot` 命令。Claude 运行的每条命令都会实时出现在这里。"

## Step 5：侧栏聊天

活动流演示之后，给用户介绍侧栏聊天：

> Side Panel 还有一个 **聊天标签页**。试着输入类似"拍个快照并描述这个页面"的消息。
> 一个侧栏 agent（Claude 的子实例）会在浏览器里执行你的请求——你会看到
> 命令一条条出现在活动流里。
>
> 侧栏 agent 可以导航页面、点击按钮、填写表单、读取内容。每个任务最多 5 分钟。
> 它运行在隔离会话里，所以不会干扰当前这个 Claude Code 窗口。

## Step 6：接下来做什么

告诉用户：

> 都准备好了！用这个连上的 Chrome 你可以：
>
> **实时看 Claude 干活：**
> - 运行任意 gstack 技能（`/qa`、`/design-review`、`/benchmark`），
>   在可见的 Chrome 窗口 + Side Panel 活动流里看每一步动作
> - 不需要导入 cookie——Playwright 浏览器用自己的会话
>
> **直接控制浏览器：**
> - **侧栏聊天**——在 Side Panel 里用自然语言输入，侧栏 agent 会执行
>   （例如"填写登录表单并提交"）
> - **browse 命令**——`$B goto <url>`、`$B click <sel>`、`$B fill <sel> <val>`、
>   `$B snapshot -i`——都能在 Chrome + Side Panel 里看到
>
> **窗口管理：**
> - `$B focus`——随时把 Chrome 切到前台
> - `$B disconnect`——关闭 headed Chrome，回到 headless 模式
>
> **技能在 headed 模式下是什么样：**
> - `/qa` 在可见浏览器里跑完整测试套件——你会看到每个页面加载、
>   每次点击、每条断言
> - `/design-review` 在真实浏览器里截图——和你看到的是同样的像素
> - `/benchmark` 在 headed 浏览器里测性能

然后继续做用户交代的事。如果用户没有指定任务，问他想测试或浏览什么。