import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { resolvePostAuthRedirect } from "@/lib/auth/return-url";
import { setAuthCookies } from "@/lib/auth/set-auth-cookies";
import { serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { normalizePhone, studentRegisterBodySchema } from "@/lib/validations/auth.schema";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const parsed = studentRegisterBodySchema.parse(await request.json());
    const phone = normalizePhone(parsed.phone);
    const email = parsed.email ? parsed.email.toLowerCase() : undefined;

    const existingUser = await User.findOne({
      $or: [{ phone }, ...(email ? [{ email }] : [])],
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
      role: "student",
      studentClass: parsed.studentClass,
      schoolCollege: parsed.schoolCollege || undefined,
      reference: parsed.reference || undefined,
      approvalStatus: "approved",
    });

    const tokenPayload = {
      userId: String(user._id),
      role: user.role,
      phone: user.phone,
      email: user.email,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    user.refreshTokenHash = await hashPassword(refreshToken);
    await user.save();

    const response = success(
      {
        user: serializeUser(user),
        message: "Student account created successfully.",
        redirectTo: resolvePostAuthRedirect(user.role, parsed.returnUrl),
      },
      { status: 201 },
    );

    setAuthCookies(response, { accessToken, refreshToken }, user.role);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
