import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import mongoose, { type Connection } from "mongoose";

import {
  assertReadOnlyPipeline,
  classifyRuntimeEnvironment,
  containsSensitiveConnectionMaterial,
  createDuplicatePipeline,
  createOrphanPipeline,
  duplicateChecks,
  evaluateWriteGateSafety,
  missingFieldFilter,
  orphanChecks,
  parseBooleanFlag,
  safeDatabaseFailure,
  scopeRequirements,
  type EvidenceState,
} from "../lib/architecture-readiness.ts";
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

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();
const strict = process.argv.includes("--strict");
const skipDatabase = process.argv.includes("--skip-database");
const environmentArgument = process.argv.find((value) => value.startsWith("--environment="))?.slice(14);
const databaseNameArgument = process.argv.find((value) => value.startsWith("--database="))?.slice(11);
const academicEvidenceArgument = process.argv.find((value) => value.startsWith("--academic-evidence="))?.slice(20)
  ?? "evidence/phase2-rollout-evidence.approved.json";
const attendanceEvidenceArgument = process.argv.find((value) => value.startsWith("--attendance-evidence="))?.slice(22)
  ?? "evidence/phase3-attendance-release.approved.json";
const authorizationArgument = process.argv.find((value) => value.startsWith("--attendance-authorization="))?.slice(27)
  ?? "evidence/phase3-attendance-authorization.approved.json";
const { resolvedPath: academicEvidencePath } = resolveWorkspaceEvidencePath(workspaceRoot, academicEvidenceArgument);
const { resolvedPath: attendanceEvidencePath } = resolveWorkspacePhase3ReleaseEvidencePath(workspaceRoot, attendanceEvidenceArgument);
const { resolvedPath: authorizationPath } = resolveWorkspaceAuthorizationPath(workspaceRoot, authorizationArgument);

async function gitState() {
  try {
    const safeRoot = workspaceRoot.replaceAll("\\", "/");
    const currentCommit = (await execFileAsync(
      "git",
      ["-c", `safe.directory=${safeRoot}`, "rev-parse", "HEAD"],
      { cwd: workspaceRoot },
    )).stdout.trim();
    const clean = (await execFileAsync(
      "git",
      ["-c", `safe.directory=${safeRoot}`, "status", "--porcelain"],
      { cwd: workspaceRoot },
    )).stdout.trim().length === 0;
    return { currentCommit, clean };
  } catch {
    return { clean: false };
  }
}

async function readJson(path: string) {
  try {
    await access(path);
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

async function evaluateEvidence(repository: Awaited<ReturnType<typeof gitState>>) {
  let academicState: EvidenceState = "missing";
  let attendanceState: EvidenceState = "missing";
  let academicEvidence: ReturnType<typeof academicRolloutEvidenceSchema.parse> | undefined;
  let authorization: ReturnType<typeof phase3AuthorizationSchema.parse> | undefined;

  const rawAcademic = await readJson(academicEvidencePath);
  if (rawAcademic !== undefined) {
    const parsed = academicRolloutEvidenceSchema.safeParse(rawAcademic);
    if (!parsed.success) academicState = "invalid";
    else {
      academicEvidence = parsed.data;
      if (!repository.currentCommit) academicState = "unverifiable";
      else if (!rolloutEvidenceMatchesCommit(parsed.data.testedCommit, repository.currentCommit)) academicState = "stale";
      else if (!repository.clean) academicState = "dirty-worktree";
      else academicState = "valid";
    }
  }

  const rawAuthorization = await readJson(authorizationPath);
  if (rawAuthorization !== undefined) {
    const parsed = phase3AuthorizationSchema.safeParse(rawAuthorization);
    if (parsed.success) authorization = parsed.data;
  }

  const rawAttendance = await readJson(attendanceEvidencePath);
  if (rawAttendance !== undefined) {
    const parsed = phase3ReleaseEvidenceSchema.safeParse(rawAttendance);
    if (!parsed.success) attendanceState = "invalid";
    else if (!repository.currentCommit || !academicEvidence || !authorization) attendanceState = "unverifiable";
    else {
      let baseIsAncestor = false;
      try {
        await execFileAsync(
          "git",
          [
            "-c",
            `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`,
            "merge-base",
            "--is-ancestor",
            authorization.authorizedBaseCommit,
            repository.currentCommit,
          ],
          { cwd: workspaceRoot },
        );
        baseIsAncestor = true;
      } catch {
        baseIsAncestor = false;
      }
      const chainValid =
        phase3ReleaseEvidenceMatchesCommit(parsed.data.releaseCommit, repository.currentCommit) &&
        parsed.data.authorizedBaseCommit === authorization.authorizedBaseCommit &&
        rolloutEvidenceMatchesCommit(academicEvidence.testedCommit, authorization.authorizedBaseCommit) &&
        phase3AuthorizationFollowsEvidence(
          authorization.approvedAt,
          latestAcademicRolloutEvidenceTimestamp(academicEvidence),
        ) &&
        baseIsAncestor;
      if (!chainValid) attendanceState = "stale";
      else if (!repository.clean) attendanceState = "dirty-worktree";
      else {
        attendanceState = "valid";
        // A valid attendance release proves the descendant still carries the
        // approved academic base even when Phase 2 evidence names that base.
        academicState = "valid";
      }
    }
  }

  return { academicState, attendanceState };
}

function collectionExists(collectionNames: Set<string>, name: string) {
  return collectionNames.has(name);
}

async function collectDatabaseBaseline(connection: Connection) {
  const database = connection.db;
  if (!database) throw new Error("MongoDB connection has no database handle.");
  const collectionInfos = await database.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = new Set(
    collectionInfos.map((item) => item.name).filter((name) => !name.startsWith("system.")),
  );
  const collections = [];
  for (const name of [...collectionNames].sort()) {
    const collection = database.collection(name);
    const [documentCount, indexes] = await Promise.all([
      collection.estimatedDocumentCount(),
      collection.listIndexes().toArray(),
    ]);
    collections.push({
      name,
      documentCount,
      indexNames: indexes.map((index) => index.name).filter(Boolean).sort(),
    });
  }

  const missingScope = [];
  for (const requirement of scopeRequirements) {
    if (!collectionExists(collectionNames, requirement.collection)) {
      missingScope.push({ collection: requirement.collection, state: "collection-missing", fields: {} });
      continue;
    }
    const collection = database.collection(requirement.collection);
    const fields: Record<string, number> = {};
    for (const field of requirement.fields) {
      fields[field] = await collection.countDocuments(missingFieldFilter(field));
    }
    missingScope.push({ collection: requirement.collection, state: "measured", fields });
  }

  const orphans = [];
  for (const check of orphanChecks) {
    if (!collectionExists(collectionNames, check.collection) || !collectionExists(collectionNames, check.targetCollection)) {
      orphans.push({ id: check.id, state: "collection-missing", count: 0 });
      continue;
    }
    const pipeline = assertReadOnlyPipeline(createOrphanPipeline(check));
    const [result] = await database.collection(check.collection).aggregate<{ count: number }>(pipeline).toArray();
    orphans.push({ id: check.id, state: "measured", count: result?.count ?? 0 });
  }

  const duplicates = [];
  for (const check of duplicateChecks) {
    if (!collectionExists(collectionNames, check.collection)) {
      duplicates.push({ id: check.id, state: "collection-missing", duplicateGroupCount: 0, affectedDocumentCount: 0 });
      continue;
    }
    const pipeline = assertReadOnlyPipeline(createDuplicatePipeline(check));
    const [result] = await database.collection(check.collection).aggregate<{
      duplicateGroupCount: number;
      affectedDocumentCount: number;
    }>(pipeline).toArray();
    duplicates.push({
      id: check.id,
      state: "measured",
      duplicateGroupCount: result?.duplicateGroupCount ?? 0,
      affectedDocumentCount: result?.affectedDocumentCount ?? 0,
    });
  }

  const count = async (collection: string, filter: Record<string, unknown>) =>
    collectionExists(collectionNames, collection)
      ? database.collection(collection).countDocuments(filter)
      : 0;
  const legacyVsCanonical = {
    teachersWithLegacyDomain: await count("users", { role: "teacher", teacherDomain: { $exists: true } }),
    activeCanonicalTeacherAssignments: await count("teacherassignments", { status: "active" }),
    legacyPracticeQuestions: await count("practicequestions", { subject: { $type: "string" } }),
    canonicalPracticeQuestions: await count("practicequestions", { subjectId: { $exists: true, $ne: null } }),
    legacyMcqExams: await count("mcqexams", { subject: { $type: "string" } }),
    canonicalMcqExams: await count("mcqexams", { subjectId: { $exists: true, $ne: null } }),
    legacyCourses: await count("courses", { subject: { $type: "string" } }),
    canonicalCourses: await count("courses", { subjectId: { $exists: true, $ne: null } }),
    legacyVideos: await count("videos", { subject: { $type: "string" } }),
    canonicalVideos: await count("videos", { subjectId: { $exists: true, $ne: null } }),
    legacyRoutineParticipantSnapshots: await count("routineslots", { "studentIds.0": { $exists: true } }),
    canonicalBatchSubjectRoutines: await count("routineslots", { batchId: { $exists: true, $ne: null }, subjectId: { $exists: true, $ne: null } }),
  };

  const hello = await database.admin().command({ hello: 1 });
  return {
    status: "available" as const,
    topology: {
      replicaSet: typeof hello.setName === "string",
      logicalSessions: typeof hello.logicalSessionTimeoutMinutes === "number",
      transactionCapable: typeof hello.setName === "string" && typeof hello.logicalSessionTimeoutMinutes === "number",
      maxWireVersion: typeof hello.maxWireVersion === "number" ? hello.maxWireVersion : undefined,
    },
    collections,
    missingScope,
    orphans,
    duplicates,
    legacyVsCanonical,
  };
}

async function databaseBaseline() {
  if (skipDatabase) return { status: "skipped" as const, detail: "Database inspection skipped by explicit option." };
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return safeDatabaseFailure();
  const connection = mongoose.createConnection(uri, {
    autoIndex: false,
    bufferCommands: false,
    connectTimeoutMS: 10_000,
    dbName: databaseNameArgument || "absp",
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 15_000,
  });
  const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("Database baseline timed out.")), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
  try {
    await withTimeout(connection.asPromise(), 15_000);
    return await withTimeout(collectDatabaseBaseline(connection), 45_000);
  } catch {
    return safeDatabaseFailure();
  } finally {
    await Promise.race([
      connection.destroy().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}

const repository = await gitState();
const evidence = await evaluateEvidence(repository);
const writeGates = evaluateWriteGateSafety({
  academicWritesEnabled: parseBooleanFlag(process.env.ACADEMIC_WRITES_ENABLED),
  attendanceWritesEnabled: parseBooleanFlag(process.env.ATTENDANCE_WRITES_ENABLED),
  academicEvidenceState: evidence.academicState,
  attendanceEvidenceState: evidence.attendanceState,
});
const database = await databaseBaseline();
const environment = classifyRuntimeEnvironment({
  requested: environmentArgument,
  vercel: process.env.VERCEL_ENV,
  node: process.env.NODE_ENV,
});
const blockers = [...writeGates.blockers];
if (database.status === "unavailable") blockers.push(database.detail);
if (environment === "unknown") blockers.push("Runtime environment is not explicitly classified.");

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? "ready" : "blocked",
  environment,
  repository: {
    commit: repository.currentCommit,
    clean: repository.clean,
  },
  writeGates,
  database,
  blockers,
  safety: {
    readOnly: true,
    samplesIncluded: false,
    connectionDetailsIncluded: false,
  },
};

if (containsSensitiveConnectionMaterial(report)) {
  throw new Error("Architecture readiness report unexpectedly contains connection material.");
}

const exitCode = (strict || writeGates.status === "blocked") && blockers.length > 0 ? 1 : 0;
await new Promise<void>((resolve) => {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => resolve());
});
// DNS/SRV resolution can retain a driver handle after a bounded connection failure.
// This dedicated CLI has completed all reads and flushed its only output, so exit explicitly.
process.exit(exitCode);
