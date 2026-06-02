import { NextRequest } from "next/server";

import { serializeAdminUser } from "@/lib/admin/serialize-user";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    const { searchParams } = request.nextUrl;
    const role = searchParams.get("role") as UserRole | null;

    if (role !== "student" && role !== "teacher") {
      return fail("role must be student or teacher.", 400);
    }

    const users = await User.find({ role })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return success({ users: users.map(serializeAdminUser) });
  } catch (error) {
    return handleApiError(error);
  }
}
