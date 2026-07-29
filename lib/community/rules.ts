export const CLASS_MISSION_CODE = "CLASS_QUESTIONS_WEEKLY";
export const CLASS_MISSION_REWARD_XP = 60;
export const MINIMUM_MISSION_CONTRIBUTION = 10;

export const ENCOURAGEMENTS = {
  high_five: {
    kind: "high_five",
    label: "হাই ফাইভ",
    message: "দারুণ কাজ!",
  },
  keep_going: {
    kind: "keep_going",
    label: "এগিয়ে যাও",
    message: "চেষ্টা চালিয়ে যাও!",
  },
  great_progress: {
    kind: "great_progress",
    label: "দারুণ উন্নতি",
    message: "তোমার উন্নতি দারুণ!",
  },
} as const;

export type EncouragementKind = keyof typeof ENCOURAGEMENTS;

export function calculateClassMissionTarget(classSize: number) {
  return Math.max(100, Math.min(1_000, Math.max(0, classSize) * 20));
}

export function canClaimClassMission(input: {
  classProgress: number;
  classTarget: number;
  studentContribution: number;
}) {
  return (
    input.classProgress >= input.classTarget &&
    input.studentContribution >= MINIMUM_MISSION_CONTRIBUTION
  );
}

export function safeCommunityName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "শিক্ষার্থী";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.slice(0, 1)}…`;
}
