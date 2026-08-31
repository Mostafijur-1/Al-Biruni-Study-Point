import { z } from "zod";

export const financeMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const financeListSchema = z.object({
  month: z.string().regex(financeMonthPattern).default(() => new Date().toISOString().slice(0, 7)),
  role: z.enum(["all", "student", "teacher"]).default("all"),
  q: z.string().trim().max(120).default(""),
  batchId: objectId.optional(),
  organizationId: objectId.optional(),
});

export const financeMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-profile"), userId: objectId, organizationId: objectId.optional(), defaultAmountTk: z.coerce.number().int().min(0).max(10_000_000) }),
  z.object({ action: z.literal("set-month"), userId: objectId, organizationId: objectId.optional(), month: z.string().regex(financeMonthPattern), amountTk: z.coerce.number().int().min(0).max(10_000_000), status: z.enum(["due", "clear"]), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("set-expense"), organizationId: objectId.optional(), month: z.string().regex(financeMonthPattern), category: z.enum(["room-rent", "electricity"]), amountTk: z.coerce.number().int().min(0).max(10_000_000), status: z.enum(["due", "clear"]), note: z.string().trim().max(300).optional() }),
]);

export type FinanceListInput = z.output<typeof financeListSchema>;
export type FinanceMutationInput = z.output<typeof financeMutationSchema>;
