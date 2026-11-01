import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  discoverBooks,
  groupBooks,
  loadShelf,
  renderShelf,
  startServer,
  validateBooks,
} from "../shelf.mjs";

let root;

async function writeJson(file, value) {
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function makeBook(dir, { title, shelf, chapters = 2, entries = 3, built = true }) {
  const parts = [
    {
      id: "intro",
      title: "导读",
      chapters: Array.from({ length: chapters }, (_, index) => ({ id: `c${index}`, path: `book/intro/${index}.md` })),
    },
  ];
  const catalog = { demo: Array.from({ length: entries }, (_, index) => `demo/e${index}`) };
  await writeJson(join(dir, "book.json"), { title, subtitle: "副标题", ...(shelf ? { shelf } : {}), parts, catalog });
  await writeJson(join(dir, "sources.json"), {
    units: [
      { id: "demo/e0", translationStatus: "complete", commit: "0123456789abcdef", translatedAt: "2026-10-31" },
      { id: "demo/e1", translationStatus: "todo", commit: "0123456789abcdef", translatedAt: null },
    ],
  });
  if (built) {
    await mkdir(join(dir, "site"), { recursive: true });
    await writeFile(join(dir, "site", "index.html"), "<!doctype html><title>book</title>");
  }
}

before(async () => {
  root = await mkdtemp(join(tmpdir(), "bookshelf-"));
  await writeJson(join(root, "bookshelf.json"), {
    title: "测试书架",
    subtitle: "副标题",
    description: "说明",
    categories: [
      { id: "alpha", title: "甲类", description: "第一类", accent: "#3f5d8a" },
      { id: "beta", title: "乙类", description: "第二类", accent: "#8a3f2d" },
    ],
    fallbackCategory: { id: "uncategorized", title: "未分类", description: "兜底", accent: "#6b6862" },
  });
  await makeBook(join(root, "book-a"), {
    title: "第一本",
    shelf: { category: "alpha", blurb: "关于甲", tags: ["Rust"], order: 2 },
  });
  await makeBook(join(root, "book-b"), {
    title: "第二本",
    shelf: { category: "beta", order: 1 },
  });
  await makeBook(join(root, "books", "book-c"), { title: "第三本", shelf: { category: "alpha", order: 3 } });
  await makeBook(join(root, "book-d"), { title: "没分类的书", built: false });
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("discoverBooks", () => {
  it("finds top-level and books/ children, skipping directories without book.json", async () => {
    await mkdir(join(root, "not-a-book"), { recursive: true });
    const books = await discoverBooks(root);
    assert.deepEqual(
      books.map((book) => book.slug).sort(),
      ["book-a", "book-b", "book-c", "book-d"],
    );
  });

  it("reads shelf metadata, stats and the pinned commit", async () => {
    const books = await discoverBooks(root);
    const first = books.find((book) => book.slug === "book-a");
    assert.equal(first.title, "第一本");
    assert.equal(first.category, "alpha");
    assert.equal(first.chapters, 2);
    assert.equal(first.parts, 1);
    assert.equal(first.entries, 3);
    assert.equal(first.complete, 1);
    assert.deepEqual(first.commits, ["0123456"]);
    assert.equal(first.updated, "2026-10-31");
    assert.equal(first.built, true);
    assert.equal(first.startPath, "book/intro/0.html");
  });

  it("marks a book without site/index.html as not built", async () => {
    const books = await discoverBooks(root);
    assert.equal(books.find((book) => book.slug === "book-d").built, false);
  });
});

describe("validateBooks", () => {
  it("reports unbuilt books and missing categories, but still lists them", async () => {
    const shelf = await loadShelf(root);
    const books = await discoverBooks(root);
    const problems = validateBooks(books, shelf);
    assert.ok(problems.some((problem) => problem.includes("book-d") && problem.includes("尚未构建")));
    assert.ok(problems.some((problem) => problem.includes("book-d") && problem.includes("shelf.category")));
  });

  it("reports unknown categories and duplicate order values", async () => {
    const shelf = await loadShelf(root);
    const books = await discoverBooks(root);
    books.find((book) => book.slug === "book-a").category = "nope";
    books.find((book) => book.slug === "book-b").order = 2;
    const problems = validateBooks(books, shelf);
    assert.ok(problems.some((problem) => problem.includes('未知分类 "nope"')));
    assert.ok(problems.some((problem) => problem.includes("shelf.order 2")));
  });
});

describe("groupBooks", () => {
  it("keeps the category order from bookshelf.json and sorts books by order", async () => {
    const shelf = await loadShelf(root);
    const books = await discoverBooks(root);
    const groups = groupBooks(books, shelf);
    assert.deepEqual(groups.map((group) => group.category.id), ["alpha", "beta", "uncategorized"]);
    assert.deepEqual(groups[0].books.map((book) => book.slug), ["book-a", "book-c"]);
    assert.deepEqual(groups[2].books.map((book) => book.slug), ["book-d"]);
  });
});

describe("renderShelf", () => {
  it("renders every book, its category and the fallback bucket", async () => {
    const shelf = await loadShelf(root);
    const books = await discoverBooks(root);
    const html = renderShelf(shelf, books);
    for (const title of ["第一本", "第二本", "第三本", "没分类的书"]) {
      assert.ok(html.includes(title), `missing ${title}`);
    }
    assert.ok(html.includes("甲类"));
    assert.ok(html.includes("未分类"));
    assert.ok(html.includes("/books/book-a/"));
    assert.ok(html.includes("尚未构建"));
    assert.ok(html.includes("4 本书"));
  });

  it("escapes user-controlled metadata", async () => {
    const shelf = await loadShelf(root);
    const books = await discoverBooks(root);
    books[0].title = '<script>alert(1)</script>';
    const html = renderShelf(shelf, books);
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });
});

describe("startServer", () => {
  it("serves the shelf, mounts each book and refuses traversal", async () => {
    const { url, close } = await startServer({ root, port: 0 });
    try {
      const home = await fetch(url);
      assert.equal(home.status, 200);
      assert.match(await home.text(), /测试书架/);

      const book = await fetch(`${url}books/book-a/`);
      assert.equal(book.status, 200);
      assert.equal(await book.text(), "<!doctype html><title>book</title>");

      const missing = await fetch(`${url}books/nope/`);
      assert.equal(missing.status, 404);

      const api = await fetch(`${url}api/books`);
      assert.equal(api.status, 200);
      const body = await api.json();
      assert.equal(body.books.length, 4);

      const traversal = await fetch(`${url}books/book-a/%2e%2e/%2e%2e/etc/passwd`);
      assert.ok([403, 404].includes(traversal.status), `unexpected status ${traversal.status}`);
    } finally {
      await close();
    }
  });
});