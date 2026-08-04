import { readFile } from "node:fs/promises";

import mongoose from "mongoose";

import {
  academicBootstrapManifestSchema,
  resolveWorkspaceManifestPath,
} from "../lib/academic-bootstrap.ts";
import { AcademicSession } from "../lib/db/models/AcademicSession.ts";
import { AcademicSubject } from "../lib/db/models/AcademicSubject.ts";
import { Branch } from "../lib/db/models/Branch.ts";
import { MigrationRecord } from "../lib/db/models/MigrationRecord.ts";
import { Organization } from "../lib/db/models/Organization.ts";
import { User } from "../lib/db/models/User.ts";

const MIGRATION_ID = "20260804_phase2_academic_bootstrap_v1";
const applyRequested = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10);
const manifestArgument = process.argv.find((value) => value.startsWith("--manifest="))?.slice(11);

if (!manifestArgument) {
  throw new Error("A reviewed --manifest=<workspace-relative-json-path> is required.");
}

const workspaceRoot = process.cwd();
const { resolvedPath: manifestPath, relativePath: relativeManifestPath } =
  resolveWorkspaceManifestPath(workspaceRoot, manifestArgument);

const manifest = academicBootstrapManifestSchema.parse(
  JSON.parse(await readFile(manifestPath, "utf8")),
);
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");

await mongoose.connect(uri, { dbName: "absp" });

try {
  const [organization, existingRecord, students, teachersWithLegacyScope] = await Promise.all([
    Organization.findOne({ slug: manifest.organization.slug }).lean(),
    MigrationRecord.findOne({ migrationId: MIGRATION_ID }).lean(),
    User.countDocuments({ role: "student", isActive: true }),
    User.countDocuments({
      role: "teacher",
      $or: [
        { "teacherDomain.isAll": true },
        { "teacherDomain.classes.0": { $exists: true } },
        { "teacherDomain.subjects.0": { $exists: true } },
        { "teacherDomain.students.0": { $exists: true } },
      ],
    }),
  ]);
  const existingBranch = organization
    ? await Branch.findOne({
        organizationId: organization._id,
        code: manifest.branch.code.toUpperCase(),
      }).lean()
    : null;
  const existingSession = organization
    ? await AcademicSession.findOne({
        organizationId: organization._id,
        name: manifest.academicSession.name,
      }).lean()
    : null;
  const existingSubjectCount = organization
    ? await AcademicSubject.countDocuments({
        organizationId: organization._id,
        code: { $in: manifest.subjects.map((subject) => subject.code.toUpperCase()) },
      })
    : 0;

  const report = {
    migrationId: MIGRATION_ID,
    mode: applyRequested ? "apply" : "dry-run",
    manifest: relativeManifestPath,
    ledgerStatus: existingRecord?.status ?? "not-started",
    existing: {
      organization: Boolean(organization),
      branch: Boolean(existingBranch),
      academicSession: Boolean(existingSession),
      subjects: existingSubjectCount,
    },
    requestedSubjects: manifest.subjects.length,
    unresolvedLegacyMappings: {
      activeStudents: students,
      teachersWithLegacyScope,
    },
  };
  console.log(JSON.stringify(report, null, 2));

  if (!applyRequested) {
    console.log(`Dry run only. Use --apply --confirm=${MIGRATION_ID} after backup and manifest approval.`);
  } else {
    if (confirmation !== MIGRATION_ID) {
      throw new Error(`Apply requires --confirm=${MIGRATION_ID}.`);
    }
    if (existingRecord?.status === "completed") {
      console.log("Academic bootstrap already completed; no changes applied.");
    } else {
      await MigrationRecord.findOneAndUpdate(
        { migrationId: MIGRATION_ID },
        {
          $set: { status: "running", startedAt: new Date() },
          $unset: { completedAt: 1, error: 1, summary: 1 },
        },
        { upsert: true },
      );

      const dbSession = await mongoose.startSession();
      try {
        let summary: Record<string, unknown> = {};
        await dbSession.withTransaction(async () => {
          let organizationDoc = await Organization.findOne({
            slug: manifest.organization.slug,
          }).session(dbSession);
          if (!organizationDoc) {
            [organizationDoc] = await Organization.create([manifest.organization], {
              session: dbSession,
            });
          } else if (organizationDoc.name !== manifest.organization.name) {
            throw new Error("Existing organization slug has a different name.");
          }

          let branchDoc = await Branch.findOne({
            organizationId: organizationDoc._id,
            code: manifest.branch.code.toUpperCase(),
          }).session(dbSession);
          if (!branchDoc) {
            [branchDoc] = await Branch.create(
              [{ ...manifest.branch, organizationId: organizationDoc._id }],
              { session: dbSession },
            );
          } else if (branchDoc.name !== manifest.branch.name) {
            throw new Error("Existing branch code has a different name.");
          }

          let academicSessionDoc = await AcademicSession.findOne({
            organizationId: organizationDoc._id,
            name: manifest.academicSession.name,
          }).session(dbSession);
          if (!academicSessionDoc) {
            [academicSessionDoc] = await AcademicSession.create(
              [{ ...manifest.academicSession, organizationId: organizationDoc._id }],
              { session: dbSession },
            );
          } else if (
            academicSessionDoc.startsAt.getTime() !== manifest.academicSession.startsAt.getTime() ||
            academicSessionDoc.endsAt.getTime() !== manifest.academicSession.endsAt.getTime()
          ) {
            throw new Error("Existing academic session has different dates.");
          }

          let createdSubjects = 0;
          for (const subject of manifest.subjects) {
            const code = subject.code.toUpperCase();
            const existingSubject = await AcademicSubject.findOne({
              organizationId: organizationDoc._id,
              code,
            }).session(dbSession);
            if (existingSubject) {
              if (existingSubject.name !== subject.name || existingSubject.nameBn !== subject.nameBn) {
                throw new Error(`Existing subject ${code} has different names.`);
              }
              continue;
            }
            await AcademicSubject.create(
              [{ ...subject, code, organizationId: organizationDoc._id }],
              { session: dbSession },
            );
            createdSubjects += 1;
          }

          summary = {
            organizationId: String(organizationDoc._id),
            branchId: String(branchDoc._id),
            academicSessionId: String(academicSessionDoc._id),
            createdSubjects,
            unresolvedActiveStudents: students,
            unresolvedTeachersWithLegacyScope: teachersWithLegacyScope,
          };
          await MigrationRecord.updateOne(
            { migrationId: MIGRATION_ID },
            { $set: { status: "completed", completedAt: new Date(), summary } },
            { session: dbSession },
          );
        });
        console.log(JSON.stringify({ migrationId: MIGRATION_ID, status: "completed", summary }, null, 2));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await MigrationRecord.updateOne(
          { migrationId: MIGRATION_ID },
          { $set: { status: "failed", completedAt: new Date(), error: message } },
        );
        throw error;
      } finally {
        await dbSession.endSession();
      }
    }
  }
} finally {
  await mongoose.disconnect();
}
