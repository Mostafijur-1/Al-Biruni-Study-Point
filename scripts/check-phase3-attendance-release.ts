import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  academicRolloutEvidenceSchema,
  latestAcademicRolloutEvidenceTimestamp,
  resolveWorkspaceEvidencePath,
  rolloutEvidenceMatchesCommit,
} from "../lib/academic-rollout-evidence.ts";
import {
  phase3AuthorizationFollowsEvidence,
  phase3AuthorizationSchema,
  resolveWorkspaceAuthorizationPath,
} from "../lib/phase3-authorization.ts";
import {
  phase3ReleaseEvidenceMatchesCommit,
  phase3ReleaseEvidenceSchema,
  resolveWorkspacePhase3ReleaseEvidencePath,
} from "../lib/phase3-release-evidence.ts";

const evidenceArgument = process.argv
  .find((value) => value.startsWith("--evidence="))
  ?.slice(11) ?? "evidence/phase3-attendance-release.approved.json";
const authorizationArgument = process.argv
  .find((value) => value.startsWith("--authorization="))
  ?.slice(16) ?? "evidence/phase3-attendance-authorization.approved.json";
const phase2EvidenceArgument = process.argv
  .find((value) => value.startsWith("--phase2-evidence="))
  ?.slice(18) ?? "evidence/phase2-rollout-evidence.approved.json";
const requireEvidence = process.argv.includes("--require-evidence");
const workspaceRoot = process.cwd();
const execFileAsync = promisify(execFile);

const { resolvedPath: evidencePath, relativePath: relativeEvidencePath } =
  resolveWorkspacePhase3ReleaseEvidencePath(workspaceRoot, evidenceArgument);
const { resolvedPath: authorizationPath, relativePath: relativeAuthorizationPath } =
  resolveWorkspaceAuthorizationPath(workspaceRoot, authorizationArgument);
const { resolvedPath: phase2EvidencePath, relativePath: relativePhase2EvidencePath } =
  resolveWorkspaceEvidencePath(workspaceRoot, phase2EvidenceArgument);

let currentCommit: string | undefined;
let repositoryClean = false;
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
  // An unverifiable repository cannot qualify for rollout.
}

let evidenceState = "missing";
let authorizationState = "missing";
let phase2EvidenceState = "missing";
let releaseCommit: string | undefined;
let authorizedBaseCommit: string | undefined;
let evidenceBaseCommit: string | undefined;
let resolvedAuthorizedBaseCommit: string | undefined;
let resolvedEvidenceBaseCommit: string | undefined;
let phase2TestedCommit: string | undefined;
let latestPhase2EvidenceAt: string | undefined;
let baseCommitIsAncestor = false;

if (currentCommit) {
  try {
    await access(evidencePath);
    const evidence = phase3ReleaseEvidenceSchema.parse(
      JSON.parse(await readFile(evidencePath, "utf8")),
    );
    releaseCommit = evidence.releaseCommit;
    evidenceBaseCommit = evidence.authorizedBaseCommit;
    const commitMatches = phase3ReleaseEvidenceMatchesCommit(releaseCommit, currentCommit);
    evidenceState = commitMatches
      ? repositoryClean
        ? "valid"
        : "dirty-worktree"
      : "stale";
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      evidenceState = "invalid";
    }
  }

  try {
    await access(phase2EvidencePath);
    const phase2Evidence = academicRolloutEvidenceSchema.parse(
      JSON.parse(await readFile(phase2EvidencePath, "utf8")),
    );
    phase2TestedCommit = phase2Evidence.testedCommit;
    latestPhase2EvidenceAt = latestAcademicRolloutEvidenceTimestamp(phase2Evidence);
    phase2EvidenceState = "parsed";
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      phase2EvidenceState = "invalid";
    }
  }

  try {
    await access(authorizationPath);
    const authorization = phase3AuthorizationSchema.parse(
      JSON.parse(await readFile(authorizationPath, "utf8")),
    );
    authorizedBaseCommit = authorization.authorizedBaseCommit;
    try {
      resolvedAuthorizedBaseCommit = (
        await execFileAsync(
          "git",
          [
            "-c",
            `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`,
            "rev-parse",
            `${authorizedBaseCommit}^{commit}`,
          ],
          { cwd: workspaceRoot },
        )
      ).stdout.trim();
      resolvedEvidenceBaseCommit = (
        await execFileAsync(
          "git",
          [
            "-c",
            `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`,
            "rev-parse",
            `${evidenceBaseCommit}^{commit}`,
          ],
          { cwd: workspaceRoot },
        )
      ).stdout.trim();
    } catch {
      resolvedAuthorizedBaseCommit = undefined;
      resolvedEvidenceBaseCommit = undefined;
    }

    const phase2EvidenceMatchesBase = Boolean(
      resolvedAuthorizedBaseCommit &&
      phase2TestedCommit &&
      rolloutEvidenceMatchesCommit(phase2TestedCommit, resolvedAuthorizedBaseCommit),
    );
    const releaseBaseMatchesAuthorization = Boolean(
      resolvedAuthorizedBaseCommit &&
      resolvedEvidenceBaseCommit &&
      resolvedAuthorizedBaseCommit === resolvedEvidenceBaseCommit,
    );
    const authorizationFollowsPhase2Evidence = phase3AuthorizationFollowsEvidence(
      authorization.approvedAt,
      latestPhase2EvidenceAt,
    );
    phase2EvidenceState = phase2EvidenceState === "parsed"
      ? phase2EvidenceMatchesBase
        ? "valid"
        : "base-mismatch"
      : phase2EvidenceState;
    authorizationState =
      releaseBaseMatchesAuthorization &&
      phase2EvidenceMatchesBase &&
      authorizationFollowsPhase2Evidence
        ? "valid"
        : !releaseBaseMatchesAuthorization
          ? "release-base-mismatch"
          : !phase2EvidenceMatchesBase
            ? "phase2-evidence-mismatch"
            : "predates-phase2-evidence";

    if (authorizationState === "valid" && resolvedAuthorizedBaseCommit) {
      try {
        await execFileAsync(
          "git",
          [
            "-c",
            `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`,
            "merge-base",
            "--is-ancestor",
            resolvedAuthorizedBaseCommit,
            currentCommit,
          ],
          { cwd: workspaceRoot },
        );
        baseCommitIsAncestor = true;
      } catch {
        baseCommitIsAncestor = false;
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      authorizationState = "invalid";
    }
  }
}

const eligibleForScopedPilot =
  evidenceState === "valid" &&
  phase2EvidenceState === "valid" &&
  authorizationState === "valid" &&
  baseCommitIsAncestor &&
  repositoryClean;

const report = {
  status: eligibleForScopedPilot ? "eligible-for-scoped-pilot" : "blocked",
  eligibleForScopedPilot,
  attendanceRuntimeUnlocked: false,
  evidence: {
    path: relativeEvidencePath,
    state: evidenceState,
    releaseCommit,
    currentCommit,
  },
  authorization: {
    path: relativeAuthorizationPath,
    state: authorizationState,
    authorizedBaseCommit,
    evidenceBaseCommit,
    resolvedAuthorizedBaseCommit,
    resolvedEvidenceBaseCommit,
    baseCommitIsAncestor,
  },
  phase2Evidence: {
    path: relativePhase2EvidencePath,
    state: phase2EvidenceState,
    testedCommit: phase2TestedCommit,
    latestEvidenceAt: latestPhase2EvidenceAt,
  },
  repository: {
    clean: repositoryClean,
  },
  nextRequiredControl: eligibleForScopedPilot
    ? "Apply the separately approved deployment change only to the named pilot branch; this checker never changes a feature flag."
    : "Complete and review the Phase 3 release evidence without enabling attendance writes.",
  note: "This command is read-only and never connects to MongoDB or changes a feature flag.",
};

console.log(JSON.stringify(report, null, 2));

if (requireEvidence && !eligibleForScopedPilot) {
  process.exitCode = 1;
}
