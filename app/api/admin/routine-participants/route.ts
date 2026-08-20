import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { User } from "@/lib/db/models/User";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    const role = request.nextUrl.searchParams.get("role");
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const batchId = request.nextUrl.searchParams.get("batchId")?.trim();
    if (role !== "teacher" && role !== "student") {
      return fail("Invalid participant role.", 400);
    }
    const search = q ? new RegExp(escapeRegex(q), "i") : undefined;
    const enrolledStudentIds = role === "student" && batchId
      ? await BatchEnrollment.distinct("studentId", { batchId, status: "active" })
      : undefined;
    const users = await User.find({
      role,
      isActive: true,
      approvalStatus: "approved",
      ...(role === "teacher" ? { isAbspMember: true } : {}),
      ...(search ? { $or: [{ name: search }, { reference: search }] } : {}),
      ...(enrolledStudentIds ? { _id: { $in: enrolledStudentIds } } : {}),
    })
      .select("name reference studentClass teacherDomain")
      .sort({ name: 1 })
      .limit(30)
      .lean();

    return success({
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        reference: user.reference,
        studentClass: user.studentClass,
        domainSubjects: role === "teacher"
          ? user.teacherDomain?.isAll
            ? ["Physics", "Chemistry", "Math", "Higher Math", "Physics 1st Paper", "Physics 2nd Paper", "Chemistry 1st Paper", "Chemistry 2nd Paper", "Higher Math 1st Paper", "Higher Math 2nd Paper", "ICT"]
            : user.teacherDomain?.subjects ?? []
          : undefined,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
