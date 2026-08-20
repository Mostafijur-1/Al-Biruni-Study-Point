import webpush from "web-push";

import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { PushSubscription } from "@/lib/db/models/PushSubscription";
import type { IRoutineSlot } from "@/lib/db/models/RoutineSlot";
import { User } from "@/lib/db/models/User";
import { CoachingEnrollmentSubject } from "@/lib/db/models/CoachingEnrollmentSubject";

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:admin@albirunistudypoint.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

type RoutineEvent = "created" | "updated" | "cancelled";
const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

function time(minute: number) {
  return new Date(Date.UTC(2020, 0, 1, Math.floor(minute / 60), minute % 60)).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export async function notifyRoutineChange(routine: IRoutineSlot, event: RoutineEvent, additionalUserIds: string[] = []) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return 0;
  const eligibleStudentIds = routine.batchId && routine.subjectId
    ? await CoachingEnrollmentSubject.distinct("studentId", { batchId: routine.batchId, subjectId: routine.subjectId, status: "active" })
    : [];
  const userIds = [...new Set([String(routine.teacherId), ...eligibleStudentIds.map(String), ...(routine.studentIds ?? []).map(String), ...additionalUserIds])];
  const [batch, subject, subscriptions, users] = await Promise.all([
    routine.batchId ? Batch.findById(routine.batchId).select("name").lean() : null,
    routine.subjectId ? AcademicSubject.findById(routine.subjectId).select("name nameBn").lean() : null,
    PushSubscription.find({ userId: { $in: userIds } }).lean(),
    User.find({ _id: { $in: userIds } }).select("role").lean(),
  ]);
  const roles = new Map(users.map((user) => [String(user._id), user.role]));
  const title = event === "created" ? "নতুন ক্লাস রুটিন প্রকাশ হয়েছে" : event === "updated" ? "ক্লাস রুটিন পরিবর্তন হয়েছে" : "ক্লাস রুটিন বাতিল হয়েছে";
  const body = `${routine.subjectName || subject?.nameBn || subject?.name || "ক্লাস"}${batch?.name ? ` • ${batch.name}` : ""} • ${days[routine.weekday]} • ${time(routine.startMinute)}–${time(routine.endMinute)}`;
  let sent = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription.subscription, JSON.stringify({
        title, body,
        url: roles.get(String(subscription.userId)) === "teacher" ? "/teacher" : "/student",
        tag: `routine-${event}-${routine._id}-${routine.updatedAt?.getTime?.() ?? Date.now()}`,
      }));
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await PushSubscription.deleteOne({ _id: subscription._id });
    }
  }));
  return sent;
}
