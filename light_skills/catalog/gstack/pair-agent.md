---
id: gstack/pair-agent
title: pair-agent
description: 用一次性设置密钥把另一个 AI 智能体配到你的 gstack 浏览器上，让它用自己的标签页上网。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: pair-agent/SKILL.md
snapshotPath: source-snapshots/gstack/pair-agent/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /pair-agent —— 把你的浏览器共享给另一个 AI 智能体

你正坐在 Claude Code 里，浏览器也在跑。你还开着另一个 AI 智能体（OpenClaw、Hermes、Codex、Cursor，随便什么）。你想让那个智能体能**用你的浏览器**上网。这个技能就是干这个的。

## 工作原理

你的 gstack 浏览器跑着一个本地 HTTP 服务。这个技能创建一个一次性设置密钥，打印一段说明，你把这些说明粘到另一个智能体里。那个智能体用密钥换一个会话令牌，建自己的标签页，然后开始浏览。每个智能体有自己的标签页。它们碰不到彼此的标签页。

设置密钥 5 分钟后过期，且只能用一次。万一泄露，它在任何人能滥用之前就已经死了。会话令牌有效 24 小时。

**同一台机器：** 如果另一个智能体在同一台机器上（比如本地运行的 OpenClaw），你可以跳过复制粘贴的仪式，直接把凭据写进该智能体的配置目录。

**远程：** 如果另一个智能体在另一台机器上，你需要一条 ngrok 隧道。技能会告诉你是否需要，以及怎么搭。

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

## Step 1：检查前置条件

```bash
$B status 2>/dev/null
```

如果 browse 服务没在跑，启动它：

```bash
$B goto about:blank
```

这样在配对之前确保服务是活的且健康。

## Step 2：问要配哪个智能体

使用 AskUserQuestion：

> 你想让哪个智能体配上你的浏览器？这决定了说明的格式，
> 以及凭据写到哪里。

选项：
- A) OpenClaw（本地或远程）
- B) Codex / OpenAI Agents（本地）
- C) Cursor（本地）
- D) 另一个 Claude Code 会话（本地或远程）
- E) 其他（通用 HTTP 说明——Hermes 用这个）

根据答案设置 `TARGET_HOST`：
- A → `openclaw`
- B → `codex`
- C → `cursor`
- D → `claude`
- E → 通用（无宿主专属配置）

## Step 3：本地还是远程？

使用 AskUserQuestion：

> 另一个智能体跑在这同一台机器上，还是在另一台机器/服务器上？
>
> **同一台机器** 跳过复制粘贴的仪式。凭据直接写进该智能体的配置目录。
> 不需要隧道。
>
> **另一台机器** 会生成设置密钥和说明块。如果装了 ngrok，隧道自动启动。
> 没装的话，我带你一步步配置。
>
> 建议：如果智能体在本地，选 A。它是即时的，不需要复制粘贴。

选项：
- A) 同一台机器（直接写凭据）
- B) 另一台机器（生成可复制粘贴的说明块）

## Step 4：执行配对

**活守护进程的同意（单向门）。** 配对可能重启浏览器守护进程；重启会**杀掉**正在运行的 headless 守护进程——打开的标签页、cookie 和已登录会话都随之消失。CLI 遵守铁律（只有显式的 `--force-restart` 才能杀掉活守护进程），所以先检查：

```bash
$B status 2>/dev/null | head -5
```

如果有守护进程在跑，用 AskUserQuestion 询问（单向门——丢失的标签页/cookie/登录状态无法恢复）：

> "一个 headless 浏览器守护进程正在运行（标签页和登录状态可能活跃）。配对
> headed 模式需要重启它——当前守护进程里的一切都会丢失。
>
> 建议：选 B，除非远程智能体确实需要一个可见的浏览器窗口；
> 配对可以直接对着现有守护进程工作。"

选项：
- A) 重启（传 `--force-restart`；当前标签页/cookie/登录状态都会丢失）
- B) 保留活守护进程（推荐——就对着它配对）

只有明确选 A 之后，才给下面的命令传 `--force-restart`。回复含糊时绝不默认选 A——这是破坏性确认。

### 如果是同一台机器（选项 A）：

带 `--local` 参数运行 pair-agent：

```bash
$B pair-agent --local TARGET_HOST
```

把 `TARGET_HOST` 换成 Step 2 得到的值（openclaw、codex、cursor 等）。

如果成功，告诉用户：
"完成。TARGET_HOST 现在可以使用你的浏览器了。它会从写入的配置文件里读凭据。试着让它导航到一个 URL。"

如果失败（找不到宿主、写入权限错误），展示错误并建议改用通用的远程流程。

### 如果是另一台机器（选项 B）：

**同意门禁（每台机器一次）。** 隧道会把浏览器暴露到机器之外，所以在用户选择加入之前它是关闭的——否则守护进程会拒绝 `/tunnel/start` 和 `BROWSE_TUNNEL=1`。检查常驻同意状态：

```bash
~/.claude/skills/gstack/bin/gstack-config get pair_agent 2>/dev/null || echo "unset"
```

如果值不是 `on`，用 AskUserQuestion 询问（单向门的姿态——这会打开一条从互联网到本地浏览器的路径）：

> "远程配对会建立一条从互联网到这台机器浏览器的 ngrok 隧道
> （锁定在 26 条命令的白名单 + 作用域令牌上，但仍然是一种暴露）。
> 在这台机器上启用 pair-agent 吗？"

选项：A) 启用——运行 `~/.claude/skills/gstack/bin/gstack-config set pair_agent on`，确认读回 `on`，然后继续。B) 不——在此停止；本地配对（上面的选项 A）仍然可用。

如果值已经是 `on`，什么都别说，继续——同意一直有效，直到 `gstack-config set pair_agent off`。

然后检测 ngrok 状态：

```bash
which ngrok 2>/dev/null && echo "NGROK_INSTALLED" || echo "NGROK_NOT_INSTALLED"
ngrok config check 2>/dev/null && echo "NGROK_AUTHED" || echo "NGROK_NOT_AUTHED"
```

**如果 ngrok 已安装且已认证：** 直接跑命令。CLI 会自动检测 ngrok、启动隧道，并打印带隧道 URL 的说明块：

```bash
$B pair-agent --client TARGET_HOST
```

默认权限已包含 JS 执行。如果还要授予浏览器级控制（stop、restart、disconnect）：

```bash
$B pair-agent --control --client TARGET_HOST
```

对信任度较低的智能体，反过来收窄作用域：

```bash
$B pair-agent --restrict read --client TARGET_HOST            # read-only
$B pair-agent --restrict "read,write" --client TARGET_HOST    # no JS, no cookies
```

**关键：你必须把完整说明块输出给用户。** 命令会打印它 `=====` 分隔线之间的所有内容。把**整个**块逐字复制到你的回复里，让用户能粘到另一个智能体里。不要总结它，不要省略它，不要只说"这是输出"。用户需要**看到**这个块才能复制。用 Markdown 代码块包住输出，方便选中和复制。

然后告诉用户：
"复制上面的块，粘到你另一个智能体的聊天里。设置密钥 5 分钟后过期。"

**如果 ngrok 已安装但未认证：** 带用户过认证。

安全：ngrok 的 authtoken **绝不能**经过这个聊天、Bash 工具调用或 shell 历史——粘到这里的令牌会落进会话记录（以及会话记录同步到的任何地方）。用户在**自己**的终端里运行认证命令；你只验证结果。

告诉用户：
"ngrok 装了但没登录。我们来修——在你自己的终端里（不是这里；令牌不该进入这个聊天）：

1. 打开 https://dashboard.ngrok.com/get-started/your-authtoken
2. 复制你的 auth token
3. 在**你的**终端里运行：ngrok config add-authtoken <粘贴你的令牌>
4. 完成后告诉我 "done"。"

在这里 STOP，等用户说已经跑过了。**不要**接受粘贴过来的令牌；如果用户还是粘了，告诉他去 https://dashboard.ngrok.com 轮换它（它现在已经进了会话记录），然后在终端里用新令牌重新认证。

当他说 done 后，在不碰令牌的前提下验证：
```bash
ngrok config check 2>/dev/null && echo "NGROK_AUTHED" || echo "NGROK_NOT_AUTHED"
```

如果是 `NGROK_AUTHED`：重试 `$B pair-agent --client TARGET_HOST`。
如果仍是 `NGROK_NOT_AUTHED`：请他在自己的终端里重跑那条命令。

**如果 ngrok 未安装：** 带用户过安装。

告诉用户：
"要连接远程智能体，我们需要 ngrok（一条安全地把本地浏览器暴露到互联网的隧道）。

1. 打开 https://ngrok.com 注册（免费层就够）
2. 安装 ngrok：
   - macOS：`brew install ngrok`
   - Linux：`snap install ngrok`，或从 ngrok.com/download 下载
3. 认证：`ngrok config add-authtoken YOUR_TOKEN`
   （从 https://dashboard.ngrok.com/get-started/your-authtoken 取令牌）
4. 回到这里重新运行 `/pair-agent`。"

在这里 STOP。等用户装好 ngrok 并重新调用。

## Step 5：验证连接

用户把说明粘到另一个智能体后，稍等片刻再检查：

```bash
$B status
```

在状态输出里找已连接的智能体。如果出现了，告诉用户：
"远程智能体已连接，并且有自己的标签页。如果你开着 GStack Browser，可以在侧栏面板里看到它的活动。"

## 远程智能体能做什么

默认权限是 read+write+admin+meta。信任边界是配对仪式，不是作用域：
- 导航到 URL、点击元素、填写表单、截图
- 读页面内容（文本、HTML、快照）
- 创建新标签页（每个智能体有自己的）
- 通过 `eval` 执行 JavaScript
- 不能停止或重启浏览器，也不能断开 headed 模式（需要 --control）

远程智能体走隧道的命令白名单：`eval` 可用，但即使有 admin 作用域，`js`、`cookies` 和 `storage` 命令也无法通过隧道派发。用 `--local` 配对的智能体四个都有。

用 --restrict（`--restrict read`、`--restrict "read,write"`）：
- 沙箱会话：只读，或读写但没有 JS、cookie、storage 访问。当远程智能体要读取不受信任的网页内容时这样配对：一个受信任的智能体也可能被它读到的页面注入提示词，而作用域能限制影响半径（`eval` 在隧道上可用）。
- `--restrict` 绝不给 `control`；那个作用域只能在 --control 后面。
- 要收紧一个**已经**配对的智能体，用**相同的 `--client` 名字**和更窄的 `--restrict`/`--domain` 重新配对。收紧式重配会立刻吊销之前的会话并释放它的标签页——智能体必须用新密钥重连，所以旧的宽权限不会残留。不带 `--client` 重配会铸出一个全新智能体，旧的则原封不动。放宽或刷新则保留工作中的会话（不中断）。
- `root` 是保留的 `--client` 名字（它会绕过所有作用域检查）。

用 --control（--admin 是旧别名）：
- 一切权限，外加浏览器级破坏性操作（stop、restart、disconnect）
- 只给你完全信任的智能体。

## 疑难排查

**"Tab not owned by your agent"** —— 远程智能体试图操作一个不是它创建的标签页。让它先运行 `newtab` 拿到自己的标签页。

**"Domain not allowed"** —— 令牌有域名限制。用相同的 `--client` 名字和更宽（或没有）的 `--domain` 重新配对。放宽式重配保留工作中的会话；收紧式重配会立刻吊销它。

**"Rate limit exceeded"** —— 智能体每秒发送超过 10 个请求。它应当等 Retry-After 头并放慢速度。

**"Token expired"** —— 24 小时会话过期了。再运行 `/pair-agent` 生成新的设置密钥。

**智能体连不上服务** —— 如果是远程，检查 ngrok 隧道在跑（`$B status`）。如果是本地，检查 browse 服务在跑。

## 平台相关说明

### OpenClaw / AlphaClaw

OpenClaw 智能体用 `exec` 工具而不是 `Bash`。说明块使用 `exec curl` 语法，OpenClaw 原生能懂。使用 `--local openclaw` 时，凭据写入 `~/.openclaw/skills/gstack/browse-remote.json`。


### Codex

Codex 智能体可以通过 `codex exec` 执行 shell 命令。说明块里的 curl 命令可以直接用。使用 `--local codex` 时，凭据写入 `~/.codex/skills/gstack/browse-remote.json`。

### Cursor

Cursor 的 AI 可以运行终端命令。说明块原样可用。使用 `--local cursor` 时，凭据写入
`~/.cursor/skills/gstack/browse-remote.json`。

## 吊销访问

断开某个特定智能体：

```bash
$B tunnel revoke AGENT_NAME
```

这条命令会删除该智能体的所有令牌（会话以及任何待用的设置密钥），并重新读取智能体列表来证明它已经没了。

看谁配对了：

```bash
$B tunnel agents
```

未兑换的设置密钥显示为 "(pending)"；`tunnel revoke` 也会删掉它们。

要一次性断开**所有**智能体，停掉守护进程。作用域令牌存在守护进程内存里，重启绝不会存活；下一条命令会启动一个带新根令牌的全新守护进程：

```bash
$B stop
```