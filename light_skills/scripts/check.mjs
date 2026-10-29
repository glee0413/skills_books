import { loadProject, validateProject, checkSources, getStats } from "./lib/validate.mjs";

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
  const stats = getStats(sources);
  console.log(`skills: ${stats.skills}, documents: ${stats.documents}`);
  console.log(`projects: ${JSON.stringify(stats.byProject)}`);
  console.log(`status: ${JSON.stringify(stats.byStatus)}`);
  process.exit(0);
}

if (args.has("--sources")) {
  const { sources } = await loadProject(root);
  const issues = await checkSources({ root, upstream: args.has("--upstream") });
  const errors = printIssues(issues);
  console.log(`checked ${sources.skills.length + sources.documents.length} snapshot(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

const mode = args.has("--release") ? "release" : "draft";
const issues = await validateProject({ root, mode });
const errors = printIssues(issues);
process.exit(errors > 0 ? 1 : 0);