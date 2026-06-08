import { NextRequest } from "next/server";

import { serializeAdminUser } from "@/lib/admin/serialize-user";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { adminUpdateUserSchema } from "@/lib/validations/admin.schema";
import type { StudentClass } from "@/types";

type AdminUserRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: AdminUserRouteContext) {
  try {
    const admin = await requireAuth(request, ["admin"]);
    const { id } = await context.params;
    const parsed = adminUpdateUserSchema.parse(await request.json());

    await connectDB();

    const user = await User.findById(id);

    if (!user) {
      return fail("User not found.", 404);
    }

    if (user.role === "admin") {
      return fail("Admin accounts cannot be modified here.", 403);
    }

    if (String(user._id) === admin.id) {
      return fail("You cannot modify your own account from this panel.", 403);
    }

    if (parsed.isActive !== undefined) {
      user.isActive = parsed.isActive;
    }

    if (parsed.approvalStatus !== undefined && user.role === "teacher") {
      user.approvalStatus = parsed.approvalStatus;

      if (parsed.approvalStatus === "approved") {
        user.isActive = true;
      }

      if (parsed.approvalStatus === "rejected") {
        user.isActive = false;
      }
    }

    if (parsed.teacherDomain !== undefined && user.role === "teacher") {
      user.teacherDomain = {
        isAll: parsed.teacherDomain.isAll,
        classes: parsed.teacherDomain.classes as StudentClass[],
        subjects: parsed.teacherDomain.subjects.map((s: any) =>
          Array.isArray(s) ? String(s[0]) : String(s)
        ),
      };
    }

    await user.save();

    return success({ user: serializeAdminUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
