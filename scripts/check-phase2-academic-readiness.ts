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
  latestAcademicRolloutEvidenceTimestamp,
  resolveWorkspaceEvidencePath,
  rolloutEvidenceMatchesCommit,
} from "../lib/academic-rollout-evidence.ts";
import {
  phase3AuthorizationFollowsEvidence,
  phase3AuthorizationMatchesEvidence,
  phase3AuthorizationSchema,
  resolveWorkspaceAuthorizationPath,
} from "../lib/phase3-authorization.ts";

const manifestArgument = process.argv.find((value) => value.startsWith("--manifest="))?.slice(11)
  ?? "docs/phase2-academic-bootstrap.approved.json";
const evidenceArgument = process.argv.find((value) => value.startsWith("--evidence="))?.slice(11)
  ?? "evidence/phase2-rollout-evidence.approved.json";
const authorizationArgument = process.argv
  .find((value) => value.startsWith("--phase3-authorization="))
  ?.slice(23) ?? "evidence/phase3-attendance-authorization.approved.json";
const strict = process.argv.includes("--strict");
const requireEvidence = process.argv.includes("--require-evidence");
const requirePhase3Authorization = process.argv.includes("--require-phase3-authorization");
const workspaceRoot = process.cwd();
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
let inMemoryReplicaSetAvailable = false;
try {
  require.resolve("mongodb-memory-server-core");
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
const { resolvedPath: authorizationPath, relativePath: relativeAuthorizationPath } =
  resolveWorkspaceAuthorizationPath(workspaceRoot, authorizationArgument);

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
let latestEvidenceAt: string | undefined;
let currentCommit: string | undefined;
let repositoryClean = false;
let phase3AuthorizationValid = false;
let authorizationState = "missing";
let authorizedBaseCommit: string | undefined;
try {
  currentCommit = (
    await execFileAsync(
      "git",
      ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "rev-parse", "HEAD"],
      { cwd: workspaceRoot },
    )
  ).stdout.trim();
  repositoryClean = (
    await execFileAsync(
      "git",
      ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "status", "--porcelain"],
      { cwd: workspaceRoot },
    )
  ).stdout.trim().length === 0;
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
    latestEvidenceAt = latestAcademicRolloutEvidenceTimestamp(evidence);
    const evidenceMatchesCommit = rolloutEvidenceMatchesCommit(testedCommit, currentCommit);
    externalEvidenceValid = evidenceMatchesCommit && repositoryClean;
    evidenceState = externalEvidenceValid
      ? "valid"
      : evidenceMatchesCommit
        ? "dirty-worktree"
        : "stale";
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      evidenceState = "invalid";
    }
  }

  try {
    await access(authorizationPath);
    const authorization = phase3AuthorizationSchema.parse(
      JSON.parse(await readFile(authorizationPath, "utf8")),
    );
    authorizedBaseCommit = authorization.authorizedBaseCommit;
    const authorizationMatchesCommit = phase3AuthorizationMatchesEvidence(
      authorizedBaseCommit,
      testedCommit,
      currentCommit,
    );
    const authorizationFollowsEvidence = phase3AuthorizationFollowsEvidence(
      authorization.approvedAt,
      latestEvidenceAt,
    );
    phase3AuthorizationValid =
      externalEvidenceValid &&
      authorizationMatchesCommit &&
      authorizationFollowsEvidence;
    authorizationState = phase3AuthorizationValid
      ? "valid"
      : !externalEvidenceValid
        ? "blocked-by-evidence"
        : !authorizationMatchesCommit
          ? "stale"
          : "predates-evidence";
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      authorizationState = "invalid";
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
  phase3AuthorizationValid,
});

console.log(JSON.stringify({
  ...report,
  manifest: { path: relativePath, state: manifestState },
  evidence: {
    path: relativeEvidencePath,
    state: evidenceState,
    testedCommit,
    latestEvidenceAt,
    currentCommit,
  },
  authorization: {
    path: relativeAuthorizationPath,
    state: authorizationState,
    authorizedBaseCommit,
  },
  repository: {
    clean: repositoryClean,
    detail: repositoryClean
      ? "The Git worktree matches the reported commit."
      : "Commit-bound evidence cannot qualify a dirty or unverifiable worktree.",
  },
  note: "This command is read-only and never connects to MongoDB.",
}, null, 2));

if (strict && report.status !== "ready-for-external-validation") {
  process.exitCode = 1;
}
if (
  requireEvidence &&
  report.rolloutEligibility === "not-eligible"
) {
  process.exitCode = 1;
}
if (requirePhase3Authorization && !report.phase3ImplementationAuthorized) {
  process.exitCode = 1;
}
