import { createHash } from "node:crypto";

import type { UserRole } from "../types/index.ts";

export const attendanceStatuses = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type AttendanceRecordStatus = AttendanceStatus | "unmarked";

export type AttendancePolicySnapshot = {
  presentCountsAsAttended: true;
  lateCountsAsAttended: true;
  absentCountsInDenominator: true;
  excusedExcluded: true;
  lowAttendanceThresholdPercent: number;
};

export const defaultAttendancePolicy: AttendancePolicySnapshot = {
  presentCountsAsAttended: true,
  lateCountsAsAttended: true,
  absentCountsInDenominator: true,
  excusedExcluded: true,
  lowAttendanceThresholdPercent: 75,
};

export function areAttendanceWritesEnabled(
  academicFlag: string | undefined,
  attendanceFlag: string | undefined,
) {
  return (
    academicFlag?.trim().toLowerCase() === "true" &&
    attendanceFlag?.trim().toLowerCase() === "true"
  );
}

export function canManageAttendance(
  role: UserRole,
  actorId: string,
  assignedTeacherId: string,
) {
  return role === "admin" || (role === "teacher" && actorId === assignedTeacherId);
}

export function isValidAttendanceMark(input: {
  status: AttendanceStatus;
  minutesLate?: number;
}) {
  if (input.status === "late") {
    return Number.isInteger(input.minutesLate) && (input.minutesLate ?? 0) >= 1;
  }
  return input.minutesLate === undefined || input.minutesLate === 0;
}

export function calculateAttendanceSummary(
  statuses: readonly AttendanceRecordStatus[],
  policy: AttendancePolicySnapshot = defaultAttendancePolicy,
) {
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unmarked: 0,
  };

  for (const status of statuses) counts[status] += 1;

  const attended =
    (policy.presentCountsAsAttended ? counts.present : 0) +
    (policy.lateCountsAsAttended ? counts.late : 0);
  const denominator =
    attended + (policy.absentCountsInDenominator ? counts.absent : 0);
  const percentage = denominator === 0 ? null : Math.round((attended / denominator) * 10_000) / 100;

  return {
    counts,
    attended,
    denominator,
    percentage,
    belowThreshold:
      percentage === null ? false : percentage < policy.lowAttendanceThresholdPercent,
  };
}

export function createRosterHash(
  roster: readonly { enrollmentId: string; effectiveFrom: Date | string; effectiveTo?: Date | string }[],
) {
  const canonical = roster
    .map((item) => ({
      enrollmentId: item.enrollmentId,
      effectiveFrom: new Date(item.effectiveFrom).toISOString(),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo).toISOString() : null,
    }))
    .sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function createAttendancePayloadHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
