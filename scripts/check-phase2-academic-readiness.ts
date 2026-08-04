import { access, readFile } from "node:fs/promises";

import {
  academicBootstrapManifestSchema,
  resolveWorkspaceManifestPath,
} from "../lib/academic-bootstrap.ts";
import { evaluateAcademicReadiness } from "../lib/academic-readiness.ts";

const manifestArgument = process.argv.find((value) => value.startsWith("--manifest="))?.slice(11)
  ?? "docs/phase2-academic-bootstrap.approved.json";
const strict = process.argv.includes("--strict");
const workspaceRoot = process.cwd();
const { resolvedPath: manifestPath, relativePath } = resolveWorkspaceManifestPath(
  workspaceRoot,
  manifestArgument,
);

let approvedManifestValid = false;
let manifestState = "missing";
try {
  await access(manifestPath);
  academicBootstrapManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  approvedManifestValid = true;
  manifestState = "valid";
} catch (error) {
  if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
    manifestState = "invalid";
  }
}

const report = evaluateAcademicReadiness({
  approvedManifestValid,
  testMongoUriConfigured: Boolean(process.env.ACADEMIC_TEST_MONGODB_URI?.trim()),
  testDatabaseName: process.env.ACADEMIC_TEST_DB_NAME?.trim(),
  academicWritesEnabled: process.env.ACADEMIC_WRITES_ENABLED?.trim().toLowerCase() === "true",
});

console.log(JSON.stringify({
  ...report,
  manifest: { path: relativePath, state: manifestState },
  note: "This command is read-only and never connects to MongoDB.",
}, null, 2));

if (strict && report.status !== "ready-for-external-validation") {
  process.exitCode = 1;
}
