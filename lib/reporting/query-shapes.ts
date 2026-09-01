import type { ReportingProjectionType } from "../db/models/ReportingProjection.ts";

export const REPORTING_QUERY_SHAPES: Record<ReportingProjectionType, { owner: string; source: string; maximumRows: number; stagingP95BudgetMs: number }> = {
  "student-today": { owner: "Student experience", source: "enrollment, attendance, assessment attempts, focus sessions", maximumRows: 20_000, stagingP95BudgetMs: 250 },
  "teacher-today": { owner: "Academic operations", source: "teacher assignments, class sessions, attendance sheets", maximumRows: 5_000, stagingP95BudgetMs: 250 },
  "attendance-daily": { owner: "Academic operations", source: "submitted attendance sheets", maximumRows: 5_000, stagingP95BudgetMs: 300 },
  "assessment-trend": { owner: "Assessment", source: "submitted assessment attempts", maximumRows: 20_000, stagingP95BudgetMs: 300 },
  "finance-monthly": { owner: "Finance", source: "immutable invoices, adjustments, allocations, cash transactions", maximumRows: 20_000, stagingP95BudgetMs: 350 },
};
