import type { McqExamSummary } from "@/types/mcq";

type DurationUnit = "minutes" | "min";

export function formatMcqExamMeta(exam: McqExamSummary, durationUnit: DurationUnit = "minutes") {
  const unit = durationUnit === "min" ? "min" : "minutes";
  return `${exam.questionCount} questions · ${exam.duration} ${unit} · ${exam.totalMarks} marks · pass ${exam.passMark}`;
}
