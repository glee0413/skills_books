import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
const book = JSON.parse(await readFile(join(root, "book.json"), "utf8"));
const units = sources.units;
const issues = [];
const ids = new Set(units.map((unit) => unit.id));

for (const unit of units) {
  const snapshot = await readFile(join(root, unit.snapshotPath)).catch(() => null);
  if (!snapshot) {
    issues.push(`${unit.id}: snapshot missing`);
  } else {
    const hash = createHash("sha256").update(snapshot).digest("hex");
    if (hash !== unit.sourceSha256) issues.push(`${unit.id}: snapshot hash mismatch`);
  }
  if (unit.translationStatus === "todo") continue;
  const page = await readFile(join(root, unit.catalogPath), "utf8").catch(() => null);
  if (!page) {
    issues.push(`${unit.id}: catalog page missing`);
    continue;
  }
  const fm = page.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) issues.push(`${unit.id}: missing frontmatter`);
}

const catalogIds = Object.values(book.catalog).flat();
if (new Set(catalogIds).size !== catalogIds.length) issues.push("catalog has duplicate IDs");
for (const id of ids) if (!catalogIds.includes(id)) issues.push(`catalog missing ${id}`);
for (const id of catalogIds) if (!ids.has(id)) issues.push(`catalog has unknown ${id}`);

for (const part of book.parts) {
  for (const chapter of part.chapters) {
    const page = await stat(join(root, chapter.path)).catch(() => null);
    if (!page?.isFile()) issues.push(`chapter missing: ${chapter.path}`);
    for (const id of chapter.sources ?? []) if (!ids.has(id)) issues.push(`chapter ${chapter.id} has unknown source ${id}`);
  }
}

const siteIndex = await stat(join(root, "site", "index.html")).catch(() => null);
if (!siteIndex?.isFile()) issues.push("site/index.html missing; run npm run build");

async function walkHtml(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walkHtml(full)));
    else if (entry.isFile() && entry.name.endsWith(".html")) output.push(full);
  }
  return output;
}

if (siteIndex?.isFile()) {
  const siteDir = join(root, "site");
  for (const file of await walkHtml(siteDir)) {
    const html = await readFile(file, "utf8");
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|data:|javascript:)/.test(href) || href === "") continue;
      const [target, hash] = href.split("#");
      const decodedHash = hash ? decodeURIComponent(hash) : "";
      if (!target) {
        if (decodedHash && !html.includes(`id="${decodedHash}"`)) issues.push(`broken anchor ${href} in ${file.slice(siteDir.length + 1)}`);
        continue;
      }
      const absolute = resolve(dirname(file), decodeURIComponent(target));
      const info = await stat(absolute).catch(() => null);
      if (!info) {
        issues.push(`broken link ${href} in ${file.slice(siteDir.length + 1)}`);
        continue;
      }
      if (decodedHash) {
        const targetHtml = await readFile(absolute, "utf8").catch(() => "");
        if (targetHtml && !targetHtml.includes(`id="${decodedHash}"`)) issues.push(`broken anchor ${href} in ${file.slice(siteDir.length + 1)}`);
      }
    }
  }
}

for (const issue of issues) console.error(`error: ${issue}`);
console.log(`${issues.length} issue(s); ${units.length} source entries; ${catalogIds.length} catalog entries`);
process.exit(issues.length ? 1 : 0);