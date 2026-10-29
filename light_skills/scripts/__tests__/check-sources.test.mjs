import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../serve.mjs";
import { checkSources } from "../lib/validate.mjs";

test("静态服务器能返回页面并阻止路径穿越", async () => {
  const root = await mkdtemp(join(tmpdir(), "skills-book-serve-"));
  await writeFile(join(root, "index.html"), "<h1>ok</h1>");
  const { server, url } = await startServer({ root, port: 0 });

  try {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /ok/);

    const traversal = await fetch(`${url}..%2F..%2Fetc%2Fpasswd`);
    assert.equal(traversal.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("快照哈希不匹配会被报告", async () => {
  const root = await mkdtemp(join(tmpdir(), "skills-book-sources-"));
  await mkdir(join(root, "source-snapshots"), { recursive: true });
  await writeFile(join(root, "source-snapshots", "a.md"), "hello");
  await writeFile(
    join(root, "sources.json"),
    JSON.stringify({
      schemaVersion: 1,
      skills: [
        {
          id: "a/b",
          project: "a",
          repo: "https://example.com/a",
          commit: "abc",
          ref: "v1",
          sourcePath: "a.md",
          snapshotPath: "source-snapshots/a.md",
          sourceSha256: "deadbeef",
          sourceUrl: "https://example.com/a/blob/abc/a.md",
          license: "MIT",
          translationPath: "catalog/a/b.md",
          translationStatus: "todo",
          translatedAt: null,
        },
      ],
      documents: [],
    }),
  );

  const issues = await checkSources({ root });
  assert.ok(issues.some((issue) => issue.code === "snapshot-hash-mismatch"));
});