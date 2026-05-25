import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import { serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { normalizePhone, registerSchema } from "@/lib/validations/auth.schema";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const parsed = registerSchema.parse(await request.json());
    const phone = parsed.phone ? normalizePhone(parsed.phone) : undefined;
    const email = parsed.email ? parsed.email.toLowerCase() : undefined;
    const existingUser = await User.findOne({
      $or: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
      ],
    });

    if (existingUser) {
      return fail("Phone number or email is already registered.", 409);
    }

    const password = await hashPassword(parsed.password);
    const user = await User.create({
      name: parsed.name,
      phone,
      email,
      password,
      role: parsed.role,
      studentClass:
        parsed.role === "student" && parsed.studentClass
          ? parsed.studentClass
          : undefined,
      approvalStatus: parsed.role === "teacher" ? "pending" : "approved",
    });

    return success(
      {
        user: serializeUser(user),
        message:
          parsed.role === "teacher"
            ? "Teacher account created. Admin approval is required before login."
            : "Student account created successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
