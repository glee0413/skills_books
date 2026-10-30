---
id: gstack/make-pdf
title: make-pdf
description: 把 Markdown 文件渲染成带封面、目录、页眉页脚和图示的出版级 PDF、HTML 或 DOCX。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: make-pdf/SKILL.md
snapshotPath: source-snapshots/gstack/make-pdf/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# make-pdf：从 Markdown 生成出版级 PDF

把 `.md` 文件变成看起来像 Faber & Faber 随笔集的 PDF：1 英寸页边距、正文左对齐、通篇 Helvetica、弯引号和长破折号、可选的封面页和可点击目录、需要时的对角线 DRAFT 水印。从 PDF 里复制粘贴得到的是干净的文字，绝不会变成 "S a i l i n g"。

在 Linux 上，为了正确渲染请安装 `fonts-liberation`——Helvetica 和 Arial 默认并不存在，而 Liberation Sans 是标准的度量兼容替代字体。CI 和 Docker 构建会通过 Dockerfile.ci 自动安装。

Emoji 需要彩色 emoji 字体。macOS（Apple Color Emoji）和 Windows（Segoe UI Emoji）自带，大多数 Linux 发行版和容器没有，所以 emoji 会渲染成空方块（▯）。`./setup` 会在 Linux 上（apt/dnf/pacman/apk，尽力而为）自动安装 `fonts-noto-color-emoji`，打印 CSS 也会依次回退到 Apple / Segoe / Noto emoji 字族。设置 `GSTACK_SKIP_FONTS=1` 可以跳过安装（没有 sudo 的 CI、受管或离线机器）。这些在 gstack-browser 回退路径上才有影响；Aside 用的是 Mac 上已有的字体。

PDF 输出在 Aside 浏览器（macOS 15+，aside.com）运行时通过它打印，其他情况（Linux、Windows，或 Aside 应用已关闭）回退到 gstack 自带的 headless 浏览器（由 `./setup` 构建；`GSTACK_BROWSE_BIN` / `BROWSE_BIN` 指向别的构建）。退出码 4 表示两个浏览器都不可用。`--to html` 和 `--to docx` 完全不需要浏览器（DOCX 里的图示需要浏览器来栅格化；没有浏览器时它们会以源文本形式嵌入）。

## 核心用法

### 80% 的场景 —— 备忘录/信件

一条命令，不带参数。默认得到干净的 PDF，含页眉、页码和 CONFIDENTIAL 页脚。

```bash
"$P" generate letter.md                 # writes /tmp/letter.pdf
"$P" generate letter.md letter.pdf      # explicit output path
```

### 出版模式 —— 封面 + 目录 + 分章

```bash
"$P" generate --cover --toc --author "Garry Tan" --title "On Horizons" \
  essay.md essay.pdf
```

Markdown 里每个顶层 H1 都从新页开始。对于恰好有多个 H1 的备忘录，用 `--no-chapter-breaks` 关掉。

### 草稿阶段水印

```bash
"$P" generate --watermark DRAFT memo.md draft.pdf
```

每页都有 10% 不透明度的对角线 DRAFT。草稿定稿后去掉这个参数重新生成。

### 用 preview 快速迭代

```bash
"$P" preview essay.md
```

用同一套打印 CSS 渲染 HTML 并在浏览器里打开。改 Markdown 时刷新即可。准备好之前不必走一遍 PDF。

### 去掉品牌（没有 CONFIDENTIAL 页脚）

```bash
"$P" generate --no-confidential memo.md memo.pdf
```

### 图示 —— mermaid 和 excalidraw 围栏渲染成图片

Markdown 中顶格（第 0 列）的 ` ```mermaid ` 或 ` ```excalidraw ` 围栏会渲染成清晰的矢量图，完全离线（内置 bundle，不走 CDN）。缩进的围栏（在列表里）按设计仍是普通代码块。写坏的围栏会显示一个红色的诊断块并给出解析错误——绝不会静默输出原始代码。

围栏 info string 的选项：

```
```mermaid title="Auth flow"        ← caption + aria-label
```mermaid render=false             ← keep it as a code block
```mermaid page=landscape           ← force this diagram onto a landscape page
```mermaid page=portrait            ← veto auto-landscape for this diagram
```

` ```excalidraw ` 围栏里放的是一整份 .excalidraw 场景文件（也就是 excalidraw.com 保存的内容）。用英文创作新图示是 `/diagram` 的职责——它输出一组可编辑的三件套（源码、.excalidraw、SVG/PNG），并与本技能配合：在 Markdown 里嵌入 `.mmd` 源码，而不是 PNG。

### 图片 —— 正确缩放，绝不截断

本地图片自动内联（相对路径基于 Markdown 文件解析）。每张图片都以内容区为上限——永远不截断。过大的照片会缩小到打印分辨率（300dpi），这样文件体积小，又看不出画质损失。

远程（http/https）图片默认被**拦截并显示可见占位符**——这是离线策略；传 `--allow-network` 才去抓取。解析到 Markdown 目录之外的图片（哪怕是通过符号链接）仍会内联，但会大声警告；`--strict` 会把它变成致命错误。超过 64MB 的文件或非常规文件（fifo、设备）会降级为占位符，而不是把整次运行卡住。

逐图指令，写在图片紧后面：

```
![chart](data.png){width=full}      ← stretch to content-box width
![chart](data.png){width=50%}       ← percentage or 3in/8cm/200px
![wide](arch.png){page=landscape}   ← give it its own landscape page
![wide](shot.png){page=portrait}    ← veto auto-landscape
```

又宽又小字的图示图片会自动提升到单独的横向页（判断较保守：宽高比 ≥ 1.8、宽度超过内容区约 2.5 倍，并且 alt 里带图示类词——diagram/architecture/flowchart/chart/graph）。被提升的页面垂直居中。启发式判断错了时，`{page=portrait}` 可以否决；漏判的情况只需补 `{page=landscape}`。

### 其他格式 —— 单文件 HTML 和 Word

```bash
"$P" generate readme.md out.html --to html    # ONE self-contained file: inline
                                            # SVG diagrams, data-URI images,
                                            # zero network refs, screen-readable
"$P" generate readme.md out.docx --to docx    # Word: content fidelity (headings,
                                            # tables, code, diagrams as PNG) —
                                            # layout is Word's, not ours
```

`--to` 是输出格式。`--format` 完全是另一回事（`--page-size` 的别名）——别搞混。

### CI 模式 —— 缺失资源直接失败

```bash
"$P" generate docs.md --strict     # missing, remote, out-of-tree, oversized,
                                 # and non-regular-file images exit non-zero
                                 # instead of warn + placeholder
```

## 常用参数

```
页面布局：
  --margins <dim>            1in（默认）| 72pt | 2.54cm | 25mm
  --page-size letter|a4|legal

结构：
  --cover                    封面页（标题、作者、日期、细分隔线）
  --toc                      带页码的可点击目录
  --no-chapter-breaks        不在每个 H1 处另起一页

品牌：
  --watermark <text>         对角线水印（"DRAFT"、"CONFIDENTIAL"）
  --header-template <html>   自定义页眉
  --footer-template <html>   自定义页脚（与 --page-numbers 互斥）
  --no-confidential          不输出右下角的 CONFIDENTIAL

输出：
  --to pdf|html|docx         输出格式（默认：pdf）。html = 单个
                             自包含文件；docx = 内容保真。
  --strict                   缺失、远程、目录外、超大或非常规
                             文件的图片会让本次运行失败（CI 模式）。
  --page-numbers             "N of M" 页脚（默认开启）
  --tagged                   无障碍 PDF（默认开启）
  --outline                  从标题生成 PDF 书签（默认开启）
  --quiet                    不输出 stderr 进度
  --verbose                  输出各阶段耗时

网络：
  --allow-network            抓取外部图片。默认关闭：远程
                             图片渲染成可见的拦截占位符
                             （打印时不抓取任何追踪像素）。

元数据：
  --title "..."              文档标题（默认取第一个 H1）
  --author "..."             封面和 PDF 元数据里的作者
  --date "..."               封面日期（默认今天）
```

## 什么时候运行

用户想把 Markdown 变成 PDF 时，运行 `"$P" generate`。如果用户打开着一个 `.md` 文件并说"让它好看点"，建议 `"$P" generate --cover --toc`，先问再跑。

## 调试

- 退出码 4 / "no browser available" → Aside 浏览器（macOS 15+，aside.com）和 gstack 自带的 headless 浏览器都不可用。打开 Aside，或在 gstack 仓库里运行 `./setup` 构建回退浏览器，再重试。`"$P" setup` 会检查整条链路并说明它找到了哪个浏览器。
- 图示显示红色的 "failed to render" 块 → 解析错误就打印在块里。如果每个图示都报 "diagram renderer:" 失败，说明浏览器在运行中途消失了（Aside 被关掉，或回退守护进程挂了）。
- 复制粘贴出来是碎片化文字 → 删掉围栏代码块后重新生成（没有参数能关掉代码样式）。
- 退出码 3（`$P: --toc: …`）→ 目录页码无法与打印出的 PDF 对上；消息里会说明原因。去掉 `--toc`，或者如果它说页码没有稳定下来，就缩短过长的目录标题。
- 输出里出现 "[remote image blocked]" 占位符 → 加 `--allow-network`（请理解这是授权该 Markdown 文件从其图片 URL 抓取内容）。
- 生成的 PDF 太高或太宽 → `--page-size a4` 或 `--margins 0.75in`。

## 输出约定

```
stdout: /tmp/letter.pdf          ← just the path, one line
stderr: Rendering HTML...        ← progress spinner (unless --quiet)
        Rendering PDF through Aside...   ← or "through gstack's browser"
        Done in 11.2s. 43 words · 22KB · /tmp/letter.pdf

exit code: 0 success / 1 bad args / 2 render error / 3 TOC page numbers failed
           / 4 no browser available (Aside not open, fallback not built)
```

抓取路径：`PDF=$("$P" generate letter.md)` —— 然后使用 `$PDF`。