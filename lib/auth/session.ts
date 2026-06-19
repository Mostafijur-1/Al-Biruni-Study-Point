import type { SessionUser, UserRole } from "@/types";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { User } from "@/lib/db/models/User";
import { connectDB } from "@/lib/db/connect";
import type { NextRequest } from "next/server";

export class AuthError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function serializeUser(user: {
  _id: unknown;
  name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  studentClass?: string;
  avatar?: string;
  approvalStatus?: string;
  schoolCollege?: string;
  reference?: string;
}) {
  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    studentClass: user.studentClass,
    avatar: user.avatar,
    approvalStatus: user.approvalStatus,
    schoolCollege: user.schoolCollege,
    reference: user.reference,
  };
}

export async function requireAuth(
  request: NextRequest,
  allowedRoles?: UserRole[],
) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    throw new AuthError();
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AuthError("Invalid or expired session.");
  }

  if (allowedRoles?.length && !allowedRoles.includes(payload.role)) {
    throw new AuthError("Forbidden", 403);
  }

  await connectDB();
  const user = await User.findById(payload.userId);

  if (!user || !user.isActive) {
    throw new AuthError("Account is not active.");
  }

  if (user.role === "teacher" && user.approvalStatus !== "approved") {
    throw new AuthError("Teacher account is pending admin approval.", 403);
  }

  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    studentClass: user.studentClass,
    schoolCollege: user.schoolCollege,
    reference: user.reference,
  } satisfies SessionUser;
}
