import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    return success({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
