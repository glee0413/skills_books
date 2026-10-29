import { loadProject, validateProject, checkSources } from "./lib/validate.mjs";

const args = new Set(process.argv.slice(2));
const root = process.cwd();

function printIssues(issues) {
  for (const item of issues) {
    const path = item.path ? ` [${item.path}]` : "";
    console.error(`${item.level}: ${item.code}${path}: ${item.message}`);
  }
  const errors = issues.filter((item) => item.level === "error").length;
  const warnings = issues.filter((item) => item.level === "warning").length;
  console.log(`${issues.length} issue(s): ${errors} error(s), ${warnings} warning(s)`);
  return errors;
}

if (args.has("--stats")) {
  const { sources } = await loadProject(root);
  const all = [...sources.skills, ...sources.documents];
  const byStatus = all.reduce((acc, record) => {
    acc[record.translationStatus] = (acc[record.translationStatus] ?? 0) + 1;
    return acc;
  }, {});
  const byProject = all.reduce((acc, record) => {
    acc[record.project] = (acc[record.project] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`skills: ${sources.skills.length}, documents: ${sources.documents.length}`);
  console.log(`projects: ${JSON.stringify(byProject)}`);
  console.log(`status: ${JSON.stringify(byStatus)}`);
  process.exit(0);
}

if (args.has("--sources")) {
  const issues = await checkSources({ root, upstream: args.has("--upstream") });
  const errors = printIssues(issues);
  process.exit(errors > 0 ? 1 : 0);
}

const mode = args.has("--release") ? "release" : "draft";
const issues = await validateProject({ root, mode });
const errors = printIssues(issues);
process.exit(errors > 0 ? 1 : 0);