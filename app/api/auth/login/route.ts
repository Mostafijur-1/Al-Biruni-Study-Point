import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { setAuthCookies } from "@/lib/auth/set-auth-cookies";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { loginSchema, normalizePhone } from "@/lib/validations/auth.schema";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const parsed = loginSchema.parse(await request.json());
    const identifier = parsed.identifier.trim();
    const isEmail = identifier.includes("@");
    const user = await User.findOne(
      isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: normalizePhone(identifier) },
    ).select("+password +refreshTokenHash");

    if (!user) {
      return fail("Invalid phone/email or password.", 401);
    }

    const isPasswordValid = await verifyPassword(parsed.password, user.password);

    if (!isPasswordValid) {
      return fail("Invalid phone/email or password.", 401);
    }

    if (!user.isActive) {
      return fail("This account is inactive.", 403);
    }

    if (user.role === "teacher" && user.approvalStatus !== "approved") {
      return fail("Teacher account is pending admin approval.", 403);
    }

    const payload = {
      userId: String(user._id),
      role: user.role,
      phone: user.phone,
      email: user.email,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshTokenHash = await hashPassword(refreshToken);
    await user.save();

    const response = success({
      user: serializeUser(user),
      redirectTo: `/${user.role}`,
    });

    setAuthCookies(response, { accessToken, refreshToken }, user.role);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
