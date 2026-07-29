import mongoose from "mongoose";

import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import { StudentLabCompletion } from "@/lib/db/models/StudentLabCompletion";
import { calculateLevel } from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import { getSchoolLevel } from "@/lib/content/syllabus";
import {
  SCIENCE_LABS,
  SCIENCE_LAB_IDS,
  getScienceLabsForLevel,
  validateLabMastery,
  type LabInputValues,
  type ScienceLabId,
} from "@/lib/labs/rules";
import type { StudentClass } from "@/types";

export async function getScienceLabHub(input: {
  studentId: string;
  studentClass: StudentClass;
}) {
  const completions = await StudentLabCompletion.find({
    student: input.studentId,
  })
    .select("labId result xpEarned completedAt")
    .lean();
  const byLab = new Map(
    completions.map((completion) => [completion.labId, completion]),
  );

  const level = getSchoolLevel(input.studentClass);
  const availableLabs = getScienceLabsForLevel(level);
  const availableIds = new Set(availableLabs.map((lab) => lab.id));
  const availableCompletions = completions.filter((completion) =>
    availableIds.has(completion.labId),
  );

  return {
    level,
    labs: availableLabs.map((lab) => {
      const labId = lab.id;
      const completion = byLab.get(labId);
      return {
        ...lab,
        completed: Boolean(completion),
        completedAt: completion?.completedAt ?? null,
        xpEarned: completion?.xpEarned ?? 0,
      };
    }),
    progress: {
      completed: availableCompletions.length,
      total: availableLabs.length,
      percent: Math.round(
        (availableCompletions.length / availableLabs.length) * 100,
      ),
      xpEarned: availableCompletions.reduce(
        (total, completion) => total + completion.xpEarned,
        0,
      ),
    },
  };
}

export async function completeScienceLab(input: {
  studentId: string;
  studentClass: StudentClass;
  labId: ScienceLabId;
  values: LabInputValues;
  now?: Date;
}) {
  const validation = validateLabMastery(input.labId, input.values);
  if (!validation.valid) {
    return {
      ok: false as const,
      reason: "incorrect" as const,
      result: validation.result,
    };
  }

  const existing = await StudentLabCompletion.findOne({
    student: input.studentId,
    labId: input.labId,
  }).lean();
  if (existing) {
    return {
      ok: true as const,
      alreadyCompleted: true,
      reward: { xp: existing.xpEarned },
      hub: await getScienceLabHub(input),
    };
  }

  await getOrCreateGameProfile(input.studentId);
  const now = input.now ?? new Date();
  const session = await mongoose.startSession();
  let alreadyCompleted = false;
  let rewardXp: number = SCIENCE_LABS[input.labId].xp;
  let profileSnapshot:
    | { totalXp: number; level: number }
    | undefined;
  try {
    await session.withTransaction(async () => {
      const duplicate = await StudentLabCompletion.findOne({
        student: input.studentId,
        labId: input.labId,
      }).session(session);
      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(session);
      if (!profile) throw new Error("Game profile is missing.");

      if (duplicate) {
        alreadyCompleted = true;
        rewardXp = duplicate.xpEarned;
        profileSnapshot = {
          totalXp: profile.totalXp,
          level: profile.level,
        };
        return;
      }

      await StudentLabCompletion.create(
        [
          {
            student: input.studentId,
            labId: input.labId,
            result: validation.result,
            xpEarned: rewardXp,
            completedAt: now,
          },
        ],
        { session },
      );

      profile.totalXp += rewardXp;
      profile.level = calculateLevel(profile.totalXp);
      await profile.save({ session });

      const completedCount = await StudentLabCompletion.countDocuments({
        student: input.studentId,
      }).session(session);
      const achievementCodes = ["LAB_EXPLORER"];
      if (completedCount >= SCIENCE_LAB_IDS.length) {
        achievementCodes.push("LAB_MASTER");
      }
      for (const code of achievementCodes) {
        await StudentAchievement.updateOne(
          { student: input.studentId, code },
          {
            $setOnInsert: {
              student: input.studentId,
              code,
              unlockedAt: now,
            },
          },
          { upsert: true, session },
        );
      }

      profileSnapshot = {
        totalXp: profile.totalXp,
        level: profile.level,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!profileSnapshot) throw new Error("Could not complete science lab.");
  return {
    ok: true as const,
    alreadyCompleted,
    reward: { xp: rewardXp },
    profile: profileSnapshot,
    hub: await getScienceLabHub(input),
  };
}
