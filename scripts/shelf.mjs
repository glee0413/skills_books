#!/usr/bin/env node
// The bookshelf entry point: one server, one homepage, every book under /books/<slug>/.
//
// A book is any directory with a book.json (and a built site/index.html). Its shelf
// metadata lives in book.json under `shelf`; the category tree lives in bookshelf.json
// at the repository root. Adding a book is a directory plus one field, not an edit here.

import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, resolve, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Bind every interface by default so a board or a laptop on the same network can open
// the shelf. Pass --host 127.0.0.1 to keep it on the machine.
const DEFAULT_HOST = "0.0.0.0";
const WILDCARD_HOSTS = new Set(["0.0.0.0", "::", ""]);

// One address per interface, preferring 192.168.x: a machine with several NICs and
// aliases should not print a wall of addresses nobody can pick from.
function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    const ipv4 = (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254."));
    const preferred = ipv4.find((entry) => entry.address.startsWith("192.168.")) ?? ipv4[0];
    if (preferred) addresses.push(preferred.address);
  }
  return [...new Set(addresses)];
}

export function displayUrls(host, port) {
  if (WILDCARD_HOSTS.has(host)) {
    return [`http://127.0.0.1:${port}/`, ...lanAddresses().map((address) => `http://${address}:${port}/`)];
  }
  return [`http://${host}:${port}/`];
}

// Directories that can never be books, or are too costly to walk.
const SKIP = new Set([
  "node_modules",
  ".git",
  ".opencode",
  ".superpowers",
  "opensrc",
  "docs",
  "skills",
  "scripts",
  "site",
  "assets",
  "catalog",
  "book",
  "source-snapshots",
  "third-party",
]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortCommit(commit) {
  return typeof commit === "string" && commit.length >= 7 ? commit.slice(0, 7) : "";
}

function countChapters(book) {
  return (book.parts ?? []).reduce((n, part) => n + (part.chapters?.length ?? 0), 0);
}

function listCatalog(book) {
  return Object.values(book.catalog ?? {}).flat();
}

// sources.json is uniform in the newer books but still has a per-project shape in
// older ones. Take the unit arrays wherever they are, so both are counted the same.
function collectUnits(sources) {
  if (!sources) return [];
  if (Array.isArray(sources.units)) return sources.units;
  return Object.values(sources)
    .filter(Array.isArray)
    .flat()
    .filter((unit) => unit && typeof unit === "object" && ("translationStatus" in unit || "sourcePath" in unit));
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function exists(file) {
  return Boolean(await stat(file).catch(() => null));
}

export async function loadShelf(root = ROOT) {
  const shelf = await readJson(resolve(root, "bookshelf.json"));
  return {
    title: shelf.title ?? "书架",
    subtitle: shelf.subtitle ?? "",
    description: shelf.description ?? "",
    categories: Array.isArray(shelf.categories) ? shelf.categories : [],
    fallbackCategory: shelf.fallbackCategory ?? {
      id: "uncategorized",
      title: "未分类",
      description: "还没有声明分类的书。",
      accent: "#6b6862",
    },
  };
}

// A book is a directory holding book.json. Top-level books and books/ children are
// both accepted so the repository can grow a grouping folder without changing this code.
export async function discoverBooks(root = ROOT) {
  const candidates = [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    if (entry.name === "books") {
      const nested = await readdir(resolve(root, entry.name), { withFileTypes: true }).catch(() => []);
      for (const child of nested) {
        if (child.isDirectory()) candidates.push(resolve(root, entry.name, child.name));
      }
    } else {
      candidates.push(resolve(root, entry.name));
    }
  }

  const books = [];
  for (const dir of candidates) {
    const manifest = resolve(dir, "book.json");
    if (!(await exists(manifest))) continue;
    books.push(await readBook(dir));
  }
  return books;
}

async function readBook(dir) {
  const manifest = await readJson(resolve(dir, "book.json"));
  // The URL segment and the card identity are the directory name, not its path under books/.
  const slug = dir.split(sep).at(-1);
  const shelfMeta = manifest.shelf ?? {};
  const sources = await readJson(resolve(dir, "sources.json")).catch(() => null);
  const units = collectUnits(sources);
  const catalog = listCatalog(manifest);
  const catalogIds = new Set(catalog.filter((entry) => typeof entry === "string"));
  // Companion documents live in sources.json but not in the catalog, so count completion
  // against the catalog when the book has one; otherwise every unit is a chapter source.
  const scopedUnits = catalogIds.size > 0 ? units.filter((unit) => catalogIds.has(unit.id)) : units;
  const chapters = (manifest.parts ?? []).flatMap((part) => part.chapters ?? []);
  const siteDir = resolve(dir, "site");
  const built = await exists(resolve(siteDir, "index.html"));
  const startChapter = chapters[0]?.path?.replace(/\.md$/, ".html") ?? null;
  const lastUpdated = units
    .map((unit) => unit.translatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    slug,
    dir,
    siteDir,
    built,
    title: manifest.title ?? slug,
    subtitle: manifest.subtitle ?? "",
    blurb: shelfMeta.blurb ?? "",
    category: shelfMeta.category ?? null,
    tags: Array.isArray(shelfMeta.tags) ? shelfMeta.tags : [],
    order: Number.isFinite(shelfMeta.order) ? shelfMeta.order : 999,
    accent: shelfMeta.accent ?? null,
    parts: (manifest.parts ?? []).length,
    chapters: chapters.length,
    entries: catalog.length,
    complete: scopedUnits.filter((unit) => unit.translationStatus === "complete").length,
    commits: [...new Set(units.map((unit) => shortCommit(unit.commit)).filter(Boolean))],
    updated: lastUpdated,
    startPath: startChapter,
    catalogPath: catalog.length > 0 ? "catalog/index.html" : null,
  };
}

export function validateBooks(books, shelf) {
  const problems = [];
  const categoryIds = new Set(shelf.categories.map((category) => category.id));
  const slugs = new Set();
  const orders = new Map();

  for (const book of books) {
    if (slugs.has(book.slug)) problems.push(`重复的书籍目录: ${book.slug}`);
    slugs.add(book.slug);

    if (!book.category) {
      problems.push(`${book.slug}: 缺少 shelf.category，会落到「${shelf.fallbackCategory.title}」`);
    } else if (!categoryIds.has(book.category)) {
      problems.push(`${book.slug}: 未知分类 "${book.category}"，bookshelf.json 里没有它`);
    }

    if (!book.built) problems.push(`${book.slug}: 尚未构建 site/index.html，先在该目录跑 npm run build`);

    if (book.order !== 999) {
      const seen = orders.get(book.order) ?? [];
      seen.push(book.slug);
      orders.set(book.order, seen);
    }
  }

  for (const [order, members] of orders) {
    if (members.length > 1) problems.push(`shelf.order ${order} 被多本书使用: ${members.join(", ")}`);
  }

  return problems;
}

// Group books into the category order defined by bookshelf.json. Unknown or missing
// categories fall into the fallback bucket instead of disappearing.
export function groupBooks(books, shelf) {
  const categoryIds = new Set(shelf.categories.map((category) => category.id));
  const groups = shelf.categories.map((category) => ({ category, books: [] }));
  const fallback = { category: shelf.fallbackCategory, books: [] };

  for (const book of [...books].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh"))) {
    if (book.category && categoryIds.has(book.category)) {
      groups.find((group) => group.category.id === book.category).books.push(book);
    } else {
      fallback.books.push(book);
    }
  }

  return fallback.books.length > 0 ? [...groups, fallback] : groups;
}

function shade(hex, factor) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return "#5f2a1d";
  const value = parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * factor))),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function bookCard(book, category) {
  const accent = book.accent ?? category.accent ?? "#8a3f2d";
  const href = `/books/${book.slug}/`;
  const search = [book.title, book.subtitle, book.blurb, book.slug, ...book.tags].join(" ").toLowerCase();
  const stats = [
    book.chapters >= book.parts && book.chapters > 0 ? `${book.chapters} 章` : book.parts > 0 ? `${book.parts} 部` : null,
    book.entries > 0 ? `${book.entries} 个条目` : null,
    book.complete > 0
      ? book.entries > 0 && book.complete < book.entries
        ? `完成 ${book.complete}/${book.entries}`
        : `完成 ${book.complete}`
      : null,
    book.commits.length === 1 ? `commit ${book.commits[0]}` : book.commits.length > 1 ? `${book.commits.length} 个来源` : null,
  ].filter(Boolean);

  const actions = book.built
    ? `<a class="button" href="${esc(href)}">进入阅读</a>${
        book.catalogPath ? `<a class="button ghost" href="${esc(`${href}${book.catalogPath}`)}">知识全库</a>` : ""
      }`
    : `<span class="badge">尚未构建</span>`;

  const coverStyle = `--accent:${esc(accent)};--spine:${esc(shade(accent, 0.72))}`;
  const coverInner = `<span class="spine"></span>
      <span class="cover-title">${esc(book.title)}</span>`;
  const cover = book.built
    ? `<a class="cover" href="${esc(href)}" style="${coverStyle}" aria-label="进入《${esc(book.title)}》">${coverInner}</a>`
    : `<div class="cover unbuilt" style="${coverStyle}" aria-hidden="true">${coverInner}</div>`;

  return `<article class="book" data-category="${esc(category.id)}" data-search="${esc(search)}">
    ${cover}
    <div class="details">
      <h3>${book.built ? `<a href="${esc(href)}">${esc(book.title)}</a>` : esc(book.title)}</h3>
      ${book.subtitle ? `<p class="subtitle">${esc(book.subtitle)}</p>` : ""}
      ${book.blurb ? `<p class="blurb">${esc(book.blurb)}</p>` : ""}
      ${stats.length > 0 ? `<ul class="stats">${stats.map((stat) => `<li>${esc(stat)}</li>`).join("")}</ul>` : ""}
      <div class="actions">${actions}</div>
      ${book.tags.length > 0 ? `<ul class="tags">${book.tags.map((tag) => `<li>${esc(tag)}</li>`).join("")}</ul>` : ""}
    </div>
  </article>`;
}

export function renderShelf(shelf, books) {
  const groups = groupBooks(books, shelf);
  const totalEntries = books.reduce((n, book) => n + book.entries, 0);
  const built = books.filter((book) => book.built).length;

  const chips = [
    `<button class="chip" type="button" data-cat="all" aria-pressed="true">全部 <span>${books.length}</span></button>`,
    ...groups.map(
      (group) =>
        `<button class="chip" type="button" data-cat="${esc(group.category.id)}" aria-pressed="false">${esc(
          group.category.title,
        )} <span>${group.books.length}</span></button>`,
    ),
  ].join("");

  const sections = groups
    .map(
      (group) => `<section class="shelf" data-category="${esc(group.category.id)}">
      <header>
        <h2 style="--accent:${esc(group.category.accent ?? "#8a3f2d")}">${esc(group.category.title)}</h2>
        ${group.category.description ? `<p>${esc(group.category.description)}</p>` : ""}
      </header>
      ${
        group.books.length > 0
          ? `<div class="grid">${group.books.map((book) => bookCard(book, group.category)).join("")}</div>`
          : `<p class="empty-shelf">这个分类还空着。</p>`
      }
    </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(shelf.title)}</title>
<style>
:root{--bg:#fbfaf7;--paper:#fff;--ink:#22211f;--muted:#6b6862;--line:#ddd8ce;--accent:#8a3f2d;--soft:#f3eee5}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px}
.wrap{max-width:1120px;margin:0 auto;padding:56px 24px 96px}
.hero{border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:32px}
.hero h1{margin:0;font-size:40px;letter-spacing:.04em;line-height:1.2}
.hero .subtitle{margin:8px 0 0;font-size:18px;color:var(--muted)}
.hero .description{margin:12px 0 0;max-width:62ch;color:var(--muted)}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:0 0 28px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font:inherit;font-size:14px;padding:6px 14px;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--ink);cursor:pointer}
.chip span{color:var(--muted);font-variant-numeric:tabular-nums;margin-left:4px}
.chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.chip[aria-pressed="true"] span{color:#d9d4cb}
.chip:focus-visible,input:focus-visible,.button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.search{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:14px}
.search input{font:inherit;padding:8px 12px;min-width:240px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}
.shelf{margin:0 0 44px;padding-bottom:14px;border-bottom:6px solid #ece5d8;box-shadow:0 10px 18px -18px rgba(34,33,31,.55)}
.shelf header{margin:0 0 18px}
.shelf h2{margin:0;font-size:22px;letter-spacing:.02em;border-left:4px solid var(--accent);padding-left:10px}
.shelf header p{margin:6px 0 0 14px;color:var(--muted);font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:20px}
.book{display:grid;grid-template-columns:104px minmax(0,1fr);background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(34,33,31,.04)}
.cover{position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:18px 10px;background:linear-gradient(165deg,var(--accent),var(--spine));color:#fff;text-decoration:none}
.cover::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.16),transparent 55%)}
.spine{position:absolute;left:0;top:0;bottom:0;width:5px;background:rgba(0,0,0,.22)}
.cover.unbuilt{filter:saturate(.45);opacity:.8}
.cover-title{position:relative;z-index:1;font-size:14px;font-weight:600;line-height:1.5;letter-spacing:.05em;overflow-wrap:anywhere}
.cover-title::before,.cover-title::after{content:"";display:block;width:22px;height:1px;margin:7px auto;background:rgba(255,255,255,.55)}
.details{padding:16px 18px 14px}
.details h3{margin:0;font-size:17px;line-height:1.35}
.details h3 a{color:var(--ink);text-decoration:none}
.details h3 a:hover{text-decoration:underline}
.subtitle{margin:4px 0 0;font-size:13px;color:var(--muted)}
.blurb{margin:8px 0 0;font-size:14px;color:#3b3935}
.stats{display:flex;flex-wrap:wrap;gap:6px 10px;list-style:none;margin:10px 0 0;padding:0;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.stats li:not(:last-child)::after{content:"·";margin-left:10px;color:var(--line)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.button{font-size:13px;padding:5px 12px;border-radius:6px;background:var(--ink);color:#fff;text-decoration:none}
.button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.badge{font-size:12px;padding:4px 10px;border-radius:999px;background:var(--soft);color:var(--muted)}
.tags{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:10px 0 0;padding:0}
.tags li{font-size:11px;color:var(--muted);background:var(--soft);border-radius:4px;padding:2px 7px}
.empty-shelf{margin:0;padding:18px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:14px;text-align:center}
#empty{margin:32px 0;padding:28px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);text-align:center}
footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:space-between}
[hidden]{display:none!important}
@media (max-width:560px){
  .wrap{padding:32px 16px 64px}
  .hero h1{font-size:30px}
  .grid{grid-template-columns:1fr}
  .search input{min-width:0;width:100%}
  .search{width:100%}
}
</style>
</head>
<body>
<main class="wrap">
  <header class="hero">
    <h1>${esc(shelf.title)}</h1>
    ${shelf.subtitle ? `<p class="subtitle">${esc(shelf.subtitle)}</p>` : ""}
    ${shelf.description ? `<p class="description">${esc(shelf.description)}</p>` : ""}
  </header>

  <div class="toolbar">
    <div class="chips" role="group" aria-label="按分类过滤">${chips}</div>
    <label class="search">搜索<input id="q" type="search" placeholder="书名、主题、标签" autocomplete="off"></label>
  </div>

  ${sections}

  <p id="empty" hidden>没有匹配的书，换个关键词或分类试试。</p>

  <footer>
    <span>${books.length} 本书 · ${totalEntries} 个知识条目 · ${built} 本已构建</span>
    <span>新增一本书：建目录、写 <code>book.json</code>、在 <code>shelf.category</code> 里选一个分类。</span>
  </footer>
</main>
<script>
(function () {
  var input = document.getElementById("q");
  var empty = document.getElementById("empty");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".shelf"));
  var active = "all";

  function apply() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    sections.forEach(function (section) {
      var visible = 0;
      Array.prototype.forEach.call(section.querySelectorAll(".book"), function (card) {
        var ok = (active === "all" || card.dataset.category === active) && (!q || card.dataset.search.indexOf(q) !== -1);
        card.hidden = !ok;
        if (ok) visible += 1;
      });
      section.hidden = visible === 0;
      shown += visible;
    });
    empty.hidden = shown > 0;
  }

  input.addEventListener("input", apply);
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      active = chip.dataset.cat;
      chips.forEach(function (other) { other.setAttribute("aria-pressed", String(other === chip)); });
      apply();
    });
  });
})();
</script>
</body>
</html>`;
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-cache" });
  res.end(body);
}

function safeJoin(base, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = resolve(base, `.${decoded.startsWith("/") ? decoded : `/${decoded}`}`);
  const rel = relative(base, target);
  if (rel.startsWith("..") || rel.split(sep).includes("..")) return null;
  return target;
}

async function serveStatic(res, base, requestPath) {
  const target = safeJoin(base, requestPath);
  if (!target) return send(res, 403, "forbidden");
  const info = await stat(target).catch(() => null);
  const file = info?.isDirectory() ? `${target}/index.html` : target;
  const body = await readFile(file).catch(() => null);
  if (!body) return send(res, 404, "not found");
  send(res, 200, body, TYPES[extname(file)] ?? "application/octet-stream");
}

export async function startServer({ root = ROOT, port = 4180, host = DEFAULT_HOST } = {}) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? host}`);
    const pathname = url.pathname;

    if (pathname === "/" || pathname === "/index.html") {
      // Re-discover per request so a new book appears without restarting the server.
      try {
        const shelf = await loadShelf(root);
        const books = await discoverBooks(root);
        return send(response, 200, renderShelf(shelf, books), "text/html; charset=utf-8");
      } catch (error) {
        return send(response, 500, `bookshelf failed: ${error.message}`);
      }
    }

    if (pathname === "/api/books") {
      try {
        const books = await discoverBooks(root);
        return send(response, 200, JSON.stringify({ books }, null, 2), "application/json; charset=utf-8");
      } catch (error) {
        return send(response, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
      }
    }

    if (pathname.startsWith("/books/")) {
      const [slug, ...rest] = pathname.slice("/books/".length).split("/");
      const book = (await discoverBooks(root)).find((candidate) => candidate.slug === slug);
      if (!book) return send(response, 404, "book not found");
      if (rest.length === 0) {
        response.writeHead(302, { location: `/books/${slug}/` });
        return response.end();
      }
      return serveStatic(response, book.siteDir, `/${rest.join("/")}`);
    }

    if (pathname === "/favicon.ico") return send(response, 204, "");

    return send(response, 404, "not found");
  });

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolvePromise);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    host,
    port: actualPort,
    urls: displayUrls(host, actualPort),
    url: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actualPort}/`,
    close: () => new Promise((done) => server.close(done)),
  };
}

function parseArgs(argv = [], env = process.env) {
  let port = env.PORT ?? "4180";
  let host = env.HOST ?? DEFAULT_HOST;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") check = true;
    else if (argv[i] === "--port") port = argv[++i];
    else if (argv[i].startsWith("--port=")) port = argv[i].slice(7);
    else if (argv[i] === "--host") host = argv[++i];
    else if (argv[i].startsWith("--host=")) host = argv[i].slice(7);
  }
  const n = Number(port);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`端口无效: ${port}`);
  return { port: n, host, check };
}

async function main() {
  const { port, host, check } = parseArgs(process.argv.slice(2));
  const shelf = await loadShelf(ROOT);
  const books = await discoverBooks(ROOT);
  const problems = validateBooks(books, shelf);

  if (check) {
    console.log(`bookshelf: ${books.length} books, ${shelf.categories.length} categories`);
    for (const book of books) {
      const state = book.built ? "built" : "no site/index.html";
      console.log(`  ${book.slug} → ${book.category ?? "(uncategorized)"} · ${book.chapters} chapters · ${book.entries} entries · ${state}`);
    }
    for (const problem of problems) console.error(`problem: ${problem}`);
    console.log(`${problems.length} problem(s)`);
    if (problems.length > 0) process.exit(1);
    return;
  }

  for (const problem of problems) console.error(`warning: ${problem}`);

  const { urls } = await startServer({ root: ROOT, port, host });
  const [local, ...lan] = urls;
  console.log(`书架: ${local}`);
  for (const address of lan) console.log(`      局域网: ${address}`);
  for (const book of books) {
    console.log(`  ${book.title}: ${local}books/${book.slug}/${book.built ? "" : "  (尚未构建)"}`);
  }
  console.log(WILDCARD_HOSTS.has(host) ? "监听所有网卡；只给本机用请加 --host 127.0.0.1。按 Ctrl+C 停止。" : "按 Ctrl+C 停止。");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`端口 ${error.port ?? ""} 已被占用，换一个: npm start -- --port 4181`);
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });
}