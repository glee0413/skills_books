# Skills Book 基础工程与试点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初始化根目录 git，搭好 Markdown/HTML 双格式的 Skills Book 工程，并交付由 `gstack/office-hours`、`mattpocock/grilling`、`mattpocock/tdd` 和两篇 tdd 附属文档组成的第一份试点学习资料。

**Architecture:** 根目录是书仓库，`light_skills/` 是产物目录。`sources.json` 记录 101 个技能和 22 篇附属文档的来源，`source-snapshots/` 保存对应英文原文，`book.json` 记录目录与技能归属。`scripts/` 用 Node 标准库加三个小依赖完成扫描、校验、构建和本地预览。第一份试点只翻译 3 个技能和 2 篇附属文档，验证译名、版式和来源框后再进入全量翻译。

**Tech Stack:** Node.js 20+，`marked`、`yaml`、`github-slugger`，Node 内置 `node:test`，原生 HTML/CSS。

**Spec:** `docs/superpowers/specs/2026-10-29-skills-book-design.md`

## Global Constraints

- 翻译范围固定为 101 个非测试 `SKILL.md` 加 22 篇 mattpocock 同目录必读文档，合计 123 篇。本计划只完成其中 5 篇（3 个技能 + 2 篇附属文档）。
- 上游固定版本：gstack `8d9501373b55897447ae30f1d281c4dbc8a1369e` / `v1.91.226.0`；mattpocock `5beb35b040e3de97e54fa9e386d7e42d15c295c2` / `v1.3.1-47-g5beb35b`。
- `gstack/` 和 `mattpocock_skills/` 是只读来源，必须被根仓库忽略；英文快照必须提交到 `light_skills/source-snapshots/`。
- 依赖只允许 `marked`、`yaml`、`github-slugger`；不引入静态站点框架。
- 构建和校验不访问网络。来源链接只校验格式，不校验 HTTP 可达性。
- 从 Task 5 起，每个 commit 必须通过 `npm run check`；Task 1-4 是脚手架，各自用任务里写的命令验证。本计划结束时 `npm run check` 通过，但不运行 `npm run check:release`，因为全书尚未翻译完。
- 提交说明和 `CHANGELOG.md` 使用中文，写清“改了什么、来源、原因、验证命令”。
- 译者注只允许 `> 译者注：` 引用块，且不得包含标题或代码围栏；结构校验忽略这些块。
- 原文 frontmatter 保存在英文快照里；译文页只显示翻译后的 `description`、`invocation`、来源和许可证。
- gstack 译文从第一个 H1 开始，H1 之前的通用运行时前言不翻译，保留在英文快照中。
- 技能 ID 一经生成不再改名；改标题不改 ID。

## Review Focus

这些是试点最可能出问题、但没有单独任务覆盖的输入类，测试分别放在对应任务里。

1. **gstack 变体和根路由的 ID 冲突。** `gstack/gstack`、`gstack/openclaw/office-hours`、`gstack/capy/gstack` 必须互不覆盖，且测试 fixture 不得进入清单。测试在 Task 3。
2. **快照与来源哈希不一致。** 复制快照时漏文件或改了换行，都会让“来源可追溯”变成假话。测试在 Task 3 和 Task 5。
3. **长文翻译漏段。** `office-hours` 有 1346 行，人工检查不可靠。标题数、代码块数对照必须自动失败。测试在 Task 5。
4. **嵌套目录的相对链接和中文锚点。** `catalog/gstack/office-hours.html` 链接到 `source-snapshots/` 和章节时容易多一层或少一层。测试在 Task 6。
5. **未翻译技能在目录里变成死链。** 全书 101 个技能只有 3 个完成，其余必须显示为不可点击的“待翻译”。测试在 Task 6。

---

## File Structure

创建或修改的文件：

```text
/
  .gitignore
  AGENTS.md                                  # 重写为书仓库贡献指南
  docs/superpowers/
    specs/2026-10-29-skills-book-design.md   # 已存在
    plans/2026-10-29-skills-book-foundation-and-pilot.md
  light_skills/
    package.json
    package-lock.json
    README.md
    CHANGELOG.md
    GLOSSARY.md
    TRANSLATION.md
    NOTICE.md
    book.json
    sources.json
    scripts/
      companion-docs.json
      scan-sources.mjs
      seed-book.mjs
      build.mjs
      check.mjs
      serve.mjs
      lib/inventory.mjs
      lib/validate.mjs
      lib/render.mjs
      __tests__/inventory.test.mjs
      __tests__/validate.test.mjs
      __tests__/render.test.mjs
      __tests__/check-sources.test.mjs
    book/
      00-intro/README.md
      01-two-paradigms/README.md
      02-think/05-product-questioning.md
      03-plan/README.md
      04-build/README.md
      05-review/README.md
      06-test/README.md
      07-ship/README.md
      08-reflect/README.md
    catalog/
      gstack/office-hours.md
      mattpocock/grilling.md
      mattpocock/tdd.md
      mattpocock/tdd/tests.md
      mattpocock/tdd/mocking.md
    source-snapshots/                        # 123 份英文原文
    third-party/
      gstack-LICENSE
      mattpocock-skills-LICENSE
    site/                                    # 生成的 HTML，提交；含 site/source-snapshots/
```

职责边界：

- `scripts/lib/inventory.mjs` 只负责扫描来源、生成 ID、计算哈希、复制快照。
- `scripts/lib/validate.mjs` 只负责校验，不生成 HTML。
- `scripts/lib/render.mjs` 只负责 Markdown 到 HTML 的渲染和页面布局。
- `scripts/build.mjs` 负责把 `book.json`、`sources.json` 和 Markdown 组装成 `site/`。
- `scripts/check.mjs` 负责命令行入口、模式选择、错误汇总。
- 每个翻译页只负责一篇原文，不写目录逻辑。

---

### Task 1: 初始化 git 与仓库护栏

**Files:**
- Create: `.gitignore`
- Modify: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-10-29-skills-book-foundation-and-pilot.md`（本文件）

**Interfaces:**
- Consumes: 已确认的设计文档。
- Produces: 一个只跟踪书稿、不跟踪两个上游仓库的 git 仓库。

- [ ] **Step 1: 初始化仓库**

Run:
```bash
cd /home/agent/workspace/study/skills
git init -b main
```

Expected: `Initialized empty Git repository in /home/agent/workspace/study/skills/.git/`。

- [ ] **Step 2: 写 `.gitignore`**

内容：
```gitignore
/gstack/
/mattpocock_skills/
/light_skills/node_modules/
.DS_Store
```

- [ ] **Step 3: 重写根 `AGENTS.md` 为书仓库贡献指南**

必须包含：
- 本书的目标和产物位置。
- `gstack/`、`mattpocock_skills/` 是只读来源，固定 commit 见 `light_skills/sources.json`。
- 日常命令：`cd light_skills && npm ci && npm run check`、`npm run build`、`npm run serve`。
- 提交规则：中文说明，工程建立后每个 commit 通过 `npm run check`，不把无关改动混在一起。
- 译者注规则和来源快照规则。
- 指向设计文档和本计划。

- [ ] **Step 4: 验证上游被忽略**

Run:
```bash
git check-ignore -v gstack mattpocock_skills light_skills/node_modules
git status --short
```

Expected: 前三条都输出匹配的 `.gitignore` 规则；`git status --short` 不出现 `gstack/` 或 `mattpocock_skills/` 下的文件。

- [ ] **Step 5: 提交**

```bash
git add .gitignore AGENTS.md docs/superpowers/
git commit -m "chore: 初始化 Skills Book 仓库" \
  -m "来源：gstack 8d95013、mattpocock 5beb35b 的只读 checkout。" \
  -m "原因：为书稿建立独立 git，把两个上游仓库排除在索引之外。" \
  -m "验证：git check-ignore 与 git status。"
```

---

### Task 2: 搭建 `light_skills` 工程骨架

**Files:**
- Create: `light_skills/package.json`
- Create: `light_skills/package-lock.json`
- Create: `light_skills/README.md`
- Create: `light_skills/book/**/README.md` 占位
- Create: `light_skills/catalog/.gitkeep`
- Create: `light_skills/source-snapshots/.gitkeep`
- Create: `light_skills/site/.gitkeep`

**Interfaces:**
- Consumes: Task 1 的仓库。
- Produces: `npm run build`、`npm run check`、`npm run check:release`、`npm run check:sources`、`npm run stats`、`npm run serve` 的脚本入口，后续任务逐个实现。

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "skills-book",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "node scripts/build.mjs",
    "check": "node --test scripts/__tests__/*.test.mjs && node scripts/check.mjs",
    "check:release": "node --test scripts/__tests__/*.test.mjs && node scripts/check.mjs --release",
    "check:sources": "node scripts/check.mjs --sources",
    "stats": "node scripts/check.mjs --stats",
    "serve": "node scripts/serve.mjs"
  },
  "dependencies": {
    "github-slugger": "^2.0.0",
    "marked": "^15.0.0",
    "yaml": "^2.6.0"
  }
}
```

安装时以实际最新兼容版本为准，但必须锁定在 `package-lock.json`，且不增加其他运行时依赖。

- [ ] **Step 2: 安装依赖并生成 lockfile**

Run:
```bash
cd light_skills
npm install
```

Expected: 生成 `package-lock.json`，`npm ls --depth=0` 只列出三个依赖。

- [ ] **Step 3: 验证依赖可导入**

Run:
```bash
node -e "Promise.all([import('marked'),import('yaml'),import('github-slugger')]).then(()=>console.log('deps ok'))"
```

Expected: 输出 `deps ok`。

- [ ] **Step 4: 建立目录占位和 README**

`light_skills/README.md` 至少写清：这本书是什么、目录结构、`npm ci`、`npm run build`、`npm run check`、`npm run serve`、来源与许可证入口。

在 `book/00-intro` 到 `book/08-reflect` 各放一个 `README.md`，写明该部主题和待写章节；不要放空文件。`catalog/`、`source-snapshots/`、`site/` 放 `.gitkeep`。

- [ ] **Step 5: 提交**

```bash
git add light_skills/package.json light_skills/package-lock.json light_skills/README.md light_skills/book light_skills/catalog light_skills/source-snapshots light_skills/site
git commit -m "chore: 搭建 Skills Book 工程骨架" \
  -m "原因：建立 Markdown/HTML 双格式产物的目录和命令入口。" \
  -m "验证：npm install、依赖导入检查。"
```

---

### Task 3: 扫描来源并生成 123 份英文快照

**Files:**
- Create: `light_skills/scripts/companion-docs.json`
- Create: `light_skills/scripts/lib/inventory.mjs`
- Create: `light_skills/scripts/scan-sources.mjs`
- Create: `light_skills/scripts/__tests__/inventory.test.mjs`
- Create: `light_skills/sources.json`（生成）
- Create: `light_skills/source-snapshots/**`（生成）

**Interfaces:**
- Consumes: 两个上游 checkout、`companion-docs.json`。
- Produces:
  - `scanInventory({ gstackRoot, mattRoot, documents? }): { skills, documents }`
  - 未传 `documents` 时，从 `scripts/companion-docs.json` 读取 22 条清单。
  - 每条技能记录的字段与设计文档 7.2 一致。
  - `writeInventory({ root, records }): Promise<void>` 复制快照并写 `sources.json`。
  - 后续任务只读 `sources.json` 和快照，不再直接依赖上游路径。

- [ ] **Step 1: 写失败测试**

`scripts/__tests__/inventory.test.mjs` 至少断言：

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd light_skills
node --test scripts/__tests__/inventory.test.mjs
```

Expected: FAIL，原因是 `../lib/inventory.mjs` 不存在。

- [ ] **Step 3: 写 `companion-docs.json`**

使用设计文档 9.1 的 22 篇清单，结构为：

```json
{
  "documents": [
    { "skill": "mattpocock/ask-matt", "path": "skills/engineering/ask-matt/PHASE-BOUNDARIES.md", "name": "PHASE-BOUNDARIES" }
  ]
}
```

必须包含全部 22 条，不能少 `tdd/tests.md`、`tdd/mocking.md`、`teach` 的四个 `*-FORMAT.md`。

- [ ] **Step 4: 实现 `scanInventory`**

规则：

- gstack 扫描所有 `SKILL.md`，排除路径含 `/test/`、`/.git/`、`/node_modules/` 的文件。
- gstack ID：
  - `SKILL.md` 在仓库根：`gstack/gstack`。
  - `openclaw/skills/gstack-openclaw-<name>/SKILL.md`：`gstack/openclaw/<name>`。
  - `capy/skill/gstack/SKILL.md`：`gstack/capy/gstack`。
  - 其他：`gstack/<父目录名>`。
- matt 扫描 `skills/<bucket>/<name>/SKILL.md`，ID 为 `mattpocock/<name>`。四个 bucket 都包含：engineering、productivity、in-progress、misc。
- 技能快照路径：`source-snapshots/<project>/<id 去掉 project 前缀>/SKILL.md`。
- 附属文档快照路径：`source-snapshots/<project>/<id 去掉 project 前缀>.md`。
- 译文路径：没有附属文档的技能页用 `catalog/<project>/<id 去掉 project 前缀>.md`，例如 `catalog/gstack/office-hours.md`。有附属文档的技能页用 `catalog/<project>/<id 去掉 project 前缀>/SKILL.md`，例如 `catalog/mattpocock/tdd/SKILL.md`，保证原文里的同目录链接成立。附属文档页用 `catalog/<project>/<父技能 slug>/<文档名>.md`，例如 `catalog/mattpocock/tdd/tests.md`。
- `sourceSha256` 用 `node:crypto` 对文件字节计算。
- `translationStatus` 初始为 `todo`，`translatedAt` 为 `null`。
- `notes`：gstack 生成文件写“上游 SKILL.md 由模板生成。”；附属文档写“父技能明确要求阅读的配套文档。”

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
node --test scripts/__tests__/inventory.test.mjs
```

Expected: PASS，5 个测试全绿。

- [ ] **Step 6: 生成 `sources.json` 和快照**

Run:
```bash
node scripts/scan-sources.mjs
```

Expected: 输出 `101 skills, 22 documents, 123 snapshots`；`sources.json` 存在；`find source-snapshots -type f | wc -l` 输出 123。

- [ ] **Step 7: 提交**

```bash
git add light_skills/scripts/companion-docs.json light_skills/scripts/lib/inventory.mjs light_skills/scripts/scan-sources.mjs light_skills/scripts/__tests__/inventory.test.mjs light_skills/sources.json light_skills/source-snapshots
git commit -m "feat(inventory): 扫描 101 个技能与 22 篇附属文档" \
  -m "来源：gstack 8d95013、mattpocock 5beb35b。" \
  -m "原因：把上游来源、哈希和英文快照固定到书仓库。" \
  -m "验证：node --test scripts/__tests__/inventory.test.mjs。"
```

---

### Task 4: 建立 `book.json`、术语表、翻译规范和许可证

**Files:**
- Create: `light_skills/scripts/seed-book.mjs`
- Create: `light_skills/book.json`
- Create: `light_skills/GLOSSARY.md`
- Create: `light_skills/TRANSLATION.md`
- Create: `light_skills/NOTICE.md`
- Create: `light_skills/CHANGELOG.md`
- Create: `light_skills/third-party/gstack-LICENSE`
- Create: `light_skills/third-party/mattpocock-skills-LICENSE`

**Interfaces:**
- Consumes: `sources.json`。
- Produces: `book.json` 的 `catalog` 含 101 个技能，`parts` 含九个内容部，`chapters` 初始为空；后续章节只改 `parts[].chapters`，不改 `catalog`。全库索引是构建时生成的独立区域，不占用一个 `book/` 目录。

- [ ] **Step 1: 写 `seed-book.mjs`**

行为：

- 读取 `sources.json`。
- 读取现有的 `book.json`（如果存在），保留 `parts`。
- 将 `catalog.gstack` 和 `catalog.mattpocock` 覆盖为按 ID 排序的完整列表。
- 如果 `book.json` 不存在，创建以下九个内容部，`chapters` 全部为空数组：
  - `00-intro`：导读
  - `01-two-paradigms`：第一部 两种范式
  - `02-think`：第二部 想清楚
  - `03-plan`：第三部 规划
  - `04-build`：第四部 构建
  - `05-review`：第五部 审查
  - `06-test`：第六部 测试
  - `07-ship`：第七部 交付
  - `08-reflect`：第八部 反思与运营
- 全库与索引不写入 `parts`，由 `build.mjs` 从 `catalog` 生成侧边栏区域。
- 输出格式固定为两空格缩进、末尾换行。

- [ ] **Step 2: 运行 seed 生成 `book.json`**

Run:
```bash
node scripts/seed-book.mjs
node -e "const b=require('./book.json'); console.log(b.catalog.gstack.length, b.catalog.mattpocock.length)"
```

Expected: 输出 `63 38`。

- [ ] **Step 3: 写 `GLOSSARY.md`**

至少包含以下统一译法，格式为表格 `英文 | 中文 | 说明`：

| 英文 | 中文 | 说明 |
|---|---|---|
| skill | 技能 | 不译成“技巧” |
| agent | 智能体（agent） | 首次出现给英文，之后可用 agent |
| harness | 运行框架（harness） | 承载 agent 的宿主/运行时 |
| context window | 上下文窗口 | |
| subagent | 子代理 | |
| spec | 规格（spec） | |
| ticket | 工单 | |
| issue | 议题（issue） | 与 ticket 区分 |
| triage | 分诊 | |
| seam | 接缝 | |
| tracer bullet | 曳光弹 | |
| deep module | 深模块 | |
| grilling | 追问（grilling） | |
| frontier | 前沿（frontier） | 当前前置条件已满足、可以立即提问的决策集合 |
| workflow | 工作流 | |
| gate | 门禁 | |
| review | 审查 | |
| ship | 发布（ship） | |
| retro | 复盘 | |
| prototype | 原型 | |
| decision ticket | 决策工单 | |
| model-invoked | 模型可调用 | |
| user-invoked | 用户调用 | |
| prompt | 提示词 | |
| plan mode | 计划模式 | |
| red-green | 红绿 | |
| vertical slice | 垂直切片 | |
| feedback loop | 反馈回路 | |
| domain model | 领域模型 | |
| ADR | 架构决策记录（ADR） | |
| glossary | 术语表 | |

- [ ] **Step 4: 写 `TRANSLATION.md`**

写清：

- 翻译对象、排除项。
- 保留代码、命令、路径、URL、frontmatter 键名、技能名。
- 译者注只能 `> 译者注：`，不能有标题或代码围栏。
- 结构对照规则。
- 新增术语必须同一 commit 更新 `GLOSSARY.md`。
- 质量抽查比例 10%。

- [ ] **Step 5: 写 `NOTICE.md` 并复制许可证**

Run:
```bash
cp ../gstack/LICENSE third-party/gstack-LICENSE
cp ../mattpocock_skills/LICENSE third-party/mattpocock-skills-LICENSE
```

`NOTICE.md` 写清两个项目的版权人、仓库、固定 commit、MIT 许可证、翻译和注释属于修改。

- [ ] **Step 6: 写 `CHANGELOG.md` 首条**

```markdown
# 变更记录

## 2026-10-29

### 新增
- 初始化 Skills Book 工程，采用“主题主书 + 全量附录”结构。
- 固定 gstack 与 mattpocock 的来源 commit，加入 123 份英文原文快照。
```

- [ ] **Step 7: 提交**

```bash
git add light_skills/book.json light_skills/scripts/seed-book.mjs light_skills/GLOSSARY.md light_skills/TRANSLATION.md light_skills/NOTICE.md light_skills/CHANGELOG.md light_skills/third-party
git commit -m "docs(book): 建立目录、术语表与翻译规范" \
  -m "原因：为 101 个技能建立唯一目录归属，并固定译名和许可证说明。" \
  -m "验证：book.json 的 catalog 计数为 63 + 38。"
```

---

### Task 5: 实现校验库与日常 `check`

**Files:**
- Create: `light_skills/scripts/lib/validate.mjs`
- Create: `light_skills/scripts/check.mjs`
- Create: `light_skills/scripts/__tests__/validate.test.mjs`

**Interfaces:**
- Consumes: `sources.json`、`book.json`、`catalog/`、`source-snapshots/`。
- Produces:
  - `loadProject(root): Promise<{ sources, book }>`
  - `validateProject({ root, mode }): Promise<Issue[]>`
  - `Issue = { level: "error" | "warning", code: string, message: string, path?: string }`
  - `check.mjs` 支持 `--release`、`--sources`、`--stats`。

- [ ] **Step 1: 写失败测试**

`scripts/__tests__/validate.test.mjs` 至少覆盖：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateSources, validateBook, validateTranslationStructure } from "../lib/validate.mjs";

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
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
node --test scripts/__tests__/validate.test.mjs
```

Expected: FAIL，`validate.mjs` 不存在。

- [ ] **Step 3: 实现 `validate.mjs`**

必须实现：

- `validateSources`：字段完整、ID 唯一、快照存在、哈希匹配、`translationStatus` 合法。
- `validateBook`：`catalog` 覆盖 101 个技能、不重不漏、章节引用的技能存在。
- `validateTranslationStructure(source, translation)`：先去掉 YAML frontmatter，再比较标题数、代码块数，忽略 `> 译者注：` 块。
- `validateTranslationPage({ page, sourceRecord, source })`：检查 Markdown frontmatter 与来源一致、快照路径正确。来源框是构建产物，在 HTML 链接校验阶段检查。
- `validateTranslation` 是上面两个函数的组合入口，供 `validateProject` 使用。
- `validateLinks`：解析生成的 HTML 相对链接，检查目标文件存在；锚点检查可先只校验 `#id` 是否存在。每个完成的技能页和附属文档页都必须包含来源框。
- `validateProject`：按模式汇总；`draft` 允许 `todo`，`release` 要求全部 `complete`。
- `draft` 模式下如果 `site/index.html` 还不存在，跳过 HTML 链接检查并输出一条 warning；`release` 模式必须有完整 `site/`。

- [ ] **Step 4: 实现 `check.mjs`**

行为：

- 默认调用 `validateProject({ root, mode: "draft" })`。
- `--release` 使用 `mode: "release"`。
- `--sources` 默认用快照校验；加 `--upstream` 时对比同级仓库。
- `--stats` 输出各项目、各状态计数。
- 有 error 时打印 `code: message` 和路径，退出 1；只有 warning 时退出 0。

- [ ] **Step 5: 运行测试和日常检查**

Run:
```bash
node --test scripts/__tests__/validate.test.mjs
npm run check
```

Expected: 单元测试 PASS；`npm run check` 在当前 101 个 `todo`、无译文页的状态下 PASS。

- [ ] **Step 6: 提交**

```bash
git add light_skills/scripts/lib/validate.mjs light_skills/scripts/check.mjs light_skills/scripts/__tests__/validate.test.mjs
git commit -m "feat(check): 校验来源、目录、结构与占位状态" \
  -m "原因：让未完成的书稿也能逐篇提交，同时保证每个 commit 可构建。" \
  -m "验证：node --test scripts/__tests__/validate.test.mjs；npm run check。"
```

---

### Task 6: 实现 HTML 渲染与构建

**Files:**
- Create: `light_skills/scripts/lib/render.mjs`
- Create: `light_skills/scripts/build.mjs`
- Create: `light_skills/assets/book.css`（构建时复制到 `site/assets/book.css`）
- Create: `light_skills/scripts/__tests__/render.test.mjs`

**Interfaces:**
- Consumes: `book.json`、`sources.json`、`book/`、`catalog/`。
- Produces:
  - `renderMarkdown(markdown): { html, headings }`
  - `renderPage({ page, nav, source, html, prev, next }): string`
  - `buildSite({ root, outDir }): Promise<{ pages, warnings }>`
  - `site/index.html` 和镜像页面。

- [ ] **Step 1: 写失败测试**

`scripts/__tests__/render.test.mjs` 至少覆盖：

- `.md` 链接被改写为 `.html`。
- 中文标题生成稳定锚点。
- 来源框包含项目、路径、commit、许可证、快照路径。
- `todo` 技能在目录里是 `<span>` 而不是 `<a>`。
- 嵌套页面到 `source-snapshots` 的相对链接正确。
- 上一篇/下一篇存在。

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
node --test scripts/__tests__/render.test.mjs
```

Expected: FAIL，`render.mjs` 不存在。

- [ ] **Step 3: 实现 `render.mjs`**

要求：

- 用 `marked` 渲染 GFM，允许表格、任务列表、代码块。
- 用 `github-slugger` 生成标题锚点；同一页重复标题自动加后缀。
- 渲染后把站内 `.md` 链接改成 `.html`；外链和锚点不改。
- 页面布局：左侧目录、正文、来源框、上一篇/下一篇、页内目录。
- 所有资源用相对路径，CSS 只引用 `assets/book.css`。
- 不执行 Markdown 中的脚本，不引入远程字体和 CDN。

- [ ] **Step 4: 实现 `build.mjs`**

行为：

- 读取 `book.json` 和 `sources.json`。
- 生成 `site/index.html`、`site/book/**`、`site/catalog/**`。
- `todo` 技能只出现在全库索引里，显示“待翻译”，不生成页面。
- 对每个完成的技能页生成来源框和“技能速览”；对附属文档页生成来源框，不生成“技能速览”。
- 从 `documents` 的 `parentSkill` 生成父技能页的“附属文档”导航，不修改译文正文。
- 复制 `site/assets/book.css`。
- 把 `source-snapshots/` 复制到 `site/source-snapshots/`，让来源框链接在 `site/` 内闭环。
- 构建后打印生成页数和跳过数。

- [ ] **Step 5: 运行测试和构建**

Run:
```bash
node --test scripts/__tests__/render.test.mjs
npm run build
test -f site/index.html && test -f site/assets/book.css
```

Expected: 测试 PASS；`site/index.html` 存在；没有译文时不生成空的技能页。

- [ ] **Step 6: 提交**

```bash
git add light_skills/scripts/lib/render.mjs light_skills/scripts/build.mjs light_skills/site
git commit -m "feat(site): 生成可离线阅读的 HTML" \
  -m "原因：让 Markdown 书稿和 HTML 书页保持同一来源，支持目录和来源框。" \
  -m "验证：node --test scripts/__tests__/render.test.mjs；npm run build。"
```

---

### Task 7: 来源检查、统计与本地预览

**Files:**
- Create: `light_skills/scripts/serve.mjs`
- Modify: `light_skills/scripts/check.mjs`
- Create: `light_skills/scripts/__tests__/check-sources.test.mjs`

**Interfaces:**
- Consumes: `sources.json`、`source-snapshots/`、可选同级上游。
- Produces:
  - `checkSources({ root, upstream }): Promise<Issue[]>`
  - `npm run check:sources` 默认离线；`npm run check:sources -- --upstream` 对比上游。
  - `npm run serve` 在 `127.0.0.1:4173` 提供静态文件。

- [ ] **Step 1: 写失败测试**

`check-sources.test.mjs` 至少覆盖：

- 快照哈希不匹配时报 `snapshot-hash-mismatch`。
- 上游存在且文件哈希不同时报 `needs-resync`。
- 上游不存在时不报错，只用快照。
- `--stats` 输出 101 个技能和 22 篇文档的计数。

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
node --test scripts/__tests__/check-sources.test.mjs
```

Expected: FAIL。

- [ ] **Step 3: 实现 `checkSources` 和 `serve.mjs`**

要求：

- `checkSources` 只读，不改 `sources.json`。
- `serve` 只服务 `site/`，防止路径穿越，端口可用 `PORT` 覆盖。
- `serve` 打印访问地址后保持运行。

- [ ] **Step 4: 运行测试和命令**

Run:
```bash
node --test scripts/__tests__/check-sources.test.mjs
npm run check:sources
npm run stats
```

Expected: 测试 PASS；`check:sources` 输出 123 个快照已校验；`stats` 输出 `101 skills, 22 documents, 0 complete`。

- [ ] **Step 5: 提交**

```bash
git add light_skills/scripts/serve.mjs light_skills/scripts/check.mjs light_skills/scripts/__tests__/check-sources.test.mjs
git commit -m "feat(scripts): 增加来源检查、统计与本地预览" \
  -m "原因：让上游同步和日常阅读都有明确入口。" \
  -m "验证：node --test scripts/__tests__/check-sources.test.mjs；npm run check:sources。"
```

---

### Task 8: 翻译 `gstack/office-hours`

**Files:**
- Create: `light_skills/catalog/gstack/office-hours.md`
- Modify: `light_skills/sources.json`（状态改为 `complete`，写 `translatedAt`）
- Modify: `light_skills/CHANGELOG.md`

**Interfaces:**
- Consumes: `source-snapshots/gstack/office-hours/SKILL.md`。
- Produces: 一篇完整中文译文，frontmatter `id: gstack/office-hours`、`invocation: user`。

- [ ] **Step 1: 读快照并列出结构**

Run:
```bash
cd light_skills
grep -n '^#\|^```' source-snapshots/gstack/office-hours/SKILL.md | head -80
```

把标题和代码块数量记下来，翻译完成后由 `check` 自动核对。

- [ ] **Step 2: 写译文页**

frontmatter 至少包含：

```yaml
---
id: gstack/office-hours
title: office-hours
description: 用六个追问把产品想法重新框定，产出可执行的设计文档。
invocation: user
project: gstack
sourceCommit: 8d9501373b55897447ae30f1d281c4dbc8a1369e
sourceRef: v1.91.226.0
sourcePath: office-hours/SKILL.md
snapshotPath: source-snapshots/gstack/office-hours/SKILL.md
license: MIT
translatedAt: 2026-10-29
---
```

正文保留原文的标题层级、表格、代码块、命令和链接。译者注只用 `> 译者注：`。不要添加自己的章节。`office-hours` 有 1346 行，分节写入，全部写完后一次性跑结构校验，避免中途漏段。

- [ ] **Step 3: 更新来源状态与 `CHANGELOG.md`**

把 `sources.json` 中该技能的 `translationStatus` 改为 `complete`，`translatedAt` 写 `2026-10-29`。在 `CHANGELOG.md` 的当日 `### 新增` 下加一行：`- 新增 gstack/office-hours 译文。来源 gstack 8d95013。原因：产品追问主题的试点篇。`

- [ ] **Step 4: 构建并检查**

Run:
```bash
npm run build
npm run check
```

Expected: 0 error；生成的 `site/catalog/gstack/office-hours.html` 存在；标题数、代码块数与快照一致。

- [ ] **Step 5: 提交**

```bash
git add light_skills/catalog/gstack/office-hours.md light_skills/sources.json light_skills/site light_skills/CHANGELOG.md
git commit -m "feat(catalog/gstack): 翻译 office-hours" \
  -m "来源：gstack 8d95013 / v1.91.226.0。" \
  -m "原因：产品追问主题的试点篇，用于校准长文译名和版式。" \
  -m "验证：npm run check。"
```

---

### Task 9: 翻译 `mattpocock/grilling`

**Files:**
- Create: `light_skills/catalog/mattpocock/grilling.md`
- Modify: `light_skills/sources.json`
- Modify: `light_skills/CHANGELOG.md`

**Interfaces:**
- Consumes: `source-snapshots/mattpocock/grilling/SKILL.md`。
- Produces: 一篇短译文，frontmatter `id: mattpocock/grilling`、`invocation: model`。

- [ ] **Step 1: 写译文页**

frontmatter 至少包含 `id`、`title: grilling`、`description`、`invocation: model`、`project: mattpocock`、`sourceCommit: 5beb35b...`、`sourceRef: v1.3.1-47-g5beb35b`、`sourcePath: skills/productivity/grilling/SKILL.md`、`snapshotPath`、`license: MIT`、`translatedAt`。

正文保留“设计树”“frontier”“rounds”等概念；`frontier` 统一译为“前沿”，首次出现给英文。

- [ ] **Step 2: 更新来源状态与 `CHANGELOG.md`**

`sources.json` 中 `mattpocock/grilling` 改为 `complete`。在 `CHANGELOG.md` 加一行：`- 新增 mattpocock/grilling 译文。来源 mattpocock 5beb35b。原因：补齐产品追问对照。`

- [ ] **Step 3: 构建并检查**

Run:
```bash
npm run build
npm run check
```

Expected: 0 error；`site/catalog/mattpocock/grilling.html` 存在。

- [ ] **Step 4: 提交**

```bash
git add light_skills/catalog/mattpocock/grilling.md light_skills/sources.json light_skills/site light_skills/CHANGELOG.md
git commit -m "feat(catalog/mattpocock): 翻译 grilling" \
  -m "来源：mattpocock 5beb35b / v1.3.1-47-g5beb35b。" \
  -m "原因：补齐产品追问对照的另一半。" \
  -m "验证：npm run check。"
```

---

### Task 10: 翻译 `mattpocock/tdd` 及两篇附属文档

**Files:**
- Create: `light_skills/catalog/mattpocock/tdd/SKILL.md`
- Create: `light_skills/catalog/mattpocock/tdd/tests.md`
- Create: `light_skills/catalog/mattpocock/tdd/mocking.md`
- Modify: `light_skills/sources.json`
- Modify: `light_skills/CHANGELOG.md`

**Interfaces:**
- Consumes: 三个快照文件。
- Produces: 一个技能页和两个附属文档页，父技能页由构建脚本自动生成附属文档链接。

- [ ] **Step 1: 翻译 `mattpocock/tdd` 的技能页**

保留 `red → green`、`seam`、`vertical slice`、`tracer bullet` 等术语；`seam` 译为“接缝”，`tracer bullet` 译为“曳光弹”。译文页路径是 `catalog/mattpocock/tdd/SKILL.md`，frontmatter 的 `invocation` 写 `model`。

- [ ] **Step 2: 翻译 `tests.md` 和 `mocking.md`**

两个附属文档页的 frontmatter 使用 `id: mattpocock/tdd/tests`、`mattpocock/tdd/mocking`，`title` 分别为 `tests`、`mocking`，并加 `parentSkill: mattpocock/tdd`。正文与技能页分开，不重复技能页内容。

- [ ] **Step 3: 在构建层生成附属文档链接**

不要修改译文正文加标题。`build.mjs` 从 `sources.json` 的 `documents` 读取 `parentSkill`，在父技能页的来源框之后生成“附属文档”导航，链接 `tdd/tests.html` 和 `tdd/mocking.html`。这样结构校验仍然只比较原文与译文正文。

- [ ] **Step 4: 更新来源状态与 `CHANGELOG.md`**

三个记录的 `translationStatus` 都改为 `complete`。在 `CHANGELOG.md` 加一行：`- 新增 mattpocock/tdd、tdd/tests、tdd/mocking 译文。原因：试点覆盖技能加附属文档的形态。`

- [ ] **Step 5: 构建并检查**

Run:
```bash
npm run build
npm run check
```

Expected: 0 error；三个 HTML 页存在；父技能页的附属文档链接可用。

- [ ] **Step 6: 提交**

```bash
git add light_skills/catalog/mattpocock/tdd light_skills/sources.json light_skills/site light_skills/CHANGELOG.md
git commit -m "feat(catalog/mattpocock): 翻译 tdd 及其附属文档" \
  -m "来源：mattpocock 5beb35b / v1.3.1-47-g5beb35b。" \
  -m "原因：试点需要覆盖技能加同目录必读文档的形态。" \
  -m "验证：npm run check。"
```

---

### Task 11: 写试点对照章

**Files:**
- Create: `light_skills/book/02-think/05-product-questioning.md`
- Modify: `light_skills/book.json`（把该章加入第二部）
- Modify: `light_skills/CHANGELOG.md`

**Interfaces:**
- Consumes: `catalog/gstack/office-hours.md`、`catalog/mattpocock/grilling.md`。
- Produces: 一篇 2000 到 3000 字的中文对照章，链接到两篇译文。

- [ ] **Step 1: 写章节正文**

结构固定：

1. `## 一个想法，两种追问`
2. `## office-hours：先判断值不值得做`
3. `## grilling：把设计树一轮轮问到底`
4. `## 什么时候用哪一个`
5. `## 把两者接起来`

至少包含一张对照表：`问题 | office-hours | grilling | 适用场景`。不要复述两篇全文，只提炼差异和选择标准。

- [ ] **Step 2: 更新 `book.json`**

把 `book/02-think/05-product-questioning.md` 放入第二部，`skills` 写 `["gstack/office-hours", "mattpocock/grilling"]`。

- [ ] **Step 3: 构建并检查**

Run:
```bash
npm run build
npm run check
```

Expected: 0 error；章节页存在；两个译文链接和章节内锚点可用。

- [ ] **Step 4: 提交**

```bash
git add light_skills/book/02-think/05-product-questioning.md light_skills/book.json light_skills/site light_skills/CHANGELOG.md
git commit -m "docs(book): 写产品追问对照章" \
  -m "原因：试用主题主书结构，比较 office-hours 与 grilling 的分工。" \
  -m "验证：npm run check。"
```

---

### Task 12: 构建试点、验收并打标签

**Files:**
- Modify: `light_skills/CHANGELOG.md`（补试点总结）
- Modify: `light_skills/site/**`（重新生成）

**Interfaces:**
- Consumes: 前 11 个任务的产物。
- Produces: 可打开的 `site/index.html`、3 篇技能页、2 篇附属文档页、1 篇对照章，标签 `v0.1.0`。

- [ ] **Step 1: 跑完整检查**

Run:
```bash
cd light_skills
npm run check
npm run check:sources
npm run stats
```

Expected:
- `npm run check` 0 error。
- `check:sources` 校验 123 个快照。
- `stats` 显示至少 3 个技能、2 篇附属文档为 `complete`，其余为 `todo`。

- [ ] **Step 2: 人工打开 HTML**

Run:
```bash
npm run serve
```

打开 `http://127.0.0.1:4173/`，检查：
- 首页目录能进入第二部。
- 产品追问章能跳到 office-hours 和 grilling。
- 两个技能页有来源框、技能速览、上一篇/下一篇。
- tdd 页能打开 tests 和 mocking。
- 全库里未翻译技能显示“待翻译”，不是死链。
- 窄屏下目录不遮挡正文。

- [ ] **Step 3: 更新 `CHANGELOG.md`**

加一条试点总结：

```markdown
### 试点
- 完成 office-hours、grilling、tdd 及 tdd 的两篇附属文档。
- 完成“产品追问”对照章，验证主题主书结构。
- 试点确认后进入剩余 98 个技能和 20 篇附属文档的全量翻译。
```

- [ ] **Step 4: 提交并打标签**

```bash
git add light_skills/CHANGELOG.md light_skills/site
git commit -m "chore(release): 完成 v0.1.0 试点" \
  -m "原因：交付第一份可读的 Skills Book 试点，等待译名和版式确认。" \
  -m "验证：npm run check、npm run check:sources、npm run stats。"
git tag v0.1.0
```

- [ ] **Step 5: 汇报试点**

向用户报告：
- 已完成 3 个技能、2 篇附属文档、1 篇对照章。
- `site/index.html` 的打开方式。
- 试点的译名、语气、版式中需要确认的点。
- 全量翻译的下一步：剩余 98 个技能和 20 篇附属文档，按设计文档 M3 分批进行。

---

## 后续计划（不在本计划执行）

本计划到 `v0.1.0` 结束。试点确认后，另写一份 `2026-10-29-skills-book-full-translation.md`，按部批量翻译剩余 98 个技能和 20 篇附属文档，再另写主书章节计划。不要在试点确认前开始 M3。