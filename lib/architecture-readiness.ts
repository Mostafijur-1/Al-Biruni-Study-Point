export type RuntimeEnvironment = "development" | "test" | "staging" | "production" | "unknown";

export type EvidenceState = "valid" | "missing" | "invalid" | "stale" | "dirty-worktree" | "unverifiable";

export type WriteGateInput = {
  academicWritesEnabled: boolean;
  attendanceWritesEnabled: boolean;
  academicEvidenceState: EvidenceState;
  attendanceEvidenceState: EvidenceState;
};

export type ScopeRequirement = {
  collection: string;
  fields: readonly string[];
};

export type OrphanCheck = {
  id: string;
  collection: string;
  field: string;
  targetCollection: string;
};

export type DuplicateCheck = {
  id: string;
  collection: string;
  fields: readonly string[];
  match?: Record<string, unknown>;
};

export const scopeRequirements: readonly ScopeRequirement[] = [
  { collection: "branches", fields: ["organizationId"] },
  { collection: "academicsessions", fields: ["organizationId"] },
  { collection: "academicsubjects", fields: ["organizationId"] },
  { collection: "academicchapters", fields: ["organizationId", "subjectId"] },
  { collection: "academictopics", fields: ["organizationId", "subjectId", "chapterId"] },
  { collection: "batches", fields: ["organizationId", "branchId", "academicSessionId"] },
  { collection: "batchenrollments", fields: ["organizationId", "branchId", "academicSessionId"] },
  { collection: "teacherassignments", fields: ["organizationId", "branchId", "academicSessionId"] },
  { collection: "routineslots", fields: ["organizationId", "branchId", "academicSessionId", "batchId", "subjectId"] },
  { collection: "classsessions", fields: ["organizationId", "branchId", "academicSessionId", "batchId", "subjectId"] },
  { collection: "attendancesheets", fields: ["organizationId", "branchId", "academicSessionId", "batchId", "subjectId"] },
  { collection: "attendancerecords", fields: ["organizationId", "branchId"] },
  { collection: "writtenexams", fields: ["organizationId", "branchId", "academicSessionId"] },
] as const;

export const orphanChecks: readonly OrphanCheck[] = [
  { id: "branch.organization", collection: "branches", field: "organizationId", targetCollection: "organizations" },
  { id: "session.organization", collection: "academicsessions", field: "organizationId", targetCollection: "organizations" },
  { id: "subject.organization", collection: "academicsubjects", field: "organizationId", targetCollection: "organizations" },
  { id: "chapter.subject", collection: "academicchapters", field: "subjectId", targetCollection: "academicsubjects" },
  { id: "topic.chapter", collection: "academictopics", field: "chapterId", targetCollection: "academicchapters" },
  { id: "batch.branch", collection: "batches", field: "branchId", targetCollection: "branches" },
  { id: "batch.session", collection: "batches", field: "academicSessionId", targetCollection: "academicsessions" },
  { id: "enrollment.batch", collection: "batchenrollments", field: "batchId", targetCollection: "batches" },
  { id: "enrollment.student", collection: "batchenrollments", field: "studentId", targetCollection: "users" },
  { id: "assignment.batch", collection: "teacherassignments", field: "batchId", targetCollection: "batches" },
  { id: "assignment.teacher", collection: "teacherassignments", field: "teacherId", targetCollection: "users" },
  { id: "assignment.subject", collection: "teacherassignments", field: "subjectId", targetCollection: "academicsubjects" },
  { id: "routine.batch", collection: "routineslots", field: "batchId", targetCollection: "batches" },
  { id: "routine.teacher", collection: "routineslots", field: "teacherId", targetCollection: "users" },
  { id: "routine.subject", collection: "routineslots", field: "subjectId", targetCollection: "academicsubjects" },
  { id: "class-session.batch", collection: "classsessions", field: "batchId", targetCollection: "batches" },
  { id: "class-session.teacher", collection: "classsessions", field: "teacherId", targetCollection: "users" },
  { id: "class-session.subject", collection: "classsessions", field: "subjectId", targetCollection: "academicsubjects" },
  { id: "attendance-sheet.class-session", collection: "attendancesheets", field: "classSessionId", targetCollection: "classsessions" },
  { id: "attendance-record.sheet", collection: "attendancerecords", field: "sheetId", targetCollection: "attendancesheets" },
  { id: "attendance-record.enrollment", collection: "attendancerecords", field: "enrollmentId", targetCollection: "batchenrollments" },
  { id: "written-exam.batch", collection: "writtenexams", field: "batchId", targetCollection: "batches" },
  { id: "written-exam.subject", collection: "writtenexams", field: "subjectId", targetCollection: "academicsubjects" },
  { id: "written-result.exam", collection: "writtenexamresults", field: "examId", targetCollection: "writtenexams" },
  { id: "written-result.student", collection: "writtenexamresults", field: "studentId", targetCollection: "users" },
] as const;

export const duplicateChecks: readonly DuplicateCheck[] = [
  { id: "batch.scope-code", collection: "batches", fields: ["branchId", "academicSessionId", "code"] },
  { id: "user.phone", collection: "users", fields: ["phone"], match: { phone: { $exists: true, $nin: [null, ""] } } },
  { id: "user.email", collection: "users", fields: ["email"], match: { email: { $exists: true, $nin: [null, ""] } } },
  { id: "user.student-code", collection: "users", fields: ["studentCode"], match: { studentCode: { $exists: true, $nin: [null, ""] } } },
  { id: "active-enrollment.student-session", collection: "batchenrollments", fields: ["organizationId", "academicSessionId", "studentId"], match: { status: "active" } },
  { id: "active-assignment.batch-teacher-subject", collection: "teacherassignments", fields: ["batchId", "teacherId", "subjectId"], match: { status: "active" } },
  { id: "written-result.exam-student", collection: "writtenexamresults", fields: ["examId", "studentId"] },
] as const;

export function parseBooleanFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function classifyRuntimeEnvironment(input: {
  requested?: string;
  vercel?: string;
  node?: string;
}): RuntimeEnvironment {
  const value = (input.requested || input.vercel || input.node || "").trim().toLowerCase();
  if (value === "preview") return "staging";
  if (["development", "test", "staging", "production"].includes(value)) {
    return value as RuntimeEnvironment;
  }
  return "unknown";
}

export function evaluateWriteGateSafety(input: WriteGateInput) {
  const academicSafe = !input.academicWritesEnabled || input.academicEvidenceState === "valid";
  const attendanceSafe = !input.attendanceWritesEnabled || (
    academicSafe &&
    input.academicEvidenceState === "valid" &&
    input.attendanceEvidenceState === "valid"
  );
  const blockers: string[] = [];

  if (!academicSafe) {
    blockers.push("Academic writes are enabled without valid commit-bound rollout evidence.");
  }
  if (!attendanceSafe) {
    blockers.push("Attendance writes are enabled without valid academic and attendance release evidence.");
  }

  return {
    status: blockers.length === 0 ? "safe" as const : "blocked" as const,
    academic: {
      enabled: input.academicWritesEnabled,
      evidenceState: input.academicEvidenceState,
      safe: academicSafe,
    },
    attendance: {
      enabled: input.attendanceWritesEnabled,
      evidenceState: input.attendanceEvidenceState,
      safe: attendanceSafe,
    },
    blockers,
  };
}

export function missingFieldFilter(field: string): Record<string, unknown> {
  return { $or: [{ [field]: { $exists: false } }, { [field]: null }] };
}

export function createOrphanPipeline(check: OrphanCheck) {
  return [
    { $match: { [check.field]: { $exists: true, $ne: null } } },
    { $lookup: { from: check.targetCollection, localField: check.field, foreignField: "_id", as: "__target" } },
    { $match: { "__target.0": { $exists: false } } },
    { $count: "count" },
  ];
}

export function createDuplicatePipeline(check: DuplicateCheck) {
  const groupId = Object.fromEntries(check.fields.map((field) => [field, `$${field}`]));
  return [
    ...(check.match ? [{ $match: check.match }] : []),
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $group: { _id: null, duplicateGroupCount: { $sum: 1 }, affectedDocumentCount: { $sum: "$count" } } },
    { $project: { _id: 0, duplicateGroupCount: 1, affectedDocumentCount: 1 } },
  ];
}

export function assertReadOnlyPipeline(pipeline: readonly Record<string, unknown>[]) {
  const serialized = JSON.stringify(pipeline).toLowerCase();
  if (serialized.includes('"$out"') || serialized.includes('"$merge"')) {
    throw new Error("Architecture baseline pipelines must be read-only.");
  }
  return [...pipeline];
}

export function safeDatabaseFailure() {
  return {
    status: "unavailable" as const,
    detail: "Database baseline unavailable. Verify MONGODB_URI, database access, and network policy.",
  };
}

export function containsSensitiveConnectionMaterial(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  return ["mongodb://", "mongodb+srv://", "password=", "authsource=", "@cluster"].some((token) =>
    serialized.includes(token),
  );
}
