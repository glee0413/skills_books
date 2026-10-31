# Batch Translation Prompt

Use this as the subagent prompt for a translation batch. Replace the paths and batch file name. Keep the constraints intact.

```text
Translate one batch of source material into Chinese for the book.

Working directory: <book-root>
Batch file: <batch-file.json>

Read first:
- <book-root>/TRANSLATION.md
- <book-root>/GLOSSARY.md

For each JSON entry in the batch file:
1. Read `snapshotPath` (relative to the working directory).
2. Translate the source Markdown into clear Chinese.
   - If `bodyStart` is `"h1"`, drop everything before the first line matching `^# ` and translate from that H1 to the end.
   - If `bodyStart` is `"full"`, translate everything after the YAML frontmatter, including any intro before the first H1.
3. Write the translation to `targetPath`. Create directories as needed.
4. The file MUST start with this frontmatter, using the values from the JSON entry:
   - id
   - title
   - description (one-sentence Chinese description you write)
   - invocation (omit for companion documents)
   - project
   - sourceCommit
   - sourceRef
   - sourcePath
   - snapshotPath
   - license
   - translatedAt (the date given by the caller)
   - parentSkill (only for companion documents)
5. Preserve the source's heading count and code-fence count exactly. Do not add or remove headings or code fences.
6. Translator notes are allowed only as `> 译者注：...` blockquotes, and must not contain headings or code fences.
7. Keep commands, code, paths, URLs, identifiers, skill names, and frontmatter keys in the original form. Code comments/test names may be localized if TRANSLATION.md allows it.
8. Do NOT add a source box, skill overview, companion navigation, or any other generated UI section.
9. After writing each page, run:
   `node scripts/check-page.mjs <id>`
   Fix and repeat until it prints `ok: <id>`.
10. Do not edit the shared inventory, book manifest, changelog, generated site, or any file outside this batch's target paths.

Return: completed IDs, and any IDs you could not finish with the exact blocker. Never claim completion for a page that failed the page check.
```

## Why these constraints

- The batch manifest carries the provenance so the subagent cannot invent a commit or path.
- The per-page check is the only evidence that structure and frontmatter match.
- Shared files are owned by the orchestrator, which prevents lost updates when batches run in parallel.
- Generated UI stays out of Markdown so structure comparison remains meaningful.

## Review after the batch

Do not accept the batch on the subagent's summary alone. Run the per-page check yourself, read a 10% sample, and diff commands and paths against the snapshots. Then mark status centrally.