import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { assignTeacher, endTeacherAssignment } from "@/lib/academic-workflows";
import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { isSubjectWithinTeacherDomain } from "@/lib/auth/teacher-domain-rules";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import {
  TeacherAssignment,
  type ITeacherAssignment,
} from "@/lib/db/models/TeacherAssignment";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { Organization } from "@/lib/db/models/Organization";
import { User } from "@/lib/db/models/User";
import {
  teacherAssignmentListQuerySchema,
  teacherAssignmentMutationSchema,
} from "@/lib/validations/academic.schema";

type AssignmentContext = {
  batches: Map<string, { name: string; code?: string; studentClass?: string }>;
  subjects: Map<string, { name: string; nameBn: string; code: string }>;
  teachers: Map<string, { name: string }>;
  organizations: Map<string, { name: string; timezone: string }>;
};

function serializeAssignment(assignment: {
  _id: unknown;
  organizationId: unknown;
  branchId: unknown;
  academicSessionId: unknown;
  batchId: unknown;
  teacherId: unknown;
  subjectId: unknown;
  status: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  endReason?: string;
}, context?: AssignmentContext) {
  const batch = context?.batches.get(String(assignment.batchId));
  const subject = context?.subjects.get(String(assignment.subjectId));
  const teacher = context?.teachers.get(String(assignment.teacherId));
  const organization = context?.organizations.get(String(assignment.organizationId));
  return {
    id: String(assignment._id),
    organizationId: String(assignment.organizationId),
    branchId: String(assignment.branchId),
    academicSessionId: String(assignment.academicSessionId),
    batchId: String(assignment.batchId),
    teacherId: String(assignment.teacherId),
    subjectId: String(assignment.subjectId),
    status: assignment.status,
    effectiveFrom: assignment.effectiveFrom.toISOString(),
    effectiveTo: assignment.effectiveTo?.toISOString(),
    endReason: assignment.endReason,
    batch,
    subject,
    teacher,
    organization,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    const parsed = teacherAssignmentListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const domainOnly = request.nextUrl.searchParams.get("domainOnly") === "true";
    const query: QueryFilter<ITeacherAssignment> =
      parsed.status === "all" ? {} : { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.batchId) query.batchId = parsed.batchId;
    if (parsed.subjectId) query.subjectId = parsed.subjectId;
    if (actor.role === "teacher") query.teacherId = actor.id;
    else if (parsed.teacherId) query.teacherId = parsed.teacherId;

    const assignments = await TeacherAssignment.find(query)
      .sort({ effectiveFrom: -1 })
      .limit(parsed.limit)
      .lean();

    const [batches, subjects, teachers, organizations] = await Promise.all([
      Batch.find({ _id: { $in: assignments.map((item) => item.batchId) } })
        .select("name code studentClass")
        .lean(),
      AcademicSubject.find({ _id: { $in: assignments.map((item) => item.subjectId) } })
        .select("name nameBn code")
        .lean(),
      User.find({ _id: { $in: assignments.map((item) => item.teacherId) } })
        .select("name teacherDomain")
        .lean(),
      Organization.find({ _id: { $in: assignments.map((item) => item.organizationId) } })
        .select("name timezone")
        .lean(),
    ]);
    const context: AssignmentContext = {
      batches: new Map(batches.map((item) => [String(item._id), {
        name: item.name,
        code: item.code,
        studentClass: item.studentClass,
      }])),
      subjects: new Map(subjects.map((item) => [String(item._id), {
        name: item.name,
        nameBn: item.nameBn,
        code: item.code,
      }])),
      teachers: new Map(teachers.map((item) => [String(item._id), { name: item.name }])),
      organizations: new Map(organizations.map((item) => [String(item._id), {
        name: item.name,
        timezone: item.timezone,
      }])),
    };

    const visibleAssignments = domainOnly
      ? assignments.filter((assignment) => {
          const teacher = teachers.find((item) => String(item._id) === String(assignment.teacherId));
          const subject = context.subjects.get(String(assignment.subjectId));
          return Boolean(
            teacher &&
            subject &&
            (isSubjectWithinTeacherDomain(teacher.teacherDomain, subject.name) ||
              isSubjectWithinTeacherDomain(teacher.teacherDomain, subject.nameBn)),
          );
        })
      : assignments;

    return success({ assignments: visibleAssignments.map((item) => serializeAssignment(item, context)) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) {
      throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    }
    const parsed = teacherAssignmentMutationSchema.parse(await request.json());

    const assignment =
      parsed.action === "assign"
        ? await assignTeacher({
            request,
            actor,
            batchId: parsed.batchId,
            teacherId: parsed.teacherId,
            subjectId: parsed.subjectId,
            effectiveFrom: parsed.effectiveFrom ?? new Date(),
            reason: parsed.reason,
          })
        : await endTeacherAssignment({
            request,
            actor,
            assignmentId: parsed.assignmentId,
            effectiveAt: parsed.effectiveAt ?? new Date(),
            reason: parsed.reason,
          });

    return success(
      { assignment: serializeAssignment(assignment) },
      parsed.action === "assign" ? { status: 201 } : undefined,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
