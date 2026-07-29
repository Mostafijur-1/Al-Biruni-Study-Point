import mongoose from "mongoose";

import {
  CLASS_MISSION_CODE,
  CLASS_MISSION_REWARD_XP,
  ENCOURAGEMENTS,
  calculateClassMissionTarget,
  canClaimClassMission,
  safeCommunityName,
  type EncouragementKind,
} from "@/lib/community/rules";
import { ClassMissionClaim } from "@/lib/db/models/ClassMissionClaim";
import { PeerEncouragement } from "@/lib/db/models/PeerEncouragement";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import { User } from "@/lib/db/models/User";
import { getDhakaWeekBounds } from "@/lib/gamification/engagement-rules";
import { calculateLevel, getDhakaDateKey } from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import type { StudentClass } from "@/types";

export async function getClassCommunityState(input: {
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
  const [attempts, encouragements, claim] = await Promise.all([
    PracticeAttempt.find({
      student: { $in: studentIds },
      isCancelled: { $ne: true },
      createdAt: { $gte: week.start, $lte: week.end },
    })
      .select("student answers createdAt")
      .lean(),
    PeerEncouragement.find({
      studentClass: input.studentClass,
      periodKey: week.key,
    })
      .sort({ createdAt: -1 })
      .lean(),
    ClassMissionClaim.findOne({
      student: input.studentId,
      missionCode: CLASS_MISSION_CODE,
      periodKey: week.key,
    }).lean(),
  ]);

  const studentNames = new Map(
    students.map((student) => [String(student._id), safeCommunityName(student.name)]),
  );
  const contributions = new Map<
    string,
    { questions: number; activeDays: Set<string> }
  >();
  for (const attempt of attempts) {
    const studentId = String(attempt.student);
    const current = contributions.get(studentId) ?? {
      questions: 0,
      activeDays: new Set<string>(),
    };
    current.questions += attempt.answers.filter(
      (answer) => answer.selectedIndex !== null,
    ).length;
    current.activeDays.add(getDhakaDateKey(attempt.createdAt));
    contributions.set(studentId, current);
  }

  const receivedCounts = new Map<string, number>();
  const sentTo = new Set<string>();
  for (const encouragement of encouragements) {
    const toId = String(encouragement.toStudent);
    receivedCounts.set(toId, (receivedCounts.get(toId) ?? 0) + 1);
    if (String(encouragement.fromStudent) === input.studentId) {
      sentTo.add(toId);
    }
  }

  const members = students
    .map((student) => {
      const memberId = String(student._id);
      const activity = contributions.get(memberId);
      return {
        memberId,
        displayName: studentNames.get(memberId) ?? "শিক্ষার্থী",
        contribution: activity?.questions ?? 0,
        activeDays: activity?.activeDays.size ?? 0,
        encouragements: receivedCounts.get(memberId) ?? 0,
        encouragedByMe: sentTo.has(memberId),
        isCurrentStudent: memberId === input.studentId,
      };
    })
    .filter((member) => member.contribution > 0 || member.isCurrentStudent)
    .sort(
      (a, b) =>
        b.contribution - a.contribution ||
        b.activeDays - a.activeDays ||
        a.displayName.localeCompare(b.displayName),
    );

  const topMembers = members.slice(0, 10);
  const currentMember = members.find((member) => member.isCurrentStudent);
  if (
    currentMember &&
    !topMembers.some((member) => member.memberId === currentMember.memberId)
  ) {
    topMembers.push(currentMember);
  }

  const classProgress = [...contributions.values()].reduce(
    (sum, contribution) => sum + contribution.questions,
    0,
  );
  const target = calculateClassMissionTarget(students.length);
  const studentContribution =
    contributions.get(input.studentId)?.questions ?? 0;
  const inbox = encouragements
    .filter((encouragement) => String(encouragement.toStudent) === input.studentId)
    .slice(0, 5)
    .map((encouragement) => ({
      id: String(encouragement._id),
      from: studentNames.get(String(encouragement.fromStudent)) ?? "সহপাঠী",
      kind: encouragement.kind,
      label: ENCOURAGEMENTS[encouragement.kind].label,
      message: ENCOURAGEMENTS[encouragement.kind].message,
      createdAt: encouragement.createdAt,
    }));

  return {
    periodKey: week.key,
    mission: {
      code: CLASS_MISSION_CODE,
      title: "একসাথে প্রশ্নজয়",
      description:
        "এই সপ্তাহে পুরো ক্লাস মিলে অনুশীলনের লক্ষ্য পূরণ করুন। প্রত্যেকের ছোট অবদানই দলের অগ্রগতি।",
      progress: classProgress,
      target,
      rewardXp: CLASS_MISSION_REWARD_XP,
      participantCount: contributions.size,
      studentContribution,
      complete: classProgress >= target,
      eligible: canClaimClassMission({
        classProgress,
        classTarget: target,
        studentContribution,
      }),
      claimed: Boolean(claim),
    },
    members: topMembers,
    inbox,
    encouragementOptions: Object.values(ENCOURAGEMENTS),
  };
}

export async function encourageClassmate(input: {
  fromStudentId: string;
  toStudentId: string;
  studentClass: StudentClass;
  kind: EncouragementKind;
  now?: Date;
}) {
  if (input.fromStudentId === input.toStudentId) {
    return { ok: false as const, reason: "self" as const };
  }
  const target = await User.findOne({
    _id: input.toStudentId,
    role: "student",
    studentClass: input.studentClass,
    isActive: true,
  })
    .select("name")
    .lean();
  if (!target) return { ok: false as const, reason: "not_found" as const };

  const week = getDhakaWeekBounds(input.now);
  try {
    const existing = await PeerEncouragement.findOne({
      fromStudent: input.fromStudentId,
      toStudent: input.toStudentId,
      periodKey: week.key,
    }).lean();
    if (existing) {
      return {
        ok: true as const,
        alreadySent: true,
        encouragement: ENCOURAGEMENTS[existing.kind],
      };
    }
    await PeerEncouragement.create({
      fromStudent: input.fromStudentId,
      toStudent: input.toStudentId,
      studentClass: input.studentClass,
      periodKey: week.key,
      kind: input.kind,
      createdAt: input.now ?? new Date(),
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return {
        ok: true as const,
        alreadySent: true,
        encouragement: ENCOURAGEMENTS[input.kind],
      };
    }
    throw error;
  }

  return {
    ok: true as const,
    alreadySent: false,
    recipient: safeCommunityName(target.name),
    encouragement: ENCOURAGEMENTS[input.kind],
  };
}

export async function claimClassMissionReward(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const state = await getClassCommunityState({
    studentId: input.studentId,
    studentClass: input.studentClass,
    now: input.now,
  });
  if (state.mission.claimed) {
    return { ok: true as const, alreadyClaimed: true, mission: state.mission };
  }
  if (!state.mission.complete) {
    return { ok: false as const, reason: "incomplete" as const };
  }
  if (!state.mission.eligible) {
    return { ok: false as const, reason: "contribution" as const };
  }

  await getOrCreateGameProfile(input.studentId);
  const session = await mongoose.startSession();
  let profileSnapshot:
    | { totalXp: number; level: number }
    | undefined;
  let alreadyClaimed = false;

  try {
    await session.withTransaction(async () => {
      const duplicate = await ClassMissionClaim.findOne({
        student: input.studentId,
        missionCode: CLASS_MISSION_CODE,
        periodKey: state.periodKey,
      }).session(session);
      if (duplicate) {
        alreadyClaimed = true;
        const profile = await StudentGameProfile.findOne({
          student: input.studentId,
        }).session(session);
        if (!profile) throw new Error("Game profile is missing.");
        profileSnapshot = { totalXp: profile.totalXp, level: profile.level };
        return;
      }

      await ClassMissionClaim.create(
        [{
          student: input.studentId,
          studentClass: input.studentClass,
          missionCode: CLASS_MISSION_CODE,
          periodKey: state.periodKey,
          xp: CLASS_MISSION_REWARD_XP,
          claimedAt: input.now ?? new Date(),
        }],
        { session },
      );
      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(session);
      if (!profile) throw new Error("Game profile is missing.");
      profile.totalXp += CLASS_MISSION_REWARD_XP;
      profile.level = calculateLevel(profile.totalXp);
      await profile.save({ session });

      await StudentAchievement.updateOne(
        { student: input.studentId, code: "TEAM_PLAYER" },
        {
          $setOnInsert: {
            student: input.studentId,
            code: "TEAM_PLAYER",
            unlockedAt: input.now ?? new Date(),
          },
        },
        { upsert: true, session },
      );
      profileSnapshot = { totalXp: profile.totalXp, level: profile.level };
    });
  } finally {
    await session.endSession();
  }

  if (!profileSnapshot) throw new Error("Could not claim class mission reward.");
  return {
    ok: true as const,
    alreadyClaimed,
    reward: { xp: CLASS_MISSION_REWARD_XP },
    profile: profileSnapshot,
    mission: state.mission,
  };
}
