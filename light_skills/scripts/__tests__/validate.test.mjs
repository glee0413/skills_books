import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSources,
  validateBook,
  validateTranslationStructure,
  validateTranslationPage,
} from "../lib/validate.mjs";

test("重复 ID 会失败", () => {
  const issues = validateSources({
    skills: [
      { id: "a/b", project: "a", sourcePath: "x", snapshotPath: "y", translationStatus: "todo" },
      { id: "a/b", project: "a", sourcePath: "x2", snapshotPath: "y2", translationStatus: "todo" },
    ],
    documents: [],
  });
  assert.ok(issues.some((i) => i.code === "duplicate-id"));
});

test("catalog 缺技能或重复会失败", () => {
  const issues = validateBook(
    { catalog: { gstack: ["gstack/a"], mattpocock: ["gstack/a"] } },
    { skills: [{ id: "gstack/a" }, { id: "mattpocock/b" }], documents: [] },
  );
  assert.ok(issues.some((i) => i.code === "catalog-missing"));
  assert.ok(issues.some((i) => i.code === "catalog-duplicate"));
});

test("译文标题数或代码块数不一致会失败", () => {
  const source = "# A\n\n## B\n\n```sh\necho hi\n```\n";
  const translation = "# A\n\n## B\n\n```sh\necho 你好\n```\n\n## C\n";
  const issues = validateTranslationStructure(source, translation);
  assert.ok(issues.some((i) => i.code === "structure-mismatch"));
});

test("译者注不参与结构计数", () => {
  const source = "# A\n\n```sh\necho hi\n```\n";
  const translation = "# A\n\n> 译者注：这里解释背景。\n\n```sh\necho 你好\n```\n";
  const issues = validateTranslationStructure(source, translation);
  assert.equal(issues.filter((i) => i.code === "structure-mismatch").length, 0);
});

test("源文有 H1 时，只比较 H1 之后的技能正文", () => {
  const source = "## Generic preamble\n\n```sh\npreamble\n```\n\n# Skill\n\n## Body\n\n```sh\necho hi\n```\n";
  const translation = "# Skill\n\n## 正文\n\n```sh\necho 你好\n```\n";
  const issues = validateTranslationStructure(source, translation);
  assert.equal(issues.filter((i) => i.code === "structure-mismatch").length, 0);
});

test("附属文档不需要 description 和 invocation", () => {
  const page = `---\nid: a/b/doc\ntitle: doc\nproject: a\nsourceCommit: abc\nsourceRef: v1\nsourcePath: doc.md\nsnapshotPath: doc.md\nlicense: MIT\ntranslatedAt: 2026-10-29\nparentSkill: a/b\n---\n\n# A\n`;
  const issues = validateTranslationPage({
    page,
    sourceRecord: {
      id: "a/b/doc",
      parentSkill: "a/b",
      project: "a",
      commit: "abc",
      ref: "v1",
      sourcePath: "doc.md",
      snapshotPath: "doc.md",
      license: "MIT",
    },
    source: "# A\n",
  });
  assert.equal(issues.filter((i) => i.level === "error").length, 0);
});

test("frontmatter 与来源不一致会失败", () => {
  const page = `---\nid: a/b\nproject: a\nsourceCommit: old\nsourceRef: v1\nsourcePath: x\nsnapshotPath: y\nlicense: MIT\ntranslatedAt: 2026-10-29\ndescription: 说明\ninvocation: model\n---\n\n# A\n`;
  const issues = validateTranslationPage({
    page,
    sourceRecord: {
      id: "a/b",
      project: "a",
      commit: "new",
      ref: "v2",
      sourcePath: "x",
      snapshotPath: "y",
      license: "MIT",
    },
    source: "# A\n",
  });
  assert.ok(issues.some((i) => i.code === "frontmatter-mismatch"));
});