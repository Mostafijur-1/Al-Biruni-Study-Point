import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { getFocusStatus } from "@/lib/focus/service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    return success(
      await getFocusStatus({
        studentId: user.id,
        studentClass,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
