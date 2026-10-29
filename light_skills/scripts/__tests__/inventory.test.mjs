import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { scanInventory } from "../lib/inventory.mjs";

const roots = {
  gstackRoot: "/home/agent/workspace/study/skills/gstack",
  mattRoot: "/home/agent/workspace/study/skills/mattpocock_skills",
};

test("扫描到 101 个技能和 22 篇附属文档", async () => {
  const result = await scanInventory(roots);
  assert.equal(result.skills.length, 101);
  assert.equal(result.documents.length, 22);
  assert.equal(new Set(result.skills.map((s) => s.id)).size, 101);
});

test("gstack 根路由、OpenClaw 与 capy 变体都有稳定 ID", async () => {
  const ids = new Set((await scanInventory(roots)).skills.map((s) => s.id));
  assert.ok(ids.has("gstack/gstack"));
  assert.ok(ids.has("gstack/office-hours"));
  assert.ok(ids.has("gstack/openclaw/office-hours"));
  assert.ok(ids.has("gstack/capy/gstack"));
  assert.ok(![...ids].some((id) => id.includes("/test/")));
});

test("mattpocock 技能和 tdd 附属文档映射正确", async () => {
  const result = await scanInventory(roots);
  const ids = new Set(result.skills.map((s) => s.id));
  assert.ok(ids.has("mattpocock/tdd"));
  assert.ok(ids.has("mattpocock/grilling"));
  assert.ok(result.documents.some((d) => d.id === "mattpocock/tdd/tests"));
  assert.ok(result.documents.some((d) => d.id === "mattpocock/tdd/mocking"));
});

test("快照路径由 ID 决定且不重复", async () => {
  const result = await scanInventory(roots);
  const paths = [...result.skills, ...result.documents].map((r) => r.snapshotPath);
  assert.equal(new Set(paths).size, 123);
  assert.equal(
    result.skills.find((s) => s.id === "gstack/office-hours").snapshotPath,
    "source-snapshots/gstack/office-hours/SKILL.md",
  );
  assert.equal(
    result.documents.find((d) => d.id === "mattpocock/tdd/tests").snapshotPath,
    "source-snapshots/mattpocock/tdd/tests.md",
  );
});

test("sourceSha256 来自源文件字节", async () => {
  const result = await scanInventory(roots);
  const record = result.skills.find((s) => s.id === "gstack/office-hours");
  const bytes = await readFile(`${roots.gstackRoot}/${record.sourcePath}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(record.sourceSha256, hash);
});