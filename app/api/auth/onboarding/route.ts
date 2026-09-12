import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { resolvePostAuthRedirect } from "@/lib/auth/return-url";
import { serializeUser, requireAuth } from "@/lib/auth/session";
import { normalizeSessionVersion } from "@/lib/auth/session-version";
import { setAuthCookies } from "@/lib/auth/set-auth-cookies";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { normalizePhone, studentClassSchema } from "@/lib/validations/auth.schema";

const phoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
const onboardingSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("class"), studentClass: studentClassSchema }),
  z.object({ step: z.literal("phone"), phone: z.string().trim().refine((value) => phoneRegex.test(value), { message: "Use a valid Bangladeshi phone number." }) }),
  z.object({ step: z.literal("schoolCollege"), value: z.string().trim().max(160) }),
  z.object({ step: z.literal("reference"), value: z.string().trim().max(160), returnUrl: z.string().trim().optional() }),
]);

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const session = await requireAuth(request, ["student"]);
    const parsed = onboardingSchema.parse(await request.json());
    const user = await User.findById(session.id).select("+refreshTokenHash +googleId");
    if (!user) return fail("User not found.", 404);

    if (parsed.step === "class") {
      user.studentClass = parsed.studentClass;
    } else if (parsed.step === "phone") {
      if (!user.studentClass) return fail("Choose your class first.", 400);
      const phone = normalizePhone(parsed.phone);
      if (await User.exists({ phone, _id: { $ne: user._id } })) {
        return fail("This phone number is already registered.", 409);
      }
      user.phone = phone;
    } else {
      if (!user.studentClass || !user.phone) return fail("Class and phone number are required before continuing.", 400);
      if (parsed.step === "schoolCollege") user.schoolCollege = parsed.value || undefined;
      else {
        user.reference = parsed.value || undefined;
        user.onboardingCompletedAt = new Date();
      }
    }

    await user.save();
    if (parsed.step !== "reference") return success({ user: serializeUser(user) });

    const sessionVersion = normalizeSessionVersion(user.sessionVersion);
    const tokenPayload = { userId: String(user._id), role: user.role, sessionVersion, phone: user.phone, email: user.email, onboardingComplete: true };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    user.refreshTokenHash = await hashPassword(refreshToken);
    await user.save();

    const response = success({ user: serializeUser(user), redirectTo: resolvePostAuthRedirect("student", parsed.returnUrl) });
    setAuthCookies(response, { accessToken, refreshToken }, "student");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
