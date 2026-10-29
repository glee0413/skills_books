import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import GithubSlugger from "github-slugger";
import { marked } from "marked";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function posix(value) {
  return value.split("\\").join("/");
}

function relativeHref(fromOutputPath, targetPath) {
  const href = posix(relative(dirname(fromOutputPath), targetPath));
  return href.startsWith(".") ? href : `./${href}`;
}

function rewriteLinks(html) {
  return html.replace(/href="([^"]*?)\.md(#[^"]*)?"/g, (match, prefix, hash = "") => {
    if (prefix.includes("source-snapshots/") || /^https?:/.test(prefix)) return match;
    return `href="${prefix}.html${hash}"`;
  });
}

export function renderMarkdown(markdown) {
  const slugger = new GithubSlugger();
  const headings = [];
  let html = marked.parse(markdown, { gfm: true });

  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, depth, inner) => {
    const text = inner.replace(/<[^>]*>/g, "").trim();
    const id = slugger.slug(text);
    headings.push({ depth: Number(depth), text, id });
    return `<h${depth} id="${id}">${inner}</h${depth}>`;
  });

  return { html: rewriteLinks(html), headings };
}

function sourceBox({ source, outputPath }) {
  if (!source) return "";
  const snapshotHref = relativeHref(outputPath, source.snapshotPath);
  return `<section class="source-box">
  <strong>来源</strong>：${escapeHtml(source.project)} · <code>${escapeHtml(source.sourcePath)}</code> · ${escapeHtml(source.ref)} · commit <code>${escapeHtml(source.commit.slice(0, 7))}</code><br>
  <strong>许可证</strong>：${escapeHtml(source.license)} · <a href="${escapeHtml(source.sourceUrl)}">查看原仓库</a> · <a href="${escapeHtml(snapshotHref)}">查看英文快照</a>
</section>`;
}

function skillOverview(page) {
  if (!page.invocation) return "";
  return `<section class="skill-overview">
  <strong>${escapeHtml(page.title)}</strong>
  <span>${escapeHtml(page.project ?? page.id.split("/")[0])}</span>
  <span>${page.invocation === "user" ? "用户调用" : page.invocation === "model" ? "模型可调用" : "调用方式未知"}</span>
  <p>${escapeHtml(page.description)}</p>
</section>`;
}

function pageToc(headings) {
  if (headings.length < 2) return "";
  return `<nav class="page-toc" aria-label="页内目录"><strong>本页目录</strong><ul>${headings
    .filter((heading) => heading.depth <= 3)
    .map((heading) => `<li class="toc-depth-${heading.depth}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`)
    .join("")}</ul></nav>`;
}

function companionDocs({ documents, outputPath }) {
  if (!documents?.length) return "";
  return `<section class="companion-docs"><h2>附属文档</h2><ul>${documents
    .map(
      (document) =>
        `<li><a href="${escapeHtml(relativeHref(outputPath, document.translationPath.replace(/\.md$/, ".html")))}">${escapeHtml(document.title ?? document.id.split("/").pop())}</a></li>`,
    )
    .join("")}</ul></section>`;
}

function pager({ prev, next }) {
  if (!prev && !next) return "";
  return `<nav class="pager" aria-label="上一篇和下一篇">
  ${prev ? `<a class="prev" href="${escapeHtml(prev.href)}">← ${escapeHtml(prev.title)}</a>` : "<span></span>"}
  ${next ? `<a class="next" href="${escapeHtml(next.href)}">${escapeHtml(next.title)} →</a>` : "<span></span>"}
</nav>`;
}

export function renderPage({ page, source, html, headings, nav, prev, next, documents }) {
  const outputPath = page.outputPath;
  const assetHref = relativeHref(outputPath, "assets/book.css");
  const title = page.title ?? page.id;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Skills Book</title>
  <link rel="stylesheet" href="${escapeHtml(assetHref)}">
</head>
<body>
  <aside class="sidebar">${nav}</aside>
  <main class="content">
    ${sourceBox({ source, outputPath })}
    ${skillOverview(page)}
    <article class="markdown-body">${html}</article>
    ${companionDocs({ documents, outputPath })}
    ${pager({ prev, next })}
  </main>
</body>
</html>`;
}

function displayName(id) {
  return id.split("/").pop();
}

function sidebar({ book, sources, currentId, outputPath = "index.html" }) {
  const parts = (book.parts ?? [])
    .map((part) => {
      const chapters = (part.chapters ?? [])
        .filter((chapter) => chapter.path)
        .map((chapter) => {
          const href = posix(chapter.path).replace(/\.md$/, ".html");
          const active = chapter.id === currentId ? ' class="active"' : "";
          return `<li><a${active} href="${escapeHtml(relativeHref(outputPath, href))}">${escapeHtml(chapter.title)}</a></li>`;
        })
        .join("");
      if (!chapters) return "";
      return `<section><h2>${escapeHtml(part.title)}</h2><ul>${chapters}</ul></section>`;
    })
    .join("");

  const groups = Object.entries(book.catalog ?? {})
    .map(([project, ids]) => {
      const items = ids
        .map((id) => {
          const record = sources.skills.find((skill) => skill.id === id);
          if (!record) return "";
          const name = displayName(id);
          if (record.translationStatus === "todo") return `<li><span class="todo">${escapeHtml(name)}</span></li>`;
          const href = posix(record.translationPath).replace(/\.md$/, ".html");
          return `<li><a href="${escapeHtml(relativeHref(outputPath, href))}">${escapeHtml(name)}</a></li>`;
        })
        .join("");
      return `<section><h2>${escapeHtml(project)}</h2><ul>${items}</ul></section>`;
    })
    .join("");

  return `<div class="brand"><a href="${escapeHtml(relativeHref(outputPath, "index.html"))}">Skills Book</a></div>${parts}${groups}<p class="sidebar-footer"><a href="${escapeHtml(relativeHref(outputPath, "catalog/index.html"))}">技能全库</a></p>`;
}

function renderCatalogIndex({ book, sources }) {
  const sections = Object.entries(book.catalog ?? {})
    .map(([project, ids]) => {
      const items = ids
        .map((id) => {
          const record = sources.skills.find((skill) => skill.id === id);
          const name = displayName(id);
          if (!record || record.translationStatus === "todo") {
            return `<li><span class="todo">${escapeHtml(name)}</span> <small>待翻译</small></li>`;
          }
          const href = posix(record.translationPath).replace(/\.md$/, ".html");
          return `<li><a href="${escapeHtml(relativeHref("catalog/index.html", href))}">${escapeHtml(name)}</a></li>`;
        })
        .join("");
      return `<section><h2>${escapeHtml(project)}</h2><ul class="catalog-list">${items}</ul></section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>技能全库 · Skills Book</title><link rel="stylesheet" href="${escapeHtml(relativeHref("catalog/index.html", "assets/book.css"))}"></head>
<body><aside class="sidebar"><div class="brand"><a href="${escapeHtml(relativeHref("catalog/index.html", "index.html"))}">Skills Book</a></div></aside><main class="content"><h1>技能全库</h1><p>全部 101 个技能和 22 篇附属文档。未翻译的条目会显示为“待翻译”。</p>${sections}</main></body></html>`;
}

function renderHome({ book, sources }) {
  const firstChapter = (book.parts ?? []).flatMap((part) => part.chapters ?? []).find((chapter) => chapter.path);
  const href = firstChapter
    ? relativeHref("index.html", posix(firstChapter.path).replace(/\.md$/, ".html"))
    : relativeHref("index.html", "catalog/index.html");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(book.title)}</title><link rel="stylesheet" href="${escapeHtml(relativeHref("index.html", "assets/book.css"))}"></head>
<body><main class="content home"><h1>${escapeHtml(book.title)}</h1><p class="subtitle">${escapeHtml(book.subtitle ?? "")}</p><p><a class="button" href="${escapeHtml(href)}">开始阅读</a> <a class="button secondary" href="${escapeHtml(relativeHref("index.html", "catalog/index.html"))}">技能全库</a></p><p>${sources.skills.length} 个技能，${sources.documents.length} 篇附属文档。</p></main></body></html>`;
}

function pagerFor(list, index, outputPath) {
  const prev = index > 0 ? list[index - 1] : null;
  const next = index < list.length - 1 ? list[index + 1] : null;
  const link = (item) => (item ? { title: item.title, href: relativeHref(outputPath, item.href) } : null);
  return { prev: link(prev), next: link(next) };
}

export async function buildSite({ root, outDir }) {
  const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
  const book = JSON.parse(await readFile(join(root, "book.json"), "utf8"));

  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "assets"), { recursive: true });
  await cp(join(root, "source-snapshots"), join(outDir, "source-snapshots"), { recursive: true });
  await cp(join(root, "assets", "book.css"), join(outDir, "assets", "book.css"));

  const chapterList = (book.parts ?? [])
    .flatMap((part) => part.chapters ?? [])
    .filter((chapter) => chapter.path);

  let pages = 0;
  for (const [index, chapter] of chapterList.entries()) {
    const markdown = await readFile(join(root, chapter.path), "utf8");
    const rendered = renderMarkdown(markdown);
    const outputPath = posix(chapter.path).replace(/\.md$/, ".html");
    const pager = pagerFor(
      chapterList.map((item) => ({
        title: item.title,
        href: posix(item.path).replace(/\.md$/, ".html"),
      })),
      index,
      outputPath,
    );
    const html = renderPage({
      page: { ...chapter, outputPath },
      html: rendered.html,
      headings: rendered.headings,
      nav: sidebar({ book, sources, currentId: chapter.id, outputPath }),
      ...pager,
      documents: [],
    });
    const target = join(outDir, outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, "utf8");
    pages += 1;
  }

  const complete = [...sources.skills, ...sources.documents].filter(
    (record) => record.translationStatus !== "todo",
  );
  const catalogList = complete.map((record) => ({
    title: displayName(record.id),
    href: posix(record.translationPath).replace(/\.md$/, ".html"),
  }));

  for (const [index, record] of complete.entries()) {
    const markdown = await readFile(join(root, record.translationPath), "utf8");
    const rendered = renderMarkdown(markdown);
    const outputPath = posix(record.translationPath).replace(/\.md$/, ".html");
    const isDocument = Boolean(record.parentSkill);
    const documents = sources.documents.filter((document) => document.parentSkill === record.id);
    const pager = pagerFor(catalogList, index, outputPath);
    const html = renderPage({
      page: {
        id: record.id,
        title: displayName(record.id),
        description: inferDescription(markdown),
        invocation: isDocument ? undefined : inferInvocation(markdown),
        project: record.project,
        outputPath,
      },
      source: record,
      html: rendered.html,
      headings: rendered.headings,
      nav: sidebar({ book, sources, currentId: record.id, outputPath }),
      ...pager,
      documents: isDocument ? [] : documents,
    });
    const target = join(outDir, outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, "utf8");
    pages += 1;
  }

  await mkdir(join(outDir, "catalog"), { recursive: true });
  await writeFile(join(outDir, "catalog", "index.html"), renderCatalogIndex({ book, sources }), "utf8");
  await writeFile(join(outDir, "index.html"), renderHome({ book, sources }), "utf8");

  return { pages: pages + 2, warnings: complete.length === 0 ? ["还没有已完成的译文"] : [] };
}

function inferDescription(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return "";
  const description = match[1].match(/^description:\s*(.+)$/m);
  return description ? description[1].trim().replace(/^["']|["']$/g, "") : "";
}

function inferInvocation(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return "unknown";
  const invocation = match[1].match(/^invocation:\s*(user|model|unknown)\s*$/m);
  return invocation ? invocation[1] : "unknown";
}