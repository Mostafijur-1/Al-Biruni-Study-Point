import type { ApprovalStatus, EnrolledBatchSummary, SessionUser, StudentClass, UserRole } from "@/types";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { sessionVersionMatches } from "@/lib/auth/session-version";
import { User } from "@/lib/db/models/User";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { connectDB } from "@/lib/db/connect";
import { getTeacherMonthlyUsage, isTeacherChargeExpired } from "@/lib/teacher-charges";
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
  studentClass?: StudentClass | string;
  avatar?: string;
  approvalStatus?: string;
  schoolCollege?: string;
  reference?: string;
  studentCode?: string;
  isAbspMember?: boolean;
  onboardingCompletedAt?: Date | string;
  googleId?: string;
  teacherUsage?: {
    imageQuestionUploadMonth?: string;
    imageQuestionUploadCount?: number;
    chargeCycleStartedAt?: Date | string;
    chargeDueAt?: Date | string;
    lastChargeRefreshedAt?: Date | string;
  };
}, extra?: {
  enrolledBatch?: EnrolledBatchSummary | null;
}): SessionUser {
  const teacherUsage = user.role === "teacher" ? getTeacherMonthlyUsage(user.teacherUsage) : undefined;

  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    studentClass: user.studentClass as StudentClass | undefined,
    avatar: user.avatar,
    approvalStatus: user.approvalStatus as ApprovalStatus | undefined,
    schoolCollege: user.schoolCollege,
    reference: user.reference,
    studentCode: user.studentCode,
    isAbspMember: Boolean(user.isAbspMember),
    onboardingComplete: Boolean(
      user.role !== "student" || user.onboardingCompletedAt || (!user.googleId && user.phone && user.studentClass),
    ),
    enrolledBatch: extra?.enrolledBatch ?? null,
    teacherUsage,
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

  await connectDB();
  const user = await User.findById(payload.userId)
    .select(
      "name phone email role studentClass schoolCollege reference studentCode " +
      "isAbspMember teacherUsage isActive approvalStatus sessionVersion onboardingCompletedAt +googleId",
    )
    .lean();

  if (user?.role === "teacher" && user.isActive && isTeacherChargeExpired(user.teacherUsage)) {
    user.isActive = false;
    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
  }

  if (!user || !user.isActive) {
    throw new AuthError("Account is not active.");
  }

  if (!sessionVersionMatches(payload.sessionVersion, user.sessionVersion)) {
    throw new AuthError("Invalid or expired session.");
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    throw new AuthError("Forbidden", 403);
  }

  if (user.role === "teacher" && user.approvalStatus !== "approved") {
    throw new AuthError("Teacher account is pending admin approval.", 403);
  }

  let enrolledBatch: EnrolledBatchSummary | null = null;
  if (user.role === "student") {
    const activeEnrollment = await BatchEnrollment.findOne({ studentId: user._id, status: "active" })
      .sort({ effectiveFrom: -1 })
      .select("batchId")
      .lean();
    if (activeEnrollment?.batchId) {
      const batchDoc = await Batch.findById(activeEnrollment.batchId)
        .select("name code mode studentClass")
        .lean();
      if (batchDoc) {
        enrolledBatch = {
          id: String(batchDoc._id),
          name: batchDoc.name,
          code: batchDoc.code,
          mode: batchDoc.mode,
          studentClass: batchDoc.studentClass,
        };
      }
    }
  }

  return {
    ...serializeUser(user, { enrolledBatch }),
  } satisfies SessionUser;
}
