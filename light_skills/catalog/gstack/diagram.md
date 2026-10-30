---
id: gstack/diagram
title: diagram
description: 把一段英文描述（或 mermaid 源码）变成三件套：源码、可在 excalidraw.com 编辑的 .excalidraw 文件，以及渲染好的 SVG + PNG。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: diagram/SKILL.md
snapshotPath: source-snapshots/gstack/diagram/SKILL.md
license: MIT
translatedAt: 2026-10-30
---

# /diagram — 输入英文，输出可编辑的图

每次运行都产出一个**三件套**，绝不是一个没法再改的像素堆：

| 产物 | 用途 |
|---|---|
| `<slug>.mmd` | mermaid 源码 —— 对 LLM 友好的交换格式 |
| `<slug>.excalidraw` | 可编辑场景 —— 在 excalidraw.com 打开，挪一个框，接着改 |
| `<slug>.svg` + `<slug>.png` | 给文档用的清晰矢量图 + 给聊天/issue/README 用的位图 |

渲染完全离线：diagram-render 包（`lib/diagram-render/dist/diagram-render.html`）是一个自包含页面，`gstack-render` 从本机的回环服务器打开它 —— Aside 在运行时用 Aside 浏览器，否则用 gstack 自带的 headless 浏览器。它的第一行输出会说明用的是哪个（`ENGINE=aside` 或 `ENGINE=browse`）；两种方式产出的三件套完全相同。没有 CDN，没有网络。

## 步骤 1 —— 编写图

按用户的要求写 mermaid。规则：

- **流程图（`graph LR`/`graph TD`）和时序图**会转换成完全可编辑的 excalidraw 场景（真正的框、箭头和文本）。流水线/流程优先用 `graph LR`，层级结构优先用 `graph TD`。
- 状态图、类图、gantt 以及其他 mermaid 类型能正常渲染成 SVG/PNG，也仍会生成 `.excalidraw`，但转换器会把它们导出为**单个图片元素**：它能在 excalidraw.com 打开、能移动和批注，但不能逐个框编辑。交付这类图时要告诉用户这一点。
- 节点标签要短，细节放在边标签里。5-15 个节点是可读范围。如果用户的需求超过这个数，拆成多张图并说明原因。

确定输出目录：cwd 是 git 仓库时用 `./diagrams/`（产物可提交），否则用 `/tmp/gstack-diagrams/`。由图的主题推导 `<slug>`（kebab-case，≤40 字符）。

## 步骤 2 —— 暂存渲染包（每会话一次）

`gstack-render` 每次渲染都会在 127.0.0.1 上提供渲染包所在目录（Aside 拒绝 `file://`，而且两个引擎拿到的是同一来源）。把渲染包暂存到 gstack 自己的渲染暂存目录 `${TMPDIR:-/tmp}/gstack-render`（只属于你：如果该名字是符号链接或属于其他用户，就改用私有的 `mktemp -d`），按包的 sha 做内容寻址：被提供服务的目录里只有 gstack 的包，并发会话或混用的 gstack 版本之间永不互相覆盖。

```bash
BUNDLE=""
for c in "$HOME/.claude/skills/gstack/lib/diagram-render/dist/diagram-render.html" \
         "$(git rev-parse --show-toplevel 2>/dev/null)/lib/diagram-render/dist/diagram-render.html"; do
  [ -f "$c" ] && BUNDLE="$c" && break
done
[ -z "$BUNDLE" ] && echo "BUNDLE_MISSING — run: cd ~/.claude/skills/gstack && bun run build:diagram-render" && exit 1
RD="${TMPDIR:-/tmp}/gstack-render"
if [ -e "$RD" ] && { [ -L "$RD" ] || [ ! -O "$RD" ]; }; then RD=$(mktemp -d "${TMPDIR:-/tmp}/gstack-render.XXXXXX"); else mkdir -p -m 700 "$RD"; fi
SHA=$(shasum -a 256 "$BUNDLE" | cut -c1-16)
STAGED="$RD/gstack-diagram-render-$SHA.html"
[ -f "$STAGED" ] && shasum -a 256 "$STAGED" | grep -q "^$SHA" || { cp "$BUNDLE" "$STAGED.$$" && mv "$STAGED.$$" "$STAGED"; }
echo "STAGED: $STAGED"
```

记住 `STAGED:` 路径 —— 下面每次渲染都会打开它（它代表 `<staged>`）。如果出现 `BUNDLE_MISSING`：停下来，把构建命令给用户看。不要临时搞一个 CDN 回退 —— 离线是契约。

## 步骤 3 —— 渲染三件套

先把 mermaid 源码写到 `<outdir>/<slug>.mmd`（Write 工具）。一次 `gstack-render` 调用渲染整个三件套：它在浏览器里打开暂存包，等页面加载完成（`#done`），在页面内按顺序执行 `--eval` 表达式，并把每个结果写到紧跟其后的 `--out` 路径。页面本身不能读文件，所以源码要通过 **base64** 传入 —— 绝不要把文件内容拼进 JS 模板字面量（源码里的反引号、`${` 和反斜杠会被解释，从而损坏内容）：

```bash
SRC=$(base64 < <outdir>/<slug>.mmd | tr -d '\n')
bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-render.ts "<staged>" --wait-selector '#done' \
  --eval "window.__renderMermaid('diagram-1', atob('$SRC')).then(s => (window.__svg = s))" --out <outdir>/<slug>.svg \
  --eval "window.__rasterize(window.__svg, 1950)" --out <outdir>/<slug>.png \
  --eval "window.__mermaidToExcalidraw(atob('$SRC')).then(j => (window.__scene = j))" --out <outdir>/<slug>.excalidraw
```

无论哪种图类型，始终运行全部三组 `--eval`/`--out`。PNG 宽 1950px（6.5in 版面的 300dpi）。成功时每个产物打印一行 `OK <path>`。输出里还要看另外两种行：

- 硬性的 `ERROR:` 行（例如 `ERROR: render script did not finish: Error: Parse
  error on line 4: ...`）是 mermaid 解析错误。没有复制出任何东西。把错误给用户看，修好 `.mmd` 再重试 —— 不要把坏掉的源码文件交给用户。
- `PAGE_ERRORS=[...]` 里包含 `Error processing Mermaid diagram` 说明 excalidraw 转换器退回了单图片元素（步骤 1 里的状态图/类图/gantt 情形）。三件套是完整且正确的；照样交付 `.excalidraw`，并注明它不能按元素编辑。其他任何 `PAGE_ERRORS` 文本：先读一遍再相信输出。

注意：`atob()` 产生的是 Latin-1；对含非 ASCII 标签的源码，用 `decodeURIComponent(escape(atob('…')))` 精确还原 UTF-8。

`gstack-render` 自己挑浏览器：Aside 在运行时用 Aside，否则用 gstack 自带的 headless 浏览器。只有当它打印 `NEEDS_ASIDE` 或 `ASIDE_NOT_RUNNING`，随后打印 `ERROR: no browser available` 时，才是真的没有可渲染的浏览器 —— Aside（macOS 15+，aside.com）没开，且 gstack 的浏览器没构建。让用户打开 Aside，或者在 gstack 仓库里运行 `./setup` 构建回退浏览器，然后停止。绝不要替他们安装 Aside，也绝不要改用 CDN 或其他渲染器。

## 步骤 4 —— 展示并交付

1. 用 Read 工具读 PNG，让用户直接在对话里看到图。
2. 列出三件套的路径。
3. 一行可编辑性说明："`.excalidraw` 文件可以在 excalidraw.com 打开
   （File → Open）—— 在那里改完，我可以从改过的场景重新渲染。"
4. 如果用户要改，编辑 `.mmd` 源码并重跑步骤 3 —— 源码是唯一事实源。

重新渲染**编辑过的** `.excalidraw`（用户往返）：加载场景文件并导出，完全不碰 mermaid —— 同样走 base64 传输，因为场景 JSON 里全是引号和反斜杠：

```bash
SCENE=$(base64 < <outdir>/<slug>.excalidraw | tr -d '\n')
bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-render.ts "<staged>" --wait-selector '#done' \
  --eval "window.__excalidrawToSvg(atob('$SCENE')).then(s => (window.__svg = s))" --out <outdir>/<slug>.svg \
  --eval "window.__rasterize(window.__svg, 1950)" --out <outdir>/<slug>.png
```

这条路径会打印一条无害的 `PAGE_ERRORS`：excalidraw 的字体子集化在单文件包里从 worker 退回主线程（`WorkerInTheMainChunkError`）。SVG/PNG 是正确的；忽略这一条。

## 规则

- **没有渲染过的三件套不许交付。** 光一个 `.mmd` 文件不是图。如果无法渲染（包缺失、没有可用浏览器），说明情况并停止。
- 对要放进 PDF 的图：提醒用户 `make-pdf` 原生渲染 ` ```mermaid ` 围栏 —— 把 `.mmd` 嵌进他们的 markdown 比嵌 PNG 更好。

## 完成状态

- DONE —— 三件套已交付并展示（对非流程图、非时序图类型附上"仅图片"说明）。
- BLOCKED —— 包缺失或没有可用浏览器；已给出构建命令、"open Aside" 或 "run ./setup"。