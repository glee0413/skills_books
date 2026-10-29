import { readFile, writeFile } from "node:fs/promises";

const PARTS = [
  { id: "00-intro", title: "导读", chapters: [] },
  { id: "01-two-paradigms", title: "第一部 两种范式", chapters: [] },
  { id: "02-think", title: "第二部 想清楚", chapters: [] },
  { id: "03-plan", title: "第三部 规划", chapters: [] },
  { id: "04-build", title: "第四部 构建", chapters: [] },
  { id: "05-review", title: "第五部 审查", chapters: [] },
  { id: "06-test", title: "第六部 测试", chapters: [] },
  { id: "07-ship", title: "第七部 交付", chapters: [] },
  { id: "08-reflect", title: "第八部 反思与运营", chapters: [] },
];

const sources = JSON.parse(await readFile("sources.json", "utf8"));

let existing = null;
try {
  existing = JSON.parse(await readFile("book.json", "utf8"));
} catch {
  existing = null;
}

const book = {
  title: existing?.title ?? "Skills Book",
  subtitle: existing?.subtitle ?? "从两个开源项目学习 agent 工作流",
  parts: existing?.parts ?? PARTS,
  catalog: {
    gstack: sources.skills
      .filter((skill) => skill.project === "gstack")
      .map((skill) => skill.id)
      .sort(),
    mattpocock: sources.skills
      .filter((skill) => skill.project === "mattpocock")
      .map((skill) => skill.id)
      .sort(),
  },
};

await writeFile("book.json", `${JSON.stringify(book, null, 2)}\n`, "utf8");
console.log(`book.json: ${book.catalog.gstack.length} gstack, ${book.catalog.mattpocock.length} mattpocock`);