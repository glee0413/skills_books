import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sources = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
let marked = 0;
for (const unit of sources.units) {
  if (unit.translationStatus === "complete") continue;
  try {
    await readFile(join(root, unit.catalogPath), "utf8");
  } catch {
    continue;
  }
  unit.translationStatus = "complete";
  unit.translatedAt = "2026-10-31";
  marked += 1;
}
await writeFile(join(root, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8");
console.log(`marked ${marked} entries complete; ${sources.units.filter((u) => u.translationStatus !== "complete").length} remaining`);