import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { User } from "@/lib/db/models/User";
import {
  getDhakaWeekBounds,
  leaderboardScore,
} from "@/lib/gamification/engagement-rules";
import { getDhakaDateKey } from "@/lib/gamification/rules";
import type { StudentClass } from "@/types";

function safeDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "শিক্ষার্থী";
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.slice(0, 1)}…`;
}

export async function getClassLeaderboard(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const week = getDhakaWeekBounds(input.now);
  const students = await User.find({
    role: "student",
    studentClass: input.studentClass,
    isActive: true,
  })
    .select("name")
    .limit(500)
    .lean();
  const studentIds = students.map((student) => student._id);
  const attempts = await PracticeAttempt.find({
    student: { $in: studentIds },
    isCancelled: { $ne: true },
    createdAt: { $gte: week.start, $lte: week.end },
  })
    .sort({ createdAt: 1 })
    .select("student subject percentage answers createdAt")
    .lean();

  const stats = new Map<
    string,
    {
      questions: number;
      activeDays: Set<string>;
      subjectScores: Map<string, number[]>;
    }
  >();
  for (const attempt of attempts) {
    const id = String(attempt.student);
    const current = stats.get(id) ?? {
      questions: 0,
      activeDays: new Set<string>(),
      subjectScores: new Map<string, number[]>(),
    };
    current.questions += attempt.answers.filter(
      (answer) => answer.selectedIndex !== null,
    ).length;
    current.activeDays.add(getDhakaDateKey(attempt.createdAt));
    const scores = current.subjectScores.get(attempt.subject) ?? [];
    scores.push(attempt.percentage);
    current.subjectScores.set(attempt.subject, scores);
    stats.set(id, current);
  }

  const entries = students
    .map((student) => {
      const id = String(student._id);
      const current = stats.get(id);
      if (!current) return null;
      let improvement = 0;
      for (const scores of current.subjectScores.values()) {
        for (let index = 1; index < scores.length; index += 1) {
          improvement = Math.max(improvement, scores[index] - scores[index - 1]);
        }
      }
      const activeDays = current.activeDays.size;
      return {
        studentId: id,
        displayName: safeDisplayName(student.name),
        activeDays,
        questions: current.questions,
        improvement: Math.max(0, Math.round(improvement)),
        score: leaderboardScore({
          activeDays,
          questions: current.questions,
          improvement,
        }),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.activeDays - a.activeDays ||
        b.questions - a.questions,
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentStudent: entry.studentId === input.studentId,
    }));

  const top = entries.slice(0, 10);
  const current = entries.find((entry) => entry.studentId === input.studentId);
  if (current && !top.some((entry) => entry.studentId === current.studentId)) {
    top.push(current);
  }

  return {
    periodKey: week.key,
    entries: top.map((entry) => ({
      displayName: entry.displayName,
      activeDays: entry.activeDays,
      questions: entry.questions,
      improvement: entry.improvement,
      score: entry.score,
      rank: entry.rank,
      isCurrentStudent: entry.isCurrentStudent,
    })),
    currentRank: current?.rank ?? null,
    participantCount: entries.length,
  };
}
