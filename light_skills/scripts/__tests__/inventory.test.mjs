import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { mergeTranslationState, scanInventory } from "../lib/inventory.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const roots = {
  gstackRoot: process.env.GSTACK_ROOT ?? join(repoRoot, "gstack"),
  mattRoot: process.env.MATT_ROOT ?? join(repoRoot, "mattpocock_skills"),
};
const hasUpstream = existsSync(join(roots.gstackRoot, "SKILL.md")) && existsSync(join(roots.mattRoot, "skills"));
const integration = { skip: !hasUpstream && "upstream checkouts are not present" };

test("扫描到 101 个技能和 22 篇附属文档", integration, async () => {
  const result = await scanInventory(roots);
  assert.equal(result.skills.length, 101);
  assert.equal(result.documents.length, 22);
  assert.equal(new Set(result.skills.map((s) => s.id)).size, 101);
});

test("gstack 根路由、OpenClaw 与 capy 变体都有稳定 ID", integration, async () => {
  const ids = new Set((await scanInventory(roots)).skills.map((s) => s.id));
  assert.ok(ids.has("gstack/gstack"));
  assert.ok(ids.has("gstack/office-hours"));
  assert.ok(ids.has("gstack/openclaw/office-hours"));
  assert.ok(ids.has("gstack/capy/gstack"));
  const result = await scanInventory(roots);
  assert.ok(!result.skills.some((skill) => skill.sourcePath.split("/").includes("test")));
});

test("mattpocock 技能和 tdd 附属文档映射正确", integration, async () => {
  const result = await scanInventory(roots);
  const ids = new Set(result.skills.map((s) => s.id));
  assert.ok(ids.has("mattpocock/tdd"));
  assert.ok(ids.has("mattpocock/grilling"));
  assert.equal(
    result.skills.find((s) => s.id === "mattpocock/tdd").translationPath,
    "catalog/mattpocock/tdd/SKILL.md",
  );
  assert.ok(result.documents.some((d) => d.id === "mattpocock/tdd/tests"));
  assert.ok(result.documents.some((d) => d.id === "mattpocock/tdd/mocking"));
});

test("快照路径由 ID 决定且不重复", integration, async () => {
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

test("sourceSha256 来自源文件字节", integration, async () => {
  const result = await scanInventory(roots);
  const record = result.skills.find((s) => s.id === "gstack/office-hours");
  const bytes = await readFile(`${roots.gstackRoot}/${record.sourcePath}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(record.sourceSha256, hash);
});

test("同步来源时保留翻译状态和日期", () => {
  const merged = mergeTranslationState(
    [
      { id: "a/b", translationStatus: "todo", translatedAt: null },
      { id: "a/c", translationStatus: "todo", translatedAt: null },
    ],
    [{ id: "a/b", translationStatus: "complete", translatedAt: "2026-10-29" }],
  );
  assert.equal(merged[0].translationStatus, "complete");
  assert.equal(merged[0].translatedAt, "2026-10-29");
  assert.equal(merged[1].translationStatus, "todo");
});