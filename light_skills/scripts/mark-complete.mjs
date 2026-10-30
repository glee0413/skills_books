import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateTranslationPage } from "./lib/validate.mjs";

const root = process.cwd();
const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
let marked = 0;
let failed = 0;

for (const record of [...sources.skills, ...sources.documents]) {
  if (record.translationStatus === "complete") continue;
  let page;
  try {
    page = await readFile(join(root, record.translationPath), "utf8");
  } catch {
    continue;
  }
  let source;
  try {
    source = await readFile(join(root, record.snapshotPath), "utf8");
  } catch {
    continue;
  }
  const issues = validateTranslationPage({ page, sourceRecord: record, source });
  const errors = issues.filter((item) => item.level === "error");
  if (errors.length) {
    failed += 1;
    console.error(`skip ${record.id}: ${errors.map((item) => item.code).join(", ")}`);
    continue;
  }
  record.translationStatus = "complete";
  record.translatedAt = "2026-10-30";
  marked += 1;
}

await writeFile(join(root, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8");
const remaining = [...sources.skills, ...sources.documents].filter((item) => item.translationStatus !== "complete");
console.log(`marked ${marked} page(s) complete; ${failed} page(s) failed validation; ${remaining.length} remaining`);