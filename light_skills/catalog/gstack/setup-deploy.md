---
id: gstack/setup-deploy
title: setup-deploy
description: 探测项目的部署平台、生产 URL、健康检查与部署状态命令，把结果写入 CLAUDE.md，让 /land-and-deploy 无需每次重新推断。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: setup-deploy/SKILL.md
snapshotPath: source-snapshots/gstack/setup-deploy/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /setup-deploy — 为 gstack 配置部署

你在帮用户配置他们的部署，好让 `/land-and-deploy` 能自动工作。你的任务是探测部署平台、生产 URL、健康检查和部署状态命令，然后把这一切持久化到 CLAUDE.md。

跑过这一次之后，`/land-and-deploy` 会直接读 CLAUDE.md，完全跳过探测。

## 指令

### Step 1: 检查现有配置

```bash
grep -A 20 "## Deploy Configuration" CLAUDE.md 2>/dev/null || echo "NO_CONFIG"
```

如果配置已经存在，把它显示出来并问：

- **Context:** CLAUDE.md 里已经存在部署配置。
- **RECOMMENDATION:** 如果你的环境有变化，选 A 更新。
- A) 从头重新配置（覆盖现有的）
- B) 编辑特定字段（显示当前配置，让我只改一处）
- C) 完成 —— 配置看着没问题

如果用户选 C，停止。

### Step 2: 探测平台

运行部署引导脚本里的平台探测：

```bash
# Platform config files
[ -f fly.toml ] && echo "PLATFORM:fly" && cat fly.toml
[ -f render.yaml ] && echo "PLATFORM:render" && cat render.yaml
{ [ -f vercel.json ] || [ -d .vercel ]; } && echo "PLATFORM:vercel"
[ -f netlify.toml ] && echo "PLATFORM:netlify" && cat netlify.toml
[ -f Procfile ] && echo "PLATFORM:heroku"
{ [ -f railway.json ] || [ -f railway.toml ]; } && echo "PLATFORM:railway"

# GitHub Actions deploy workflows
for f in $(find .github/workflows -maxdepth 1 \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null); do
  [ -f "$f" ] && grep -qiE "deploy|release|production|staging" "$f" 2>/dev/null && echo "DEPLOY_WORKFLOW:$f"
done

# Project type
[ -f package.json ] && grep -q '"bin"' package.json 2>/dev/null && echo "PROJECT_TYPE:cli"
find . -maxdepth 1 -name '*.gemspec' 2>/dev/null | grep -q . && echo "PROJECT_TYPE:library"
```

### Step 3: 平台专属设置

根据探测结果，引导用户完成平台专属的配置。如果探测到多个平台，先问清楚哪个平台承载这个项目的生产目标。探测只是线索，不是选择结果。确认项目是 Web 应用、API、CLI 还是库；探测到的 CLI/库标记可以作为默认值。

#### Fly.io

如果探测到 `fly.toml`：

1. 提取应用名：`grep -m1 "^app" fly.toml | sed 's/app = "\(.*\)"/\1/'`
2. 检查 `fly` CLI 是否已安装：`which fly 2>/dev/null`
3. 如果已安装，验证：`fly status --app {app} 2>/dev/null`
4. 推断 URL：`https://{app}.fly.dev`
5. 设置部署状态命令：`fly status --app {app}`
6. 设置健康检查：运行 `curl -s -o /dev/null -w "%{http_code}" https://{app}.fly.dev/health`；返回 2xx 就用 `https://{app}.fly.dev/health`，否则用 `https://{app}.fly.dev`

请用户确认生产 URL。有些 Fly 应用用自定义域名。

#### Render

如果探测到 `render.yaml`：

1. 从 render.yaml 提取服务名和类型
2. 只检查 Render API key 是否已设置。绝不打印 key 的任何字节，包括前缀：
```bash
if [ -n "${RENDER_API_KEY:-}" ]; then
  echo "RENDER_API_KEY: set"
else
  echo "RENDER_API_KEY: not set"
fi
```
3. 推断 URL：`https://{service-name}.onrender.com`
4. Render 在推送到所连接的分支时自动部署 —— 不需要部署工作流
5. 设置健康检查：推断出的 URL

请用户确认。Render 用所连接 git 分支的自动部署 —— 合并到默认分支后，Render 会自动接上。/land-and-deploy 里的“部署等待”应当轮询 Render URL，直到它响应新版本。

#### Vercel

如果探测到 vercel.json 或 .vercel：

1. 检查 `vercel` CLI：`which vercel 2>/dev/null`
2. 如果已安装：`vercel ls --prod 2>/dev/null | head -3`
3. Vercel 在推送时自动部署 —— PR 出预览，合并到默认分支出生产 —— 但这只在 Vercel 项目已连接到本 Git 仓库时成立。对于纯 CLI 项目，问清生产部署怎么跑，并把那条命令记为部署触发方式
4. 设置健康检查：vercel 项目设置里的生产 URL
如果 CLI 拿不到生产 URL，就向用户要，写入前先确认。

#### Netlify

如果探测到 netlify.toml：

1. 从 netlify.toml 提取站点信息
2. Netlify 在推送时自动部署
3. 设置健康检查：生产 URL
向用户要生产 URL 并确认；不要从仓库名推断。

#### Heroku / Railway

这些标记无法可靠地识别出生产应用或服务。把探测到的平台保留为建议，用下面的 Custom / Manual 问题收集生产 URL、触发方式和状态检查。

#### 仅 GitHub Actions

如果探测到部署工作流但没有平台配置：

1. 读工作流文件，弄清它做什么
2. 提取部署目标（如果文中提到）
3. 向用户要生产 URL
4. 设置部署状态命令：`gh run list --workflow {workflow file name} --limit 1 --json headSha,status,conclusion`

#### Custom / Manual

如果什么都没探测到：

只用 Vercel CLI 部署的项目没有 `vercel.json` 也没有 `.vercel/`；`vercel link` 会创建 `.vercel/`，所以重跑一次就能探测到。

用 AskUserQuestion 收集信息：

1. **部署是怎么触发的？**
   - A) 推送到默认分支时自动触发（Fly、Render、Vercel、Netlify 等）
   - B) 通过 GitHub Actions 工作流
   - C) 通过部署脚本或 CLI 命令（描述一下）
   - D) 手动（SSH、控制台等）
   - E) 还没有部署任何东西（第一次生产部署还没发生）
   - F) 这个项目永远不部署（库、CLI、工具）

   选 E 就停在这里，什么都不写：现在既没有生产 URL，也没有部署触发方式可记录。告诉用户，这个技能配置的是 `/land-and-deploy` 如何验证一次部署，而第一次上线是独立的一步，用平台自己的 CLI 或用户选的上线工具完成。先把项目跑起来，等第一次生产部署存在后再重跑 `/setup-deploy`。选 F 则走 Step 4，写入 `none` 配置。

2. **生产 URL 是什么？**（自由文本 —— 应用实际运行的 URL）

3. **gstack 怎么判断一次部署成功了？**
   - A) 对特定 URL 做 HTTP 健康检查（例如 /health、/api/status）
   - B) CLI 命令（例如 `fly status`、`kubectl rollout status`）
   - C) 检查 GitHub Actions 工作流状态
   - D) 没有自动方式 —— 只看 URL 能不能打开

4. **有没有合并前或合并后的钩子？**
   - 合并前要跑的命令（例如 `bun run build`）
   - 合并后、部署验证前要跑的命令

### Step 4: 写入配置

写入之前，先收集尚未确认的字段（只有用户确认过、或上面某个平台小节已经设定的字段才算确认；Fly、Heroku/Railway 和 GitHub Actions 都不会设定部署触发方式）：合并方式（squash/merge/rebase，只提供 `gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed` 报告为允许的那些）、合并前命令或 none、部署触发方式、状态/健康检查。只问缺的值，所有平台路径都一样。如果项目不部署，把 platform/URL/workflow/status/health/trigger 都设为 `none`，保留它的 CLI/库项目类型，并跳过部署验证。展示完整的建议配置并获得确认。

读 CLAUDE.md（或创建它）。找到并替换 `## Deploy Configuration` 小节（如果存在），否则追加到末尾。

```markdown
## Deploy Configuration (configured by /setup-deploy)
- Platform: {platform}
- Production URL: {url}
- Deploy workflow: {workflow file or "auto-deploy on push"}
- Deploy status command: {command or "HTTP health check"}
- Merge method: {squash/merge/rebase}
- Project type: {web app / API / CLI / library}
- Post-deploy health check: {health check URL or command}

### Custom deploy hooks
- Pre-merge: {command or "none"}
- Deploy trigger: {command or "automatic on push to <default branch>"}
- Deploy status: {command or "poll production URL"}
- Health check: {URL or command}
```

用 `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` 解析 `<default branch>`。hooks 块要重复 /land-and-deploy 实际运行的命令：`Deploy status` 与 `Deploy status command` 同值，`Health check` 与 `Post-deploy health check` 同值。两个地方都要写。

### Step 5: 验证

写完之后，验证配置确实可用：

1. 如果配置了健康检查 URL，试一下：
```bash
curl -sf "{health-check-url}" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "UNREACHABLE"
```

2. 如果配置了部署状态命令，试一下：
```bash
_OUT=$({deploy-status-command} 2>&1); _RC=$?
printf '%s\n' "$_OUT" | head -5
[ "$_RC" -eq 0 ] || echo "COMMAND_FAILED (exit $_RC)"
```

汇报结果。如果有失败，记录下来但不要阻塞 —— 即使健康检查暂时不可达，配置本身仍然有用。

### Step 6: 小结

```
DEPLOY CONFIGURATION — COMPLETE
════════════════════════════════
Platform:      {platform}
URL:           {url}
Health check:  {health check}
Status cmd:    {status command}
Merge method:  {merge method}

Saved to CLAUDE.md. /land-and-deploy will use these settings automatically.

Next steps:
- Run /land-and-deploy to merge and deploy your current PR
- Edit the "## Deploy Configuration" section in CLAUDE.md to change settings
- Run /setup-deploy again to reconfigure
```

## 重要规则

- **绝不泄露密钥。** 不打印完整的 API key、令牌或密码。
- **和用户确认。** 写入前总是展示探测到的配置并请求确认。
- **CLAUDE.md 是唯一事实源。** 所有配置都放在那里 —— 不放在单独的配置文件里。
- **幂等。** 多次运行 /setup-deploy 会干净地覆盖上一次的配置。
- **平台 CLI 是可选的。** 如果 `fly` 或 `vercel` CLI 没装，退回到基于 URL 的健康检查。