---
name: source-to-book
description: Use when turning one or more open-source repositories, documentation sets, or course materials into a structured learning book, especially when the work needs full translation, source provenance, parallel batch translation, structural validation, and static HTML output.
---

# Source to Book

## Core principle

A source-to-book project has two layers:

- **The source catalog** is the fact base. One page per source unit, translated or extracted faithfully, with provenance.
- **The thematic book** is the argument. Chapters compare sources, explain patterns, and link to the catalog. They never duplicate the full source text.

The catalog makes the book complete. The thematic layer makes it readable. Keep them separate.

## When to use

Use this skill when:

- Several open-source projects, docs sets, or course repositories must become one book.
- The book must remain maintainable as new sources are added.
- You need both Markdown and static HTML.
- The source text is large enough that one agent cannot hold it in context.
- Source provenance, licenses, and change history matter.

Do not use it for:

- A one-off article or summary with no source corpus.
- A book whose sources have no stable files or commits.
- A project where the only deliverable is a translation dump with no thematic structure.

## Pipeline at a glance

| Phase | Output | Gate |
|---|---|---|
| 1. Intake | scope, pinned commits, licenses, exclusions | counts and versions reconciled |
| 2. Inventory | `sources.json`, snapshots, source hashes | every source unit accounted for |
| 3. Skeleton | `book.json`, taxonomy, plan | every source unit has one catalog slot |
| 4. Pilot | 3-5 varied pages, one comparison chapter, glossary | human confirms voice, terms, layout |
| 5. Batch translation | catalog pages | every page passes a per-page check |
| 6. Thematic writing | chapters, comparison matrix | chapters link to catalog, no duplication |
| 7. Release | built site, changelog, tag | release check passes from a clean tree |

## Phase 1: Intake

Freeze the source set before translating anything.

1. **Pin every source.** Record repository URL, full commit SHA, tag or `git describe`, and the exact source paths. Never use a floating branch.
   - For a local source with no upstream repository, create a git repository and an annotated tag before snapshotting. A floating local folder has no reproducible hash.
   - If the source is a book with a `SUMMARY.md`, `INDEX.md`, or similar, treat that file as the order authority. The number of listed content files is the expected unit count.
2. **Count the real units.** Decide what counts as a source unit. For a skills repository that might be one non-test `SKILL.md` plus explicitly required companion docs. For a book, it is one content file listed by the order authority, not every file in the folder. Reconcile the count with a written scope statement.
3. **Write the exclusion list.** Typical exclusions: scripts, tests, fixtures, templates, generated boilerplate, READMEs, changelogs, full docs sites. If a file is required reading, it is in scope; if it is only further reading, it is not.
4. **Check licenses.** Copy the upstream license into `third-party/` and write a `NOTICE.md` naming the copyright holder, commit, license, and what changed.
5. **Define a source unit ID.** Use `<project>/<slug>`, with namespace segments for variants. Companion docs use `<skill-id>/<doc-name>`. IDs never change when titles change.

If the count differs from the plan, stop and inspect. A new upstream directory or a changed companion-doc reference is a scope change, not a rounding error.

## Phase 2: Inventory and snapshots

The inventory is the single source of truth. Do not keep source metadata in prose.

Each skill record should carry:

```json
{
  "id": "project/skill-name",
  "project": "project",
  "repo": "https://github.com/owner/repo",
  "commit": "<full sha>",
  "ref": "v1.2.3 or v1.2.3-47-gabcdef",
  "sourcePath": "path/in/upstream/SKILL.md",
  "snapshotPath": "source-snapshots/project/skill-name/SKILL.md",
  "sourceSha256": "<sha256 of the source bytes>",
  "sourceUrl": "https://github.com/owner/repo/blob/<sha>/path/in/upstream/SKILL.md",
  "license": "MIT",
  "translationPath": "catalog/project/skill-name.md",
  "translationStatus": "todo",
  "translatedAt": null
}
```

For books, docs, and code-heavy sources, add only the fields the project needs:

- `sourceKind`: `git` or `local`.
- `mode`: `translate`, `normalize`, or `extract`.
- `kind`: `concept`, `tutorial`, `reference`, `exercise`, and so on.
- `order`: reading order from the source's own index.
- `aliases`: old IDs kept when an upstream rename would otherwise break catalog links.

Companion documents are a separate `documents` array with a `parentSkill` field. Never merge them into `skills`; that breaks every skill count and index.

Rules:

- Snapshot the bytes at the pinned commit. Never translate from a dirty working tree.
- Compute the hash from the snapshot bytes. Never edit a snapshot after recording its hash.
- Keep upstream repositories out of the book repository's git. Snapshot files are the reproducible input.
- Store the catalog target path. A skill with companion documents should use `catalog/<project>/<skill>/SKILL.md` so same-directory links resolve; a standalone skill can use `<skill>.md`.
- Preserve translation status and translation date when re-scanning sources. A rescan must never turn `complete` back into `todo`.

The repository should be self-contained: a fresh clone with no upstream checkouts must still be able to validate hashes, structure, and links.

## Phase 3: Book skeleton

Define two structures, not one:

1. **Catalog order.** Every source unit appears exactly once. This is the completeness contract.
2. **Thematic order.** A small number of parts and chapters, each with a question and a list of catalog skills it references.

A chapter may reference zero, one, or many skills. A skill may appear in several chapters. It must appear in the catalog exactly once.

Build a comparison chapter early. It should define the axes the rest of the book reuses, for example:

- unit of work
- control flow and gates
- artifacts produced
- context and memory strategy
- tooling and runtime assumptions
- autonomy and human approval points
- characteristic failure modes
- when to choose which

Keep chapters problem-first: problem → what each source does → where they disagree → how to choose → links to the catalog. Do not write “summary of skill A, summary of skill B.”

## Phase 4: Translation policy

Start by classifying each unit. The mode changes the work, not the pipeline:

| Mode | Use when | Rule |
|---|---|---|
| `translate` | source is in another language | translate prose; preserve machinery |
| `normalize` | source is already in the target language | copyedit only; never restructure or add examples |
| `extract` | source is reference material or too long to translate fully | faithful extraction with a coverage list and citations |

Translate prose, preserve machinery.

- Keep code, commands, paths, URLs, identifiers, skill names, and frontmatter keys in the original form.
- Code comments, test names, and placeholder prose inside code blocks may be localized if the project's style guide allows it; identifiers and commands stay. For a code-heavy book, do not localize anything inside code fences: byte-level code fidelity is more valuable than comment translation.
- Preserve code-generation directives exactly: `{{#include}}`, `{{#rustdoc_include}}`, `{{#playground}}`, hidden-line prefixes, anchor markers, and listing numbers. A translated or reordered directive silently breaks the reader's code.
- Preserve assets and relative chapter links. If the catalog moves a page, build a link map from source path to catalog path instead of editing every link by hand. Non-translated assets point to the pinned upstream commit.
- Preserve heading levels, tables, lists, and code-fence counts.
- Translator notes must be `> 译者注：...` blockquotes with no headings or code fences. Structural comparison ignores only those blocks.
- Do not add source boxes, skill overviews, companion navigation, previous/next links, or other generated UI to the Markdown. The build adds those from metadata.
- Keep original links. Map companion filenames to their actual translated filenames; point non-translated assets to the upstream commit URL.
- For generated skill files, translate the committed file, not the template. If the project has a repeated runtime preamble, start at the first H1 and leave the preamble in the snapshot. If a source has a meaningful intro before its first H1, translate that intro.

Page frontmatter should be small and derivable from the inventory:

```yaml
---
id: project/skill-name
title: skill-name
description: one-sentence Chinese description
invocation: user | model | unknown
project: project
sourceCommit: <full sha>
sourceRef: v1.2.3
sourcePath: path/in/upstream/SKILL.md
snapshotPath: source-snapshots/project/skill-name/SKILL.md
license: MIT
translatedAt: YYYY-MM-DD
---
```

Companion documents omit `description` and `invocation` and add `parentSkill`.

## Phase 5: Batch translation

Large source sets need batches, not one heroic session.

1. **Generate a batch manifest.** Each entry carries `id`, `project`, `title`, `invocation`, `sourcePath`, `snapshotPath`, `targetPath`, `sourceCommit`, `sourceRef`, `license`, `parentSkill`, and the expected heading and code-fence counts.
2. **Partition by project, theme, and size.** Six to ten medium pages per batch is a good default; a single very long page can be its own batch.
3. **Dispatch one subagent per batch.** Give each a disjoint file list and forbid writes to the inventory, book manifest, changelog, and generated site. The main agent owns shared files and status transitions.
4. **Check every page before moving on.** A per-page check must verify frontmatter, source hash, heading count, fence count, and translator-note rules. Do not mark a page complete because it “looks translated.”
5. **Audit a sample.** Structural equality is necessary but not sufficient. Read 10% of each batch fully, diff commands and paths against the snapshot, and grep for competing translations.
6. **Mark status centrally.** After the batch passes, set status and translation date from the main session. Never let a subagent edit the shared inventory.

See `references/batch-prompt.md` for a copy-ready subagent prompt.

## Phase 6: Validation

Use two gates.

**Daily gate**, on every commit:

- inventory schema, unique IDs, existing snapshots, matching hashes
- every non-todo record has a page; every complete page has matching frontmatter
- catalog equals the inventory skill set, once each
- every chapter skill reference exists
- heading and code-fence parity against the snapshot
- for code-heavy sources, byte-level fenced-block equality, not just fence counts
- code-generation directive parity, same directives in the same order
- relative asset existence and a generated link map for moved chapter links
- internal links and anchors resolve; decode URL-encoded fragments before comparing IDs
- generated site is fresh; a Markdown edit without a rebuild must fail

**Release gate**, only when finishing a phase:

- all records complete
- no empty bodies and no real placeholders
- placeholder checks ignore fenced code and legitimate domain terms such as `TODOS.md`
- full build, all index pages, previous/next, and cross-links work
- source hashes still match the snapshots

Keep the source check explicit. Default it to offline snapshot comparison; add an `--upstream` mode when the checkouts are present. Upstream drift reports `needs-resync`; it never rewrites translations automatically.

## Phase 7: Build, git, and release

- Build one static site from Markdown, with local CSS, local snapshots, relative links, and no network dependency.
- Copy source snapshots into the published site so source links work offline.
- Commit the generated site. The daily gate must prove it is byte-identical to a fresh build.
- Commit per logical batch or chapter, with a human-readable message: what changed, source commit, reason, verification command.
- Keep a dated `CHANGELOG.md` that records why, not just what.
- Tag phases, for example `v0.1.0` pilot, `v0.5.0` catalog complete, `v0.9.0` chapters, `v1.0.0` release. Push both `main` and tags.
- Sync upstream explicitly: update commit, hash, and snapshot; set `needs-resync`; record old and new commits; retranslate only affected sections.

## Adapting to non-translation knowledge books

The same pipeline works when the task is extraction rather than translation.

| Translation project | Knowledge-book project |
|---|---|
| source unit is a `SKILL.md` | source unit is a chapter, lecture, doc page, notebook, or PDF section |
| translate the text | extract the argument, examples, and definitions |
| structure parity | section coverage and citation coverage |
| glossary of translated terms | glossary of domain concepts |
| source snapshot | extracted source text or PDF page snapshot |
| `check:release` | coverage check plus citation check |

Keep the two layers. The catalog still holds one faithful page per source unit; the thematic chapters still do the comparing and teaching. Replace “translation” with “extraction” in the pipeline, but keep provenance, batch manifests, per-page checks, and the release gate.

Use the mode that matches the source: `translate` for foreign-language prose, `normalize` for your own notes, `extract` for reference material. A project can mix modes; store the mode per unit, not per project. If the sources are code-heavy, add byte-level code fidelity, directive parity, asset checks, and a link map to the daily gate. Fence counts alone are not fidelity.

## Traps

| Trap | Why it hurts | Guard |
|---|---|---|
| Counting companion docs as skills | every count, catalog, and status is wrong | separate `documents`, `parentSkill` |
| Forgetting companion docs | release passes while required readings are missing | freeze the companion list and count it |
| Translating generated boilerplate | 400 lines of repeated preamble bury the skill | start at first H1 for generated skill files |
| Treating heading counts as fidelity | a paragraph can be dropped or inverted | 10% full-read audit, command/path diff |
| Rendering raw frontmatter | every page leaks YAML into the body | strip frontmatter before Markdown rendering |
| Case-sensitive companion links | `HTML-REPORT.md` vs `html-report.md` breaks on Linux | normalize filenames and validate links |
| Stale generated site | readers see old content while Markdown is new | build to temp and compare on every check |
| Rescan resets statuses | complete pages silently become todo | merge by ID, preserve status and date |
| Parallel agents writing shared files | lost updates, unreproducible builds | partition page files only; main owns shared files |
| Over-broad placeholder regex | `TODOS.md` and `grep TODO` trip the gate | ignore code fences and domain terms |
| Hardcoded counts | adding a project requires code edits | derive counts from the inventory |
| Pulling in all upstream docs | scope explodes and the catalog blurs | freeze exclusions in the scope document |
| Wrong version label | `v1.3.1` may be 47 commits behind the commit | use `git describe` and the full SHA |
| Broken Chinese anchors | URL-encoded anchors fail a naive check | decode the fragment before comparing IDs |
| Local source with no pin | hashes and diffs are meaningless | own git repo plus an annotated tag |
| Code fences counted but code changed | the catalog silently stops being faithful | byte-level fenced-block comparison |
| Translated code-generation directives | code blocks render wrong or go missing | directive parity check |
| “Normalizing” becomes rewriting | the faithful page quietly becomes an edit | copyedit-only mode, structure and example parity |
| Hand-edited catalog links | every upstream-moved page becomes a dead link | generated link map checked every commit |

## Done checklist

- [ ] Source commits, IDs, licenses, and exclusion list are recorded.
- [ ] Every source unit has a snapshot and a hash.
- [ ] `sources.json` separates skills and companion documents.
- [ ] Every skill appears exactly once in the catalog.
- [ ] Pilot voice, glossary, and page shape are confirmed.
- [ ] Every page passes a per-page structure and frontmatter check.
- [ ] Every chapter links to catalog pages and does not duplicate them.
- [ ] The comparison chapter defines reusable axes.
- [ ] `check` passes on every commit; `check:release` passes at release.
- [ ] The generated site is committed and fresh.
- [ ] `CHANGELOG.md` records phases, source commits, and reasons.
- [ ] Tags and `main` are pushed; the working tree is clean.

## Worked example

`light_skills/` in this repository is the reference implementation: two source projects, 101 skills plus 22 companion documents, 123 snapshots, 28 translation batches, a 127-page static site, and a `check:release` gate. Read:

- `docs/superpowers/specs/2026-10-29-skills-book-design.md` for the design.
- `light_skills/TRANSLATION.md` for the page rules.
- `light_skills/scripts/` for the inventory, validation, build, and page-check implementation.
- `light_skills/book/01-two-paradigms/01-same-and-different.md` for the comparison chapter.

Adapt the paths and commands; keep the invariants.