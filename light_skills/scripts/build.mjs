import { resolve } from "node:path";
import { buildSite } from "./lib/render.mjs";

const root = process.cwd();
const outDir = resolve(root, "site");

const result = await buildSite({ root, outDir });
console.log(`built ${result.pages} page(s), skipped ${result.skipped} todo record(s), into ${outDir}`);
for (const warning of result.warnings) console.log(`warning: ${warning}`);