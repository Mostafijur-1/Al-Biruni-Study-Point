import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { containsSensitiveConnectionMaterial } from "../lib/architecture-readiness.ts";
import { deprecatedAuthorities, evaluateLegacyContractionEvidence, legacyContractionEvidenceSchema, resolveLegacyEvidencePath } from "../lib/legacy-contraction.ts";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const strict = process.argv.includes("--strict");
const skipDatabase = process.argv.includes("--skip-database");
const value = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const environment = value("environment");
const databaseName = value("database");
const evidencePath = resolveLegacyEvidencePath(root, value("evidence") ?? "evidence/legacy-contraction.approved.json");
if (!environment || !["development", "test", "staging", "production"].includes(environment)) throw new Error("Use an explicit --environment target.");
if (!skipDatabase && (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName))) throw new Error("Database inspection requires an explicit --database target.");

const safeRoot = root.replaceAll("\\", "/");
const commit = (await execFileAsync("git", ["-c", `safe.directory=${safeRoot}`, "rev-parse", "HEAD"], { cwd: root })).stdout.trim();
const tracked = (await execFileAsync("git", ["-c", `safe.directory=${safeRoot}`, "ls-files", "app", "lib", "components"], { cwd: root })).stdout.split(/\r?\n/).filter((file) => /\.(ts|tsx)$/.test(file));
const patterns = {
  "teacher-domain": /teacherDomain/g,
  "string-curriculum": /\b(subject|chapter|studentClass)\s*:/g,
  "duplicate-results": /\b(PracticeResult|McqExamAttempt|WrittenExamResult)\b/g,
  "embedded-binaries": /questionFile(?:\.|\?\.)?(?:data|contentType|fileName)|questionFile\s*:/g,
} as const;
const staticReferences: Record<string, { files: number; occurrences: number }> = {};
for (const authority of deprecatedAuthorities) {
  let files = 0; let occurrences = 0;
  for (const file of tracked) {
    const source = await readFile(`${root}/${file}`, "utf8");
    const count = source.match(patterns[authority.id])?.length ?? 0;
    if (count) { files += 1; occurrences += count; }
  }
  staticReferences[authority.id] = { files, occurrences };
}

let database: { status: "skipped" } | { status: "available"; legacyRecordCounts: Record<string, number> } | { status: "unavailable"; detail: string } = { status: "skipped" };
if (!skipDatabase) {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) database = { status: "unavailable", detail: "Database baseline unavailable. Verify MONGODB_URI and network policy." };
  else {
    const connection = mongoose.createConnection(uri, { dbName: databaseName, autoIndex: false, bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
    try {
      await connection.asPromise();
      const db = connection.db;
      if (!db) throw new Error("No database handle.");
      const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
      const count = (collection: string, filter: Record<string, unknown>) => names.has(collection) ? db.collection(collection).countDocuments(filter) : Promise.resolve(0);
      database = { status: "available", legacyRecordCounts: {
        teacherDomain: await count("users", { role: "teacher", teacherDomain: { $exists: true } }),
        stringCurriculum: (await count("courses", { subject: { $type: "string" } })) + (await count("practicequestions", { subject: { $type: "string" } })) + (await count("mcqexams", { subject: { $type: "string" } })),
        duplicateResultsWithoutAuthority: (await count("practiceresults", { authoritativeAttempt: { $exists: false } })) + (await count("mcqexamattempts", { assessmentAttemptId: { $exists: false } })) + (await count("writtenexamresults", { publicationId: { $exists: false } })),
        embeddedWrittenBinaries: await count("writtenexams", { "questionFile.data": { $exists: true } }),
      } };
    } catch { database = { status: "unavailable", detail: "Database baseline unavailable. Verify MONGODB_URI and network policy." }; }
    finally { await connection.destroy().catch(() => undefined); }
  }
}

let evidence: { state: string; evaluation?: ReturnType<typeof evaluateLegacyContractionEvidence> } = { state: "missing" };
try {
  await access(evidencePath);
  const parsed = legacyContractionEvidenceSchema.safeParse(JSON.parse(await readFile(evidencePath, "utf8")));
  evidence = parsed.success ? { state: "valid-shape", evaluation: evaluateLegacyContractionEvidence(parsed.data, commit) } : { state: "invalid" };
} catch { /* missing evidence remains a blocker */ }
const blockers = [
  ...(evidence.evaluation?.blockers ?? ["Approved production contraction evidence is missing or invalid."]),
  ...(database.status === "unavailable" ? [database.detail] : []),
];
if (!evidence.evaluation?.eligible) blockers.push("Deprecated authority must remain available; contraction is not authorized.");
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), environment, commit, status: blockers.length ? "blocked" : "eligible", staticReferences, database, evidence, blockers, safety: { readOnly: true, samplesIncluded: false, connectionDetailsIncluded: false } };
if (containsSensitiveConnectionMaterial(report)) throw new Error("Legacy readiness report unexpectedly contains connection material.");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (strict && blockers.length) process.exitCode = 1;
