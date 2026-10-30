import { createHash } from "node:crypto";
import { readdir, readFile, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, basename } from "node:path";

const PROJECTS = {
  gstack: {
    repo: "https://github.com/garrytan/gstack",
    commit: "8d9501373b55897447ae30f1d281c4dbc8a1369e",
    ref: "v1.91.226.0",
    license: "MIT",
    rootKey: "gstackRoot",
  },
  mattpocock: {
    repo: "https://github.com/mattpocock/skills",
    commit: "5beb35b040e3de97e54fa9e386d7e42d15c295c2",
    ref: "v1.3.1-47-g5beb35b",
    license: "MIT",
    rootKey: "mattRoot",
  },
};

function toPosix(value) {
  return value.split("\\").join("/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function walkFiles(root, options = {}) {
  const results = [];
  const skipSegments = new Set([".git", "node_modules", ...(options.skipSegments ?? [])]);

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (skipSegments.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(toPosix(relative(root, full)));
      }
    }
  }

  await walk(root);
  return results.sort();
}

function gstackId(sourcePath) {
  if (sourcePath === "SKILL.md") return "gstack/gstack";
  const openclaw = sourcePath.match(/^openclaw\/skills\/gstack-openclaw-(.+)\/SKILL\.md$/);
  if (openclaw) return `gstack/openclaw/${openclaw[1]}`;
  if (sourcePath === "capy/skill/gstack/SKILL.md") return "gstack/capy/gstack";
  return `gstack/${basename(dirname(sourcePath))}`;
}

function mattId(sourcePath) {
  const match = sourcePath.match(/^skills\/[^/]+\/([^/]+)\/SKILL\.md$/);
  if (!match) throw new Error(`Unrecognized mattpocock SKILL.md path: ${sourcePath}`);
  return `mattpocock/${match[1]}`;
}

function skillTranslationPath(id) {
  const [project, ...rest] = id.split("/");
  return `catalog/${project}/${rest.join("/")}.md`;
}

function nestedSkillTranslationPath(id) {
  const [project, ...rest] = id.split("/");
  return `catalog/${project}/${rest.join("/")}/SKILL.md`;
}

function skillSnapshotPath(id) {
  const [project, ...rest] = id.split("/");
  return `source-snapshots/${project}/${rest.join("/")}/SKILL.md`;
}

function documentTranslationPath(id) {
  const [project, ...rest] = id.split("/");
  return `catalog/${project}/${rest.join("/")}.md`;
}

function documentSnapshotPath(id) {
  const [project, ...rest] = id.split("/");
  return `source-snapshots/${project}/${rest.join("/")}.md`;
}

function sourceUrl(project, sourcePath) {
  const meta = PROJECTS[project];
  return `${meta.repo}/blob/${meta.commit}/${sourcePath}`;
}

function baseRecord({ id, project, sourcePath, snapshotPath, sourceSha256, translationPath, notes }) {
  const meta = PROJECTS[project];
  return {
    id,
    project,
    repo: meta.repo,
    commit: meta.commit,
    ref: meta.ref,
    sourcePath,
    snapshotPath,
    sourceSha256,
    sourceUrl: sourceUrl(project, sourcePath),
    license: meta.license,
    translationPath,
    translationStatus: "todo",
    translatedAt: null,
    notes,
  };
}

export async function loadCompanionDocuments() {
  const url = new URL("../companion-docs.json", import.meta.url);
  const parsed = JSON.parse(await readFile(url, "utf8"));
  if (!Array.isArray(parsed.documents)) throw new Error("companion-docs.json must contain a documents array");
  return parsed.documents;
}

export async function scanInventory({ gstackRoot, mattRoot, documents } = {}) {
  if (!gstackRoot || !mattRoot) throw new Error("gstackRoot and mattRoot are required");

  const docList = documents ?? (await loadCompanionDocuments());
  const skills = [];

  for (const sourcePath of await walkFiles(gstackRoot, { skipSegments: ["test", "tests"] })) {
    const bytes = await readFile(join(gstackRoot, sourcePath));
    const id = gstackId(sourcePath);
    skills.push(
      baseRecord({
        id,
        project: "gstack",
        sourcePath,
        snapshotPath: skillSnapshotPath(id),
        sourceSha256: sha256(bytes),
        translationPath: skillTranslationPath(id),
        notes: "上游 SKILL.md 由模板生成；译文从第一个 H1 开始，通用运行时前言保留在英文快照中。",
      }),
    );
  }

  const mattSkillPaths = await walkFiles(join(mattRoot, "skills"));
  for (const relativePath of mattSkillPaths) {
    const sourcePath = `skills/${relativePath}`;
    const bytes = await readFile(join(mattRoot, sourcePath));
    const id = mattId(sourcePath);
    skills.push(
      baseRecord({
        id,
        project: "mattpocock",
        sourcePath,
        snapshotPath: skillSnapshotPath(id),
        sourceSha256: sha256(bytes),
        translationPath: skillTranslationPath(id),
        notes: null,
      }),
    );
  }

  const documentRecords = [];
  for (const doc of docList) {
    const sourcePath = toPosix(doc.path);
    const parentSkill = doc.skill;
    if (!skills.some((skill) => skill.id === parentSkill)) {
      throw new Error(`Companion document parent does not exist: ${parentSkill}`);
    }
    const bytes = await readFile(join(mattRoot, sourcePath));
    const id = `${parentSkill}/${doc.name}`;
    documentRecords.push({
      ...baseRecord({
        id,
        project: "mattpocock",
        sourcePath,
        snapshotPath: documentSnapshotPath(id),
        sourceSha256: sha256(bytes),
        translationPath: documentTranslationPath(id),
        notes: "父技能明确要求阅读的配套文档。",
      }),
      parentSkill,
    });
  }

  for (const document of documentRecords) {
    const parent = skills.find((skill) => skill.id === document.parentSkill);
    if (parent) parent.translationPath = nestedSkillTranslationPath(parent.id);
  }

  skills.sort((a, b) => a.id.localeCompare(b.id));
  documentRecords.sort((a, b) => a.id.localeCompare(b.id));

  if (new Set(skills.map((s) => s.id)).size !== skills.length) {
    throw new Error("Duplicate skill IDs found");
  }
  if (new Set(documentRecords.map((d) => d.id)).size !== documentRecords.length) {
    throw new Error("Duplicate document IDs found");
  }

  return { skills, documents: documentRecords };
}

export function mergeTranslationState(records, existingRecords) {
  const previous = new Map((existingRecords ?? []).map((record) => [record.id, record]));
  return records.map((record) => {
    const old = previous.get(record.id);
    if (!old) return record;
    return {
      ...record,
      translationStatus: old.translationStatus ?? record.translationStatus,
      translatedAt: old.translatedAt ?? record.translatedAt,
    };
  });
}

export async function writeInventory({ root, gstackRoot, mattRoot, skills, documents }) {
  let existing = null;
  try {
    existing = JSON.parse(await readFile(join(root, "sources.json"), "utf8"));
  } catch {
    existing = null;
  }

  const mergedSkills = mergeTranslationState(skills, existing?.skills);
  const mergedDocuments = mergeTranslationState(documents, existing?.documents);

  const roots = { gstack: gstackRoot, mattpocock: mattRoot };
  for (const record of [...mergedSkills, ...mergedDocuments]) {
    const sourceRoot = roots[record.project];
    const source = join(sourceRoot, record.sourcePath);
    const target = join(root, record.snapshotPath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }

  await writeFile(
    join(root, "sources.json"),
    `${JSON.stringify({ schemaVersion: 1, skills: mergedSkills, documents: mergedDocuments }, null, 2)}\n`,
    "utf8",
  );
}