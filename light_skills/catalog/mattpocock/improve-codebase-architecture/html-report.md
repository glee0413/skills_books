---
id: mattpocock/improve-codebase-architecture/html-report
title: html-report
description: 规定架构审查报告的 HTML 脚手架、卡片结构、图表模式与视觉风格。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/improve-codebase-architecture/HTML-REPORT.md
snapshotPath: source-snapshots/mattpocock/improve-codebase-architecture/html-report.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/improve-codebase-architecture
---

# HTML 报告格式

架构审查渲染成一个自包含的 HTML 文件，放在操作系统临时目录。Tailwind 和 Mermaid 都来自 CDN。Mermaid 可靠地处理图状图表；手工构建的 div 和内联 SVG 处理更有编辑感的视觉（体量图、剖面图）。两者混用：不要什么都靠 Mermaid，它会开始显得千篇一律。

## 脚手架

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review for {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* small custom layer for things Tailwind doesn't cover cleanly:
         dashed seam lines, hand-drawn-feeling arrow heads, etc. */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## 页眉

仓库名、日期，以及一份紧凑的图例：实线框 = 模块，虚线 = 接缝，红色箭头 = 泄漏，深色粗框 = 深模块。不要引言段落。直接进入候选方案。

## 候选卡片

图表承担主要重量。文字稀疏、平实，并使用术语表里的术语（来自 `/codebase-design` 技能），不加修饰。

每个候选方案是一个 `<article>`：

- **Title**：简短，点出加深动作（例如 "Collapse the Order intake pipeline"）。
- **Badge row**：推荐强度（`Strong` = emerald，`Worth exploring` = amber，`Speculative` = slate），外加一个依赖类别标签（`in-process`、`local-substitutable`、`ports & adapters`、`mock`）。
- **Files**：等宽字体列表，`font-mono text-sm`。
- **Before / After diagram**：核心。两栏并排。模式见下。
- **Problem**：一句话。哪里疼。
- **Solution**：一句话。改什么。
- **Wins**：要点列表，每条不超过 6 个词。例如 "Tests hit one interface"、"Pricing logic stops leaking"、"Delete 4 shallow wrappers"。
- **ADR callout**（如适用）：一行，放在琥珀色底框里。

不要成段的解释。如果一张图需要一段话才能看懂，就重画这张图。

## 图表模式

选适合候选方案的模式。混着用。不要让每张图看起来都一样。多样性本身就是重点的一部分。

### Mermaid 图（处理依赖与调用流的主力）

当要点是“X 调用 Y，Y 调用 Z，看看这堆乱麻”时，用 Mermaid 的 `flowchart` 或 `graph`。把它包进 Tailwind 样式的卡片，免得显得像硬塞进来的。用 classDef 把泄漏边涂红、把深模块涂深。时序图很适合表达“之前：6 次往返；之后：1 次”。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手工框与箭头（当 Mermaid 的布局跟你作对时）

模块是带边框和标签的 `<div>`。箭头是内联 SVG 的 `<line>` 或 `<path>` 元素，绝对定位在相对容器上。当你想让“之后”的图看起来像一个粗边框的深模块、内部灰掉时，就用这个，因为 Mermaid 渲染不出那种正确的视觉重量。

### 剖面图（适合层状浅化）

堆叠水平条带（`h-12 border-l-4`）来展示一次调用穿过的各层。之前：6 个薄层，每层什么也没做。之后：1 个厚条带，标着合并后的职责。

### 体量图（适合“接口和实现一样宽”的情况）

每个模块两个矩形：一个表示接口表面积，一个表示实现。之前：接口矩形几乎和实现矩形一样高（浅）。之后：接口矩形很短，实现矩形很高（深）。

### 调用图折叠

之前：一棵函数调用树，渲染成嵌套的框。之后：同一棵树折叠成一个框，现在变成内部的调用在里面淡色显示。

## 样式指引

- 偏编辑感，不要企业仪表盘。留白充足。标题可以选衬线体（`font-serif` 配 stone/slate 效果不错）。
- 颜色要克制：一个强调色（emerald 或 indigo），加上红色表示泄漏、琥珀色表示警告。
- 图表高度保持约 320px，让前后对比能舒适地并排显示而无需滚动。
- 图内模块标签用 `text-xs uppercase tracking-wider`，让它们读起来像示意图而不是 UI。
- 唯一的脚本是 Tailwind CDN 和 Mermaid ESM 导入。除此之外报告是静态的：没有应用代码，除了 Mermaid 自身的渲染之外没有交互。

## Top recommendation 小节

一张更大的卡片。候选方案名称、一句说明为什么、指向它那张卡片的锚点链接。就这些。

## 语气

用词平实、简洁，但架构名词和动词直接来自 `/codebase-design` 技能。简洁不是跑偏的借口。

**只用这些词：**module、interface、implementation、depth、deep、shallow、seam、adapter、leverage、locality。

**绝不用这些替代：**component、service、unit（代替 module）· API、signature（代替 interface）· boundary（代替 seam）· layer、wrapper（代替 module，当你指的是 module 时）。

**符合这种风格的措辞：**

- "Order intake module is shallow: interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

**Wins 要点**用术语表的词说出收益：*"locality: bugs concentrate in one module"*、*"leverage: one interface, N call sites"*、*"interface shrinks; implementation absorbs the wrappers"*。不要写 *"easier to maintain"* 或 *"cleaner code"*，因为这些词不在术语表里，也不配占位置。

不要含糊其辞，不要清嗓子，不要 "it's worth noting that…"。如果一句话可以写成要点，就写成要点。如果一个要点可以删掉，就删掉。如果某个术语不在 `/codebase-design` 的术语表里，先去找一个在里面的，再考虑发明新的。