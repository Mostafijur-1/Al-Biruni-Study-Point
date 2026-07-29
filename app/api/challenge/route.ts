import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { getDailyChallengeStatus } from "@/lib/challenge/service";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    return success(
      await getDailyChallengeStatus({
        studentId: user.id,
        studentClass,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
