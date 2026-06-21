import { User } from "@/lib/db/models/User";

export const TEACHER_MONTHLY_BASE_CHARGE_TK = 100;
export const TEACHER_IMAGE_UPLOAD_TK = 3;
export const TEACHER_CHARGE_PERIOD_DAYS = 30;

export function getCurrentChargeMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function calculateTeacherMonthlyCharge(imageUploadCount = 0) {
  return TEACHER_MONTHLY_BASE_CHARGE_TK + TEACHER_IMAGE_UPLOAD_TK * imageUploadCount;
}

export function getNextTeacherChargeDueDate(date = new Date()) {
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + TEACHER_CHARGE_PERIOD_DAYS);
  return dueDate;
}

export function isTeacherChargeExpired(
  usage?: { chargeDueAt?: Date | string | null },
  date = new Date(),
) {
  if (!usage?.chargeDueAt) return false;
  return new Date(usage.chargeDueAt).getTime() <= date.getTime();
}

export function getTeacherMonthlyUsage(
  usage?: {
    imageQuestionUploadMonth?: string;
    imageQuestionUploadCount?: number;
    chargeCycleStartedAt?: Date | string;
    chargeDueAt?: Date | string;
    lastChargeRefreshedAt?: Date | string;
  },
  month = getCurrentChargeMonth(),
) {
  const imageQuestionUploadCount =
    usage?.imageQuestionUploadMonth === month ? usage.imageQuestionUploadCount || 0 : 0;
  const chargeDueAt = usage?.chargeDueAt ? new Date(usage.chargeDueAt) : undefined;

  return {
    imageQuestionUploadMonth: month,
    imageQuestionUploadCount,
    monthlyChargeTk: calculateTeacherMonthlyCharge(imageQuestionUploadCount),
    chargeCycleStartedAt: usage?.chargeCycleStartedAt
      ? new Date(usage.chargeCycleStartedAt).toISOString()
      : undefined,
    chargeDueAt: chargeDueAt?.toISOString(),
    lastChargeRefreshedAt: usage?.lastChargeRefreshedAt
      ? new Date(usage.lastChargeRefreshedAt).toISOString()
      : undefined,
    isChargeExpired: chargeDueAt ? chargeDueAt.getTime() <= Date.now() : false,
  };
}

export async function refreshTeacherCharge(teacherId: string, date = new Date()) {
  const month = getCurrentChargeMonth(date);
  const chargeDueAt = getNextTeacherChargeDueDate(date);

  await User.updateOne(
    { _id: teacherId, role: "teacher" },
    {
      $set: {
        isActive: true,
        approvalStatus: "approved",
        "teacherUsage.imageQuestionUploadMonth": month,
        "teacherUsage.imageQuestionUploadCount": 0,
        "teacherUsage.chargeCycleStartedAt": date,
        "teacherUsage.chargeDueAt": chargeDueAt,
        "teacherUsage.lastChargeRefreshedAt": date,
      },
    },
  );
}

export async function deactivateExpiredTeacherCharges(date = new Date()) {
  await User.updateMany(
    {
      role: "teacher",
      isActive: true,
      "teacherUsage.chargeDueAt": { $lte: date },
    },
    { $set: { isActive: false } },
  );
}

export async function incrementTeacherImageQuestionUpload(teacherId: string, count = 1) {
  const month = getCurrentChargeMonth();
  const incrementBy = Math.max(1, count);

  const currentMonthUpdate = await User.updateOne(
    { _id: teacherId, "teacherUsage.imageQuestionUploadMonth": month },
    {
      $inc: {
        "teacherUsage.imageQuestionUploadCount": incrementBy,
      },
    },
  );

  if (currentMonthUpdate.matchedCount > 0) {
    return;
  }

  await User.updateOne(
    { _id: teacherId },
    {
      $set: {
        "teacherUsage.imageQuestionUploadMonth": month,
        "teacherUsage.imageQuestionUploadCount": incrementBy,
      },
    },
  );
}
