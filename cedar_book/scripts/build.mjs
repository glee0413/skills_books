import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import GithubSlugger from "github-slugger";
import { marked } from "marked";

const root = process.cwd();
const outDir = join(root, "site");
const book = JSON.parse(await readFile(join(root, "book.json"), "utf8"));
const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
const units = sources.units;
const byId = new Map(units.map((unit) => [unit.id, unit]));

function esc(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function posix(value) {
  return value.split("\\").join("/");
}
function href(from, to) {
  const value = posix(relative(dirname(from), to));
  return value.startsWith(".") ? value : `./${value}`;
}
function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return result;
}
function renderMarkdown(markdown) {
  const slugger = new GithubSlugger();
  const headings = [];
  let html = marked.parse(stripFrontmatter(markdown), { gfm: true });
  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, depth, inner) => {
    const text = inner.replace(/<[^>]*>/g, "").trim();
    const id = slugger.slug(text);
    headings.push({ depth: Number(depth), text, id });
    return `<h${depth} id="${id}">${inner}</h${depth}>`;
  });
  html = html.replace(/href="([^"]*?)\.md(#[^"]*)?"/g, (match, prefix, hash = "") => {
    if (prefix.includes("source-snapshots/") || /^https?:/.test(prefix)) return match;
    return `href="${prefix}.html${hash}"`;
  });
  return { html, headings };
}
function sourceBox(unit, outputPath) {
  return `<section class="source-box">
  <strong>来源</strong>：${esc(unit.project)} · <code>${esc(unit.sourcePath)}</code> · ${esc(unit.ref)} · commit <code>${esc(unit.commit.slice(0, 7))}</code><br>
  <strong>许可证</strong>：${esc(unit.license)} · <a href="${esc(unit.sourceUrl)}">查看原仓库</a> · <a href="${esc(href(outputPath, unit.snapshotPath))}">查看英文快照</a>
</section>`;
}
function sidebar(currentId, outputPath) {
  const parts = book.parts.map((part) => {
    const chapters = part.chapters.map((chapter) => {
      const active = chapter.id === currentId ? ' class="active"' : "";
      return `<li><a${active} href="${esc(href(outputPath, posix(chapter.path).replace(/\.md$/, ".html")))}">${esc(chapter.title)}</a></li>`;
    }).join("");
    return `<section><h2>${esc(part.title)}</h2><ul>${chapters}</ul></section>`;
  }).join("");
  const groups = Object.entries(book.catalog).map(([project, ids]) => {
    const items = ids.map((id) => {
      const unit = byId.get(id);
      if (!unit) return "";
      if (unit.translationStatus === "todo") return `<li><span class="todo">${esc(unit.title)}</span></li>`;
      return `<li><a href="${esc(href(outputPath, posix(unit.catalogPath).replace(/\.md$/, ".html")))}">${esc(unit.title)}</a></li>`;
    }).join("");
    return `<section><h2>${esc(project)}</h2><ul>${items}</ul></section>`;
  }).join("");
  return `<div class="brand"><a href="${esc(href(outputPath, "index.html"))}">Cedar 授权策略实战</a></div>${parts}${groups}<p class="sidebar-footer"><a href="${esc(href(outputPath, "catalog/index.html"))}">知识全库</a></p>`;
}
function page({ title, body, nav, source, outputPath, prev, next }) {
  const css = href(outputPath, "assets/book.css");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · Cedar 授权策略实战</title><link rel="stylesheet" href="${esc(css)}"></head><body class="with-sidebar"><aside class="sidebar">${nav}</aside><main class="content">${source ? sourceBox(source, outputPath) : ""}<article class="markdown-body">${body}</article>${prev || next ? `<nav class="pager"><a class="prev" href="${esc(prev?.href ?? "#")}">${prev ? `← ${esc(prev.title)}` : ""}</a><a class="next" href="${esc(next?.href ?? "#")}">${next ? `${esc(next.title)} →` : ""}</a></nav>` : ""}</main></body></html>`;
}
function catalogIndex() {
  const groups = Object.entries(book.catalog).map(([project, ids]) => {
    const items = ids.map((id) => {
      const unit = byId.get(id);
      if (!unit) return "";
      if (unit.translationStatus === "todo") return `<li><span class="todo">${esc(unit.title)}</span> <small>待整理</small></li>`;
      return `<li><a href="${esc(href("catalog/index.html", posix(unit.catalogPath).replace(/\.md$/, ".html")))}">${esc(unit.title)}</a></li>`;
    }).join("");
    return `<section><h2>${esc(project)}</h2><ul class="catalog-list">${items}</ul></section>`;
  }).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>知识全库 · Cedar 授权策略实战</title><link rel="stylesheet" href="${esc(href("catalog/index.html", "assets/book.css"))}"></head><body class="with-sidebar"><aside class="sidebar"><div class="brand"><a href="${esc(href("catalog/index.html", "index.html"))}">Cedar 授权策略实战</a></div></aside><main class="content"><h1>知识全库</h1><p>共 ${units.length} 个来源条目，按项目分组。</p>${groups}</main></body></html>`;
}
function home() {
  const first = book.parts[0].chapters[0];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cedar 授权策略实战</title><link rel="stylesheet" href="${esc(href("index.html", "assets/book.css"))}"></head><body><main class="content home"><h1>Cedar 授权策略实战</h1><p class="subtitle">${esc(book.subtitle)}</p><p><a class="button" href="${esc(href("index.html", posix(first.path).replace(/\.md$/, ".html")))}">开始阅读</a> <a class="button secondary" href="${esc(href("index.html", "catalog/index.html"))}">知识全库</a></p><p>${units.length} 个来源条目，来源固定在 cedar-docs、cedar 和 cedar-examples 的 commit 上。</p></main></body></html>`;
}

await rm(outDir, { recursive: true, force: true });
await mkdir(join(outDir, "assets"), { recursive: true });
await cp(join(root, "source-snapshots"), join(outDir, "source-snapshots"), { recursive: true });
await cp(join(root, "assets", "book.css"), join(outDir, "assets", "book.css"));

const chapterList = book.parts.flatMap((part) => part.chapters);
let pages = 0;
for (const [index, chapter] of chapterList.entries()) {
  const markdown = await readFile(join(root, chapter.path), "utf8");
  const rendered = renderMarkdown(markdown);
  const outputPath = posix(chapter.path).replace(/\.md$/, ".html");
  const prev = index > 0 ? { title: chapterList[index - 1].title, href: posix(chapterList[index - 1].path).replace(/\.md$/, ".html") } : null;
  const next = index < chapterList.length - 1 ? { title: chapterList[index + 1].title, href: posix(chapterList[index + 1].path).replace(/\.md$/, ".html") } : null;
  const html = page({ title: chapter.title, body: rendered.html, nav: sidebar(chapter.id, outputPath), outputPath, prev: prev ? { ...prev, href: href(outputPath, prev.href) } : null, next: next ? { ...next, href: href(outputPath, next.href) } : null });
  await mkdir(dirname(join(outDir, outputPath)), { recursive: true });
  await writeFile(join(outDir, outputPath), html, "utf8");
  pages++;
}
const complete = units.filter((unit) => unit.translationStatus !== "todo");
for (const [index, unit] of complete.entries()) {
  const markdown = await readFile(join(root, unit.catalogPath), "utf8");
  const rendered = renderMarkdown(markdown);
  const outputPath = posix(unit.catalogPath).replace(/\.md$/, ".html");
  const html = page({ title: unit.title, body: rendered.html, nav: sidebar(unit.id, outputPath), source: unit, outputPath });
  await mkdir(dirname(join(outDir, outputPath)), { recursive: true });
  await writeFile(join(outDir, outputPath), html, "utf8");
  pages++;
}
await mkdir(join(outDir, "catalog"), { recursive: true });
await writeFile(join(outDir, "catalog", "index.html"), catalogIndex(), "utf8");
await writeFile(join(outDir, "index.html"), home(), "utf8");
console.log(`built ${pages + 2} pages, ${complete.length}/${units.length} source entries complete`);