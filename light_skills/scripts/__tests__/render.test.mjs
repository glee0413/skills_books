import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderMarkdown, renderPage, buildSite } from "../lib/render.mjs";

test("中文标题生成稳定锚点，并重写站内 Markdown 链接", () => {
  const result = renderMarkdown("# 想清楚\n\n[下一章](./05-product-questioning.md)\n\n[快照](../../source-snapshots/gstack/office-hours/SKILL.md)\n");
  assert.match(result.html, /<h1 id="[^"]+">想清楚<\/h1>/);
  assert.match(result.html, /href="\.\/05-product-questioning\.html"/);
  assert.match(result.html, /href="\.\.\/\.\.\/source-snapshots\/gstack\/office-hours\/SKILL\.md"/);
  assert.equal(result.headings.length, 1);
});

test("渲染前剥离 frontmatter，不把 YAML 放进正文", () => {
  const result = renderMarkdown("---\nid: a/b\ntitle: demo\n---\n\n# 正文\n\n```sh\necho hi\n```\n");
  assert.doesNotMatch(result.html, /id:\s*a\/b/);
  assert.match(result.html, /<h1 id="[^"]+">正文<\/h1>/);
});

test("渲染时移除 script/iframe 和事件属性", () => {
  const result = renderMarkdown("<script>alert(1)</script>\n\n<iframe src=\"x\"></iframe>\n\n<button onclick=\"x()\">go</button>\n");
  assert.doesNotMatch(result.html, /<script|<iframe|onclick=/i);
});

test("页面包含来源框、技能速览、页内目录、上一篇和下一篇", () => {
  const html = renderPage({
    page: {
      id: "gstack/office-hours",
      title: "office-hours",
      description: "用追问重新框定产品想法。",
      invocation: "user",
      outputPath: "catalog/gstack/office-hours.html",
    },
    source: {
      project: "gstack",
      sourcePath: "office-hours/SKILL.md",
      ref: "v1.91.226.0",
      commit: "8d9501373b5589742",
      license: "MIT",
      sourceUrl: "https://github.com/garrytan/gstack/blob/8d9501373b5589742/office-hours/SKILL.md",
      snapshotPath: "source-snapshots/gstack/office-hours/SKILL.md",
    },
    html: "<h1 id=\"a\">A</h1><h2 id=\"b\">B</h2>",
    headings: [{ depth: 1, text: "A", id: "a" }, { depth: 2, text: "B", id: "b" }],
    nav: "<nav>目录</nav>",
    prev: { title: "上一篇", href: "prev.html" },
    next: { title: "下一篇", href: "next.html" },
    documents: [],
  });
  assert.match(html, /<body class="with-sidebar">/);
  assert.match(html, /class="source-box"/);
  assert.match(html, /class="skill-overview"/);
  assert.match(html, /class="page-toc"/);
  assert.match(html, /上一篇/);
  assert.match(html, /下一篇/);
  assert.match(html, /\.\.\/\.\.\/assets\/book\.css/);
  assert.match(html, /\.\.\/\.\.\/source-snapshots\/gstack\/office-hours\/SKILL\.md/);
});

test("目录把未翻译技能渲染成不可点击的 span", async () => {
  const out = await mkdtemp(join(tmpdir(), "skills-book-test-"));
  await buildSite({ root: process.cwd(), outDir: out });

  assert.ok((await stat(join(out, "index.html"))).isFile());
  assert.ok((await stat(join(out, "catalog", "index.html"))).isFile());
  assert.ok((await stat(join(out, "source-snapshots", "gstack", "office-hours", "SKILL.md"))).isFile());

  const catalog = await readFile(join(out, "catalog", "index.html"), "utf8");
  assert.match(catalog, /待翻译/);
  assert.match(catalog, /<span[^>]*>autoplan<\/span>/);
  assert.doesNotMatch(catalog, /<a[^>]*href="[^"]*autoplan\.html"[^>]*>autoplan<\/a>/);
  assert.match(catalog, /<span[^>]*>openclaw\/office-hours<\/span>/);
  assert.match(catalog, /<span[^>]*>capy\/gstack<\/span>/);
});