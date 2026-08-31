import { z } from "zod";

export const financeMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const wholeTaka = z.coerce.number().int().min(0).max(100_000_000);
const ledgerScope = { organizationId: objectId.optional(), branchId: objectId.optional() };
const idempotencyKey = z.string().trim().min(8).max(200);

export const financeListSchema = z.object({
  month: z.string().regex(financeMonthPattern).default(() => new Date().toISOString().slice(0, 7)),
  role: z.enum(["all", "student", "teacher"]).default("all"),
  q: z.string().trim().max(120).default(""),
  batchId: objectId.optional(),
  organizationId: objectId.optional(),
  branchId: objectId.optional(),
});

export const financeMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-profile"), userId: objectId, organizationId: objectId.optional(), defaultAmountTk: z.coerce.number().int().min(0).max(10_000_000) }),
  z.object({ action: z.literal("set-month"), userId: objectId, organizationId: objectId.optional(), month: z.string().regex(financeMonthPattern), amountTk: z.coerce.number().int().min(0).max(10_000_000), status: z.enum(["due", "clear"]), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("set-expense"), organizationId: objectId.optional(), month: z.string().regex(financeMonthPattern), category: z.enum(["room-rent", "electricity"]), amountTk: z.coerce.number().int().min(0).max(10_000_000), status: z.enum(["due", "clear"]), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("assign-fee-plan"), ...ledgerScope, idempotencyKey, studentId: objectId, code: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(160), amountTk: wholeTaka, effectiveFrom: z.string().regex(financeMonthPattern) }),
  z.object({ action: z.literal("issue-invoice"), ...ledgerScope, idempotencyKey, userId: objectId, role: z.enum(["student", "teacher", "vendor"]), kind: z.enum(["student-fee", "teacher-payroll", "operating-expense"]), period: z.string().regex(financeMonthPattern), amountTk: wholeTaka, description: z.string().trim().min(2).max(300), issuedAt: z.coerce.date(), expenseCategory: z.enum(["room-rent", "electricity", "other"]).optional(), vendorName: z.string().trim().min(2).max(160).optional() }),
  z.object({ action: z.literal("record-cash"), ...ledgerScope, idempotencyKey, userId: objectId, role: z.enum(["student", "teacher", "vendor"]), kind: z.enum(["student-fee", "teacher-payroll", "operating-expense"]), period: z.string().regex(financeMonthPattern), invoiceAmountTk: wholeTaka, description: z.string().trim().min(2).max(300), direction: z.enum(["in", "out"]), amountTk: wholeTaka.min(1), allocationTk: wholeTaka.optional(), occurredAt: z.coerce.date(), reference: z.string().trim().max(120).optional(), note: z.string().trim().max(500).optional(), expenseCategory: z.enum(["room-rent", "electricity", "other"]).optional(), vendorName: z.string().trim().min(2).max(160).optional() }),
  z.object({ action: z.literal("adjust-invoice"), ...ledgerScope, idempotencyKey, invoiceId: objectId, type: z.enum(["discount", "charge", "correction"]), amountTk: wholeTaka.min(1), effect: z.enum(["debit", "credit"]), reason: z.string().trim().min(3).max(500), occurredAt: z.coerce.date() }),
  z.object({ action: z.literal("reverse-cash"), ...ledgerScope, idempotencyKey, transactionId: objectId, occurredAt: z.coerce.date(), reason: z.string().trim().min(3).max(500) }),
]);

export type FinanceListInput = z.output<typeof financeListSchema>;
export type FinanceMutationInput = z.output<typeof financeMutationSchema>;
