import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { getStudentMastery } from "@/lib/learning/mastery-service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const mastery = await getStudentMastery(user.id, studentClass);
    return success(mastery);
  } catch (error) {
    return handleApiError(error);
  }
}
