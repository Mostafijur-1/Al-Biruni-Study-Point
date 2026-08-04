import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

import {
  academicBootstrapManifestSchema,
  resolveWorkspaceManifestPath,
} from "../lib/academic-bootstrap.ts";
import { evaluateAcademicReadiness } from "../lib/academic-readiness.ts";
import {
  academicRolloutEvidenceSchema,
  resolveWorkspaceEvidencePath,
  rolloutEvidenceMatchesCommit,
} from "../lib/academic-rollout-evidence.ts";

const manifestArgument = process.argv.find((value) => value.startsWith("--manifest="))?.slice(11)
  ?? "docs/phase2-academic-bootstrap.approved.json";
const evidenceArgument = process.argv.find((value) => value.startsWith("--evidence="))?.slice(11)
  ?? "evidence/phase2-rollout-evidence.approved.json";
const strict = process.argv.includes("--strict");
const requireEvidence = process.argv.includes("--require-evidence");
const workspaceRoot = process.cwd();
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
let inMemoryReplicaSetAvailable = false;
try {
  require.resolve("mongodb-memory-server");
  inMemoryReplicaSetAvailable = true;
} catch {
  // The explicit test URI remains available as the fallback prerequisite.
}
const { resolvedPath: manifestPath, relativePath } = resolveWorkspaceManifestPath(
  workspaceRoot,
  manifestArgument,
);
const { resolvedPath: evidencePath, relativePath: relativeEvidencePath } =
  resolveWorkspaceEvidencePath(workspaceRoot, evidenceArgument);

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

let externalEvidenceValid = false;
let evidenceState = "missing";
let testedCommit: string | undefined;
let currentCommit: string | undefined;
try {
  currentCommit = (
    await execFileAsync(
      "git",
      ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "rev-parse", "HEAD"],
      { cwd: workspaceRoot },
    )
  ).stdout.trim();
} catch {
  evidenceState = "unverifiable";
}

if (currentCommit) {
  try {
    await access(evidencePath);
    const evidence = academicRolloutEvidenceSchema.parse(
      JSON.parse(await readFile(evidencePath, "utf8")),
    );
    testedCommit = evidence.testedCommit;
    externalEvidenceValid = rolloutEvidenceMatchesCommit(testedCommit, currentCommit);
    evidenceState = externalEvidenceValid ? "valid" : "stale";
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      evidenceState = "invalid";
    }
  }
}

const report = evaluateAcademicReadiness({
  approvedManifestValid,
  testMongoUriConfigured: Boolean(process.env.ACADEMIC_TEST_MONGODB_URI?.trim()),
  testDatabaseName: process.env.ACADEMIC_TEST_DB_NAME?.trim(),
  inMemoryReplicaSetAvailable,
  academicWritesEnabled: process.env.ACADEMIC_WRITES_ENABLED?.trim().toLowerCase() === "true",
  externalEvidenceValid,
});

console.log(JSON.stringify({
  ...report,
  manifest: { path: relativePath, state: manifestState },
  evidence: {
    path: relativeEvidencePath,
    state: evidenceState,
    testedCommit,
    currentCommit,
  },
  note: "This command is read-only and never connects to MongoDB.",
}, null, 2));

if (strict && report.status !== "ready-for-external-validation") {
  process.exitCode = 1;
}
if (
  requireEvidence &&
  report.rolloutEligibility !== "eligible-for-explicit-phase3-authorization"
) {
  process.exitCode = 1;
}
