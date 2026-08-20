import { NextRequest } from "next/server";
import webpush from "web-push";

import { zonedScheduleDateTimeToUtc } from "@/lib/academic-rules";
import { fail, handleApiError, success } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { Organization } from "@/lib/db/models/Organization";
import { PushSubscription } from "@/lib/db/models/PushSubscription";
import { RoutineReminder } from "@/lib/db/models/RoutineReminder";
import { RoutineSlot } from "@/lib/db/models/RoutineSlot";
import { CoachingEnrollmentSubject } from "@/lib/db/models/CoachingEnrollmentSubject";

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@albirunistudypoint.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

type ReminderKind = "previous-night" | "day-of";

function localParts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minute: Number(values.hour) * 60 + Number(values.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday),
  };
}

function addLocalDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function timeLabel(minute: number) {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return new Intl.DateTimeFormat("bn-BD", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2020, 0, 1, hour, min)));
}

async function sendToUser(
  userId: string,
  routineId: string,
  occurrenceDate: string,
  kind: ReminderKind,
  payload: string,
) {
  try {
    await RoutineReminder.create({ routineSlotId: routineId, userId, occurrenceDate, kind });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return 0;
    throw error;
  }

  const subscriptions = await PushSubscription.find({ userId }).lean();
  if (!subscriptions.length) return 0;
  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
    }
  }));
  return sent;
}

async function handle(request: NextRequest) {
  try {
    if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET?.trim()}` || !process.env.CRON_SECRET?.trim()) {
      return fail("Unauthorized", 401);
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return fail("Push notification delivery is not configured.", 503);
    }
    await connectDB();
    const now = new Date();
    const window = request.nextUrl.searchParams.get("window");
    if (window !== "night" && window !== "day") return fail("Invalid reminder window.", 400);
    const routines = await RoutineSlot.find({
      status: "active",
      effectiveFrom: { $lte: new Date(now.getTime() + 36 * 60 * 60 * 1000) },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
    }).lean();
    const [organizations, batches, subjects] = await Promise.all([
      Organization.find({ _id: { $in: routines.map((item) => item.organizationId).filter((id): id is NonNullable<typeof id> => Boolean(id)) } }).select("timezone").lean(),
      Batch.find({ _id: { $in: routines.map((item) => item.batchId).filter((id): id is NonNullable<typeof id> => Boolean(id)) } }).select("name code").lean(),
      AcademicSubject.find({ _id: { $in: routines.map((item) => item.subjectId).filter((id): id is NonNullable<typeof id> => Boolean(id)) } }).select("name nameBn").lean(),
    ]);
    const zones = new Map(organizations.map((item) => [String(item._id), item.timezone]));
    const batchNames = new Map(batches.map((item) => [String(item._id), item.name]));
    const subjectNames = new Map(subjects.map((item) => [String(item._id), item.nameBn || item.name]));
    let devices = 0;
    let reminders = 0;

    for (const routine of routines) {
      const zone = zones.get(String(routine.organizationId)) || "Asia/Dhaka";
      const local = localParts(now, zone);
      const targetDate = window === "night" ? addLocalDays(local.date, 1) : local.date;
      const targetWeekday = window === "night" ? (local.weekday + 1) % 7 : local.weekday;
      const candidates: Array<{ kind: ReminderKind; date: string }> = routine.weekday === targetWeekday
        ? [{ kind: window === "night" ? "previous-night" : "day-of", date: targetDate }]
        : [];
      for (const candidate of candidates) {
        const start = zonedScheduleDateTimeToUtc(candidate.date, `${String(Math.floor(routine.startMinute / 60)).padStart(2, "0")}:${String(routine.startMinute % 60).padStart(2, "0")}`, zone);
        if (start < routine.effectiveFrom || (routine.effectiveTo && start > routine.effectiveTo)) continue;
        const title = candidate.kind === "previous-night" ? "আগামীকাল আপনার ক্লাস আছে" : "আজ আপনার ক্লাস আছে";
        const batchName = batchNames.get(String(routine.batchId));
        const body = `${routine.subjectName || subjectNames.get(String(routine.subjectId)) || "ক্লাস"}${batchName ? ` • ${batchName}` : ""} • ${timeLabel(routine.startMinute)}–${timeLabel(routine.endMinute)}`;
        const eligibleStudentIds = routine.batchId && routine.subjectId
          ? await CoachingEnrollmentSubject.distinct("studentId", { batchId: routine.batchId, subjectId: routine.subjectId, status: "active" })
          : [];
        const userIds = [...new Set([String(routine.teacherId), ...eligibleStudentIds.map(String), ...(routine.studentIds ?? []).map(String)])];
        reminders += userIds.length;
        devices += (await Promise.all(userIds.map((id) => {
          const payload = JSON.stringify({
            title,
            body,
            url: id === String(routine.teacherId) ? "/teacher" : "/student",
            tag: `${candidate.kind}-${routine._id}-${candidate.date}`,
          });
          return sendToUser(id, String(routine._id), candidate.date, candidate.kind, payload);
        })))
          .reduce((sum, count) => sum + count, 0);
      }
    }
    return success({ reminders, devices });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
