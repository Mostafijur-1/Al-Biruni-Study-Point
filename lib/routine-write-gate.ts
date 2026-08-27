export function requiresAcademicRoutineWriteGate(input: {
  action: "create" | "update" | "end";
  assignmentId?: string;
}) {
  return input.action === "create" || input.action === "update" || input.action === "end";
}

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isRoutineMutationEnabled(
  input: { action: "create" | "update" | "end" },
  flags: { academicWrites: string | undefined; routinePublishing: string | undefined },
) {
  if (enabled(flags.academicWrites)) return true;
  return input.action === "create" && enabled(flags.routinePublishing);
}
