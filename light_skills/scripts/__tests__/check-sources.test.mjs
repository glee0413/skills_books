import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseServeArgs, startServer } from "../serve.mjs";
import { checkSources } from "../lib/validate.mjs";

test("serve 参数支持 --port 和 --host", () => {
  assert.deepEqual(parseServeArgs(["--port", "8001"]), { port: 8001, host: "127.0.0.1" });
  assert.deepEqual(parseServeArgs(["--port=8002", "--host", "0.0.0.0"]), {
    port: 8002,
    host: "0.0.0.0",
  });
  assert.deepEqual(parseServeArgs([]), { port: 4173, host: "127.0.0.1" });
  assert.throws(() => parseServeArgs(["--port", "abc"]), /端口/);
});

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

test("上游文件变化会报告 needs-resync，上游缺失只警告", async () => {
  const root = await mkdtemp(join(tmpdir(), "skills-book-upstream-"));
  const upstream = await mkdtemp(join(tmpdir(), "skills-book-upstream-src-"));
  await mkdir(join(root, "source-snapshots"), { recursive: true });
  await writeFile(join(root, "source-snapshots", "a.md"), "hello");
  await writeFile(join(upstream, "a.md"), "changed");
  const hash = createHash("sha256").update("hello").digest("hex");
  await writeFile(
    join(root, "sources.json"),
    JSON.stringify({
      schemaVersion: 1,
      skills: [
        {
          id: "gstack/a",
          project: "gstack",
          repo: "https://example.com/a",
          commit: "abc",
          ref: "v1",
          sourcePath: "a.md",
          snapshotPath: "source-snapshots/a.md",
          sourceSha256: hash,
          sourceUrl: "https://example.com/a/blob/abc/a.md",
          license: "MIT",
          translationPath: "catalog/gstack/a.md",
          translationStatus: "todo",
          translatedAt: null,
        },
      ],
      documents: [],
    }),
  );

  const changed = await checkSources({
    root,
    upstream: true,
    upstreamRoots: { gstack: upstream, mattpocock: upstream },
  });
  assert.ok(changed.some((issue) => issue.code === "needs-resync"));

  const missing = await checkSources({
    root,
    upstream: true,
    upstreamRoots: { gstack: join(root, "missing"), mattpocock: join(root, "missing") },
  });
  assert.ok(missing.some((issue) => issue.code === "upstream-missing"));
});