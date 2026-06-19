import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth, serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { studentClassSchema } from "@/lib/validations/auth.schema";

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  studentClass: studentClassSchema.optional(),
  schoolCollege: z.string().trim().optional().or(z.literal("")),
  reference: z.string().trim().optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    return success({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const sessionUser = await requireAuth(request, ["admin", "teacher", "student"]);
    
    const user = await User.findById(sessionUser.id);
    if (!user) {
      return fail("User not found.", 404);
    }

    const body = await request.json();
    const parsed = updateProfileSchema.parse(body);

    if (parsed.name !== undefined) user.name = parsed.name;
    if (parsed.email !== undefined) user.email = parsed.email ? parsed.email.toLowerCase() : undefined;
    
    if (user.role === "student") {
      if (parsed.studentClass !== undefined) user.studentClass = parsed.studentClass;
      if (parsed.schoolCollege !== undefined) user.schoolCollege = parsed.schoolCollege || undefined;
      if (parsed.reference !== undefined) user.reference = parsed.reference || undefined;
    }

    await user.save();

    return success({ user: serializeUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
