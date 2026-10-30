import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateTranslationPage } from "./lib/validate.mjs";

const id = process.argv[2];
if (!id) {
  console.error("用法: node scripts/check-page.mjs <skill-id>");
  process.exit(2);
}

const root = process.cwd();
const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
const record = [...sources.skills, ...sources.documents].find((item) => item.id === id);
if (!record) {
  console.error(`unknown id: ${id}`);
  process.exit(2);
}

let page;
try {
  page = await readFile(join(root, record.translationPath), "utf8");
} catch {
  console.error(`page-missing: ${record.translationPath}`);
  process.exit(1);
}
const source = await readFile(join(root, record.snapshotPath), "utf8");
const issues = validateTranslationPage({ page, sourceRecord: record, source });
for (const item of issues) console.error(`${item.level}: ${item.code}: ${item.message}`);
if (issues.some((item) => item.level === "error")) process.exit(1);
console.log(`ok: ${id}`);