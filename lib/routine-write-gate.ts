export function requiresAcademicRoutineWriteGate(input: {
  action: "create" | "update" | "end";
  assignmentId?: string;
}) {
  return input.action === "create" || input.action === "update" || input.action === "end";
}
