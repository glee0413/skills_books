import { resolve } from "node:path";
import { scanInventory, writeInventory } from "./lib/inventory.mjs";

const root = process.cwd();
const gstackRoot = process.env.GSTACK_ROOT ?? resolve(root, "..", "opensrc", "gstack");
const mattRoot = process.env.MATT_ROOT ?? resolve(root, "..", "opensrc", "mattpocock_skills");

const result = await scanInventory({ gstackRoot, mattRoot });
await writeInventory({ root, gstackRoot, mattRoot, ...result });

console.log(
  `${result.skills.length} skills, ${result.documents.length} documents, ${result.skills.length + result.documents.length} snapshots`,
);