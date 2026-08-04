import { NextRequest } from "next/server";

import { classFilterForStudent } from "@/lib/content/classes";
import { applyGuestClassFilter } from "@/lib/content/guest-scope.server";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { CqAssignment } from "@/lib/db/models/CqAssignment";
import { createCqAssignmentSchema } from "@/lib/validations/cq.schema";
import { authorizeTeacherContentScope } from "@/lib/auth/teacher-domain-policy";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope");
    const query: Record<string, unknown> = {};

    const guestError = applyGuestClassFilter(
      scope,
      searchParams.get("class"),
      query,
      "isPublished",
    );

    if (guestError) {
      return guestError;
    }

    if (scope === "student") {
      const user = await requireAuth(request, ["student"]);
      const studentClass = requireStudentClass(user);

      query.isPublished = true;
      Object.assign(query, classFilterForStudent(studentClass));
    } else if (scope !== "guest") {
      const user = await requireAuth(request, ["admin", "teacher"]);

      if (user.role === "teacher") {
        query.teacher = user.id;
      }
    }

    const assignments = await CqAssignment.find(query).sort({ createdAt: -1 }).limit(100).lean();

    return success({ assignments: assignments.map(mapDocWithTargetClasses) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const parsed = createCqAssignmentSchema.parse(await request.json());

    await connectDB();

    if (user.role === "teacher") {
      if (!parsed.subject) return fail("Subject is required for teacher content.", 400);
      const decision = await authorizeTeacherContentScope(
        user.id,
        parsed.targetClasses,
        parsed.subject,
      );
      if (!decision.ok) return fail(decision.message, decision.status);
    }

    const assignment = await CqAssignment.create({
      title: parsed.title,
      description: parsed.description || undefined,
      subject: parsed.subject,
      targetClasses: parsed.targetClasses,
      teacher: user.id,
      totalMarks: parsed.totalMarks,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
      isPublished: parsed.isPublished,
    });

    await CqAssignment.updateOne(
      { _id: assignment._id },
      { $set: { targetClasses: parsed.targetClasses } },
    );

    const saved = await CqAssignment.findById(assignment._id).lean();

    return success(
      {
        assignment: saved
          ? mapDocWithTargetClasses(saved)
          : mapDocWithTargetClasses(assignment.toObject()),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
