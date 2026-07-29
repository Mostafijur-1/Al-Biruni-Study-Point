import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { getScienceLabHub } from "@/lib/labs/service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    return success(await getScienceLabHub(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
