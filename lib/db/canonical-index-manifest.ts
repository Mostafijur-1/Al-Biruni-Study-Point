export type CanonicalIndexDefinition = {
  id: string;
  collection: string;
  keys: Readonly<Record<string, 1 | -1>>;
  options: Readonly<{
    name: string;
    unique?: boolean;
    sparse?: boolean;
    partialFilterExpression?: Record<string, unknown>;
  }>;
};

export const LEGACY_BATCH_SCOPE_INDEX_NAME = "branchId_1_academicSessionId_1_code_1";

export const BATCH_SCOPE_CODE_INDEX: CanonicalIndexDefinition = {
  id: "batch.scope-code",
  collection: "batches",
  keys: { branchId: 1, academicSessionId: 1, code: 1 },
  options: {
    name: "uq_batch_scope_code_canonical",
    unique: true,
    partialFilterExpression: {
      branchId: { $type: "objectId" },
      academicSessionId: { $type: "objectId" },
      code: { $type: "string" },
    },
  },
};

export const canonicalIntegrityIndexManifest: readonly CanonicalIndexDefinition[] = [
  { id: "organization.slug", collection: "organizations", keys: { slug: 1 }, options: { name: "slug_1", unique: true } },
  { id: "branch.organization-code", collection: "branches", keys: { organizationId: 1, code: 1 }, options: { name: "organizationId_1_code_1", unique: true } },
  { id: "session.organization-name", collection: "academicsessions", keys: { organizationId: 1, name: 1 }, options: { name: "organizationId_1_name_1", unique: true } },
  { id: "subject.organization-code", collection: "academicsubjects", keys: { organizationId: 1, code: 1 }, options: { name: "organizationId_1_code_1", unique: true } },
  { id: "chapter.subject-code", collection: "academicchapters", keys: { subjectId: 1, code: 1 }, options: { name: "subjectId_1_code_1", unique: true } },
  { id: "topic.chapter-code", collection: "academictopics", keys: { chapterId: 1, code: 1 }, options: { name: "chapterId_1_code_1", unique: true } },
  BATCH_SCOPE_CODE_INDEX,
  { id: "enrollment.active-student-session", collection: "batchenrollments", keys: { organizationId: 1, academicSessionId: 1, studentId: 1 }, options: { name: "organizationId_1_academicSessionId_1_studentId_1", unique: true, partialFilterExpression: { status: "active" } } },
  { id: "assignment.active-batch-teacher-subject", collection: "teacherassignments", keys: { batchId: 1, teacherId: 1, subjectId: 1 }, options: { name: "batchId_1_teacherId_1_subjectId_1", unique: true, partialFilterExpression: { status: "active" } } },
  { id: "class-session.routine-occurrence", collection: "classsessions", keys: { routineSlotId: 1, scheduledStart: 1 }, options: { name: "routineSlotId_1_scheduledStart_1", unique: true, sparse: true } },
  { id: "attendance-sheet.class-session", collection: "attendancesheets", keys: { classSessionId: 1 }, options: { name: "classSessionId_1", unique: true } },
  { id: "attendance-record.sheet-enrollment", collection: "attendancerecords", keys: { sheetId: 1, enrollmentId: 1 }, options: { name: "sheetId_1_enrollmentId_1", unique: true } },
  { id: "attendance-record.sheet-student", collection: "attendancerecords", keys: { sheetId: 1, studentId: 1 }, options: { name: "sheetId_1_studentId_1", unique: true } },
  { id: "written-result.exam-student", collection: "writtenexamresults", keys: { examId: 1, studentId: 1 }, options: { name: "examId_1_studentId_1", unique: true } },
] as const;

export function duplicateCandidatePipeline(index: CanonicalIndexDefinition) {
  const partial = index.options.partialFilterExpression;
  const groupId = Object.fromEntries(Object.keys(index.keys).map((field) => [field, `$${field}`]));
  return [
    ...(partial ? [{ $match: partial }] : []),
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $group: { _id: null, duplicateGroupCount: { $sum: 1 }, affectedDocumentCount: { $sum: "$count" } } },
    { $project: { _id: 0, duplicateGroupCount: 1, affectedDocumentCount: 1 } },
  ];
}
