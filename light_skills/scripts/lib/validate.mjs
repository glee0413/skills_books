import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import YAML from "yaml";
import { buildSite } from "./render.mjs";

const STATUSES = new Set(["todo", "draft", "complete", "needs-resync"]);
const INVOCATIONS = new Set(["user", "model", "unknown"]);

function issue(level, code, message, path) {
  return path ? { level, code, message, path } : { level, code, message };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, body: text, error: null };
  try {
    return { frontmatter: YAML.parse(match[1]) ?? {}, body: text.slice(match[0].length), error: null };
  } catch (error) {
    return { frontmatter: null, body: text.slice(match[0].length), error };
  }
}

function stripTranslatorNotes(text) {
  const output = [];
  let inNote = false;
  for (const line of text.split("\n")) {
    if (/^\s*>\s*译者注：/.test(line)) {
      inNote = true;
      continue;
    }
    if (inNote && /^\s*>/.test(line)) continue;
    inNote = false;
    output.push(line);
  }
  return output.join("\n");
}

function fromFirstH1(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^#\s+/.test(line));
  return start >= 0 ? lines.slice(start).join("\n") : text;
}

function stripFencedCode(text) {
  const output = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) output.push(line);
  }
  return output.join("\n");
}

function metrics(text) {
  let headings = 0;
  let fences = 0;
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fences += 1;
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^#{1,6}\s+/.test(line)) headings += 1;
  }
  return { headings, fences };
}

export function validateTranslationStructure(source, translation) {
  const sourceBody = fromFirstH1(splitFrontmatter(source).body);
  const translationBody = fromFirstH1(stripTranslatorNotes(splitFrontmatter(translation).body));
  const expected = metrics(sourceBody);
  const actual = metrics(translationBody);
  if (expected.headings !== actual.headings || expected.fences !== actual.fences) {
    return [
      issue(
        "error",
        "structure-mismatch",
        `标题数应为 ${expected.headings}，实际 ${actual.headings}；代码围栏数应为 ${expected.fences}，实际 ${actual.fences}`,
      ),
    ];
  }
  return [];
}

export function validateSources(sources) {
  const issues = [];
  if (!sources || !Array.isArray(sources.skills) || !Array.isArray(sources.documents)) {
    return [issue("error", "sources-shape", "sources.json 必须包含 skills 和 documents 数组")];
  }

  const all = [...sources.skills, ...sources.documents];
  const seen = new Set();
  for (const record of all) {
    for (const field of [
      "id",
      "project",
      "repo",
      "commit",
      "ref",
      "sourcePath",
      "snapshotPath",
      "sourceSha256",
      "sourceUrl",
      "license",
      "translationPath",
      "translationStatus",
    ]) {
      if (!record[field]) issues.push(issue("error", "missing-field", `${record.id ?? "?"} 缺少 ${field}`, record.id));
    }
    if (seen.has(record.id)) {
      issues.push(issue("error", "duplicate-id", `重复 ID: ${record.id}`, record.id));
    }
    seen.add(record.id);
    if (!STATUSES.has(record.translationStatus)) {
      issues.push(issue("error", "invalid-status", `非法状态: ${record.translationStatus}`, record.id));
    }
  }

  const skillIds = new Set(sources.skills.map((skill) => skill.id));
  for (const document of sources.documents) {
    if (!document.parentSkill) {
      issues.push(issue("error", "missing-parent", `${document.id} 缺少 parentSkill`, document.id));
    } else if (!skillIds.has(document.parentSkill)) {
      issues.push(issue("error", "unknown-parent", `${document.id} 的父技能不存在: ${document.parentSkill}`, document.id));
    }
  }

  return issues;
}

export function validateBook(book, sources) {
  const issues = [];
  if (!book || typeof book !== "object" || !book.catalog || typeof book.catalog !== "object") {
    return [issue("error", "book-shape", "book.json 必须包含 catalog")];
  }

  const entries = Object.values(book.catalog).flat();
  if (!entries.every((id) => typeof id === "string")) {
    issues.push(issue("error", "catalog-shape", "catalog 的每一项都必须是技能 ID"));
    return issues;
  }

  const seen = new Set();
  for (const id of entries) {
    if (seen.has(id)) issues.push(issue("error", "catalog-duplicate", `catalog 重复: ${id}`, id));
    seen.add(id);
  }

  for (const skill of sources.skills) {
    if (!seen.has(skill.id)) issues.push(issue("error", "catalog-missing", `catalog 缺少: ${skill.id}`, skill.id));
  }
  for (const id of seen) {
    if (!sources.skills.some((skill) => skill.id === id)) {
      issues.push(issue("error", "catalog-unknown", `catalog 含未知技能: ${id}`, id));
    }
  }

  for (const part of book.parts ?? []) {
    for (const chapter of part.chapters ?? []) {
      for (const id of chapter.skills ?? []) {
        if (!sources.skills.some((skill) => skill.id === id)) {
          issues.push(issue("error", "chapter-unknown-skill", `${chapter.id} 引用了未知技能: ${id}`, chapter.path));
        }
      }
    }
  }

  return issues;
}

export function validateTranslationPage({ page, sourceRecord, source }) {
  const issues = [];
  const parsed = splitFrontmatter(page);
  if (parsed.error) {
    return [issue("error", "frontmatter-parse", `frontmatter 解析失败: ${parsed.error.message}`, sourceRecord.id)];
  }
  if (!parsed.frontmatter) {
    return [issue("error", "missing-frontmatter", "译文缺少 YAML frontmatter", sourceRecord.id)];
  }

  const frontmatter = parsed.frontmatter;
  const expected = {
    id: sourceRecord.id,
    project: sourceRecord.project,
    sourceCommit: sourceRecord.commit,
    sourceRef: sourceRecord.ref,
    sourcePath: sourceRecord.sourcePath,
    snapshotPath: sourceRecord.snapshotPath,
    license: sourceRecord.license,
  };
  if (sourceRecord.parentSkill) expected.parentSkill = sourceRecord.parentSkill;
  for (const [key, value] of Object.entries(expected)) {
    if (frontmatter[key] !== value) {
      issues.push(
        issue(
          "error",
          "frontmatter-mismatch",
          `${key} 应为 ${value}，实际 ${frontmatter[key] ?? "(缺失)"}`,
          sourceRecord.id,
        ),
      );
    }
  }

  if (!frontmatter.title) {
    issues.push(issue("error", "missing-title", "译文缺少 title", sourceRecord.id));
  }
  if (!sourceRecord.parentSkill) {
    if (typeof frontmatter.description !== "string" || !frontmatter.description.trim()) {
      issues.push(issue("error", "missing-description", "译文缺少 description", sourceRecord.id));
    }
    if (!INVOCATIONS.has(frontmatter.invocation)) {
      issues.push(issue("error", "invalid-invocation", `invocation 必须是 user/model/unknown`, sourceRecord.id));
    }
  }
  if (!frontmatter.translatedAt) {
    issues.push(issue("error", "missing-translated-at", "译文缺少 translatedAt", sourceRecord.id));
  }

  if (typeof source === "string") {
    const sourceBody = splitFrontmatter(source).body;
    const translationBody = splitFrontmatter(page).body;
    const firstLine = translationBody.split("\n").find((line) => line.trim() !== "") ?? "";
    if (
      sourceRecord.project === "gstack" &&
      /^#\s+/m.test(sourceBody) &&
      !/^#\s+/.test(firstLine)
    ) {
      issues.push(issue("error", "missing-h1-start", "gstack 源文有 H1，译文必须从 H1 开始，不能包含通用前言", sourceRecord.id));
    }
    issues.push(...validateTranslationStructure(source, page));
  }

  return issues;
}

export function validateReleaseContent({ page, id }) {
  const issues = [];
  const body = splitFrontmatter(page).body.trim();
  if (!body) issues.push(issue("error", "empty-body", `${id} 的译文正文为空`, id));
  if (/\[待翻译\]|TODO:/.test(stripFencedCode(body))) {
    issues.push(issue("error", "placeholder", `${id} 仍含占位文本`, id));
  }
  return issues;
}

export async function validateSnapshots({ root, sources }) {
  const issues = [];
  for (const record of [...sources.skills, ...sources.documents]) {
    const path = join(root, record.snapshotPath);
    try {
      const bytes = await readFile(path);
      const actual = sha256(bytes);
      if (actual !== record.sourceSha256) {
        issues.push(
          issue("error", "snapshot-hash-mismatch", `快照哈希不匹配: ${record.snapshotPath}`, record.id),
        );
      }
    } catch {
      issues.push(issue("error", "snapshot-missing", `快照不存在: ${record.snapshotPath}`, record.id));
    }
  }
  return issues;
}

async function walkHtml(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walkHtml(full)));
    else if (entry.isFile() && entry.name.endsWith(".html")) output.push(full);
  }
  return output;
}

async function walkFiles(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walkFiles(full)));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

export async function compareDirectories(leftDir, rightDir) {
  const left = new Map(
    (await walkFiles(leftDir)).map((file) => [file.slice(leftDir.length + 1), file]),
  );
  const right = new Map(
    (await walkFiles(rightDir)).map((file) => [file.slice(rightDir.length + 1), file]),
  );
  for (const relativePath of left.keys()) {
    if (!right.has(relativePath)) return `committed site is missing ${relativePath}`;
    const [a, b] = await Promise.all([readFile(left.get(relativePath)), readFile(right.get(relativePath))]);
    if (!a.equals(b)) return `committed site is stale at ${relativePath}`;
  }
  for (const relativePath of right.keys()) {
    if (!left.has(relativePath)) return `committed site has an extra file ${relativePath}`;
  }
  return null;
}

export async function validateHtmlFreshness({ root, siteDir }) {
  const temp = await mkdtemp(join(tmpdir(), "skills-book-fresh-"));
  try {
    await buildSite({ root, outDir: temp });
    const difference = await compareDirectories(siteDir, temp);
    return difference ? [issue("error", "site-out-of-date", difference, "site/")] : [];
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function validateLinks({ siteDir }) {
  const issues = [];
  for (const file of await walkHtml(siteDir)) {
    const html = await readFile(file, "utf8");
    const relativeFile = file.slice(siteDir.length + 1);
    if (
      relativeFile !== "catalog/index.html" &&
      relativeFile.startsWith(`catalog${process.platform === "win32" ? "\\" : "/"}`) &&
      !html.includes('class="source-box"')
    ) {
      issues.push(issue("error", "missing-source-box", `页面缺少来源框: ${relativeFile}`, relativeFile));
    }

    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|data:|javascript:)/.test(href)) continue;
      if (href === "") continue;
      const [target, hash] = href.split("#");
      const decodedHash = hash ? decodeURIComponent(hash) : "";
      if (!target) {
        if (decodedHash && !html.includes(`id="${decodedHash}"`)) {
          issues.push(issue("error", "broken-anchor", `锚点不存在: ${href}`, relativeFile));
        }
        continue;
      }
      const absolute = resolve(dirname(file), decodeURIComponent(target));
      try {
        await stat(absolute);
      } catch {
        issues.push(issue("error", "broken-link", `链接目标不存在: ${href}`, relativeFile));
        continue;
      }
      if (decodedHash) {
        try {
          const targetHtml = await readFile(absolute, "utf8");
          if (!targetHtml.includes(`id="${decodedHash}"`)) {
            issues.push(issue("error", "broken-anchor", `锚点不存在: ${href}`, relativeFile));
          }
        } catch {
          // non-HTML targets do not need anchors
        }
      }
    }
  }
  return issues;
}

export async function loadProject(root) {
  const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
  const book = JSON.parse(await readFile(join(root, "book.json"), "utf8"));
  return { sources, book };
}

export function getStats(sources) {
  const all = [...sources.skills, ...sources.documents];
  return {
    skills: sources.skills.length,
    documents: sources.documents.length,
    byProject: all.reduce((acc, record) => {
      acc[record.project] = (acc[record.project] ?? 0) + 1;
      return acc;
    }, {}),
    byStatus: all.reduce((acc, record) => {
      acc[record.translationStatus] = (acc[record.translationStatus] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export async function validateProject({ root, mode = "draft" }) {
  const { sources, book } = await loadProject(root);
  const issues = [...validateSources(sources), ...validateBook(book, sources), ...(await validateSnapshots({ root, sources }))];

  for (const record of [...sources.skills, ...sources.documents]) {
    if (record.translationStatus === "todo") {
      if (mode === "release") {
        issues.push(issue("error", "not-complete", `${record.id} 尚未翻译`, record.id));
      }
      continue;
    }

    let page;
    try {
      page = await readFile(join(root, record.translationPath), "utf8");
    } catch {
      issues.push(issue("error", "page-missing", `译文页不存在: ${record.translationPath}`, record.id));
      continue;
    }

    let snapshot;
    try {
      snapshot = await readFile(join(root, record.snapshotPath), "utf8");
    } catch {
      issues.push(issue("error", "snapshot-missing", `快照不存在: ${record.snapshotPath}`, record.id));
      continue;
    }
    issues.push(...validateTranslationPage({ page, sourceRecord: record, source: snapshot }));

    if (mode === "release") {
      issues.push(...validateReleaseContent({ page, id: record.id }));
      if (record.translationStatus !== "complete") {
        issues.push(issue("error", "not-complete", `${record.id} 状态是 ${record.translationStatus}`, record.id));
      }
    }
  }

  const hasSite = await stat(join(root, "site", "index.html")).then(() => true).catch(() => false);
  if (hasSite) {
    issues.push(...(await validateLinks({ siteDir: join(root, "site") })));
    issues.push(...(await validateHtmlFreshness({ root, siteDir: join(root, "site") })));
  } else if (mode === "release") {
    issues.push(issue("error", "site-missing", "发布模式需要已构建的 site/index.html"));
  } else {
    issues.push(issue("warning", "site-missing-draft", "site/index.html 尚未生成，跳过 HTML 链接检查"));
  }

  return issues;
}

export async function checkSources({ root, upstream = false, upstreamRoots = null }) {
  const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
  const issues = [...(await validateSnapshots({ root, sources }))];
  if (!upstream) return issues;

  const roots = upstreamRoots ?? {
    gstack: resolve(root, "..", "opensrc", "gstack"),
    mattpocock: resolve(root, "..", "opensrc", "mattpocock_skills"),
  };
  for (const record of [...sources.skills, ...sources.documents]) {
    const path = join(roots[record.project], record.sourcePath);
    try {
      const bytes = await readFile(path);
      if (sha256(bytes) !== record.sourceSha256) {
        issues.push(issue("warning", "needs-resync", `上游已变化: ${record.id}`, record.id));
      }
    } catch {
      issues.push(issue("warning", "upstream-missing", `上游文件不存在，跳过: ${record.sourcePath}`, record.id));
    }
  }
  return issues;
}