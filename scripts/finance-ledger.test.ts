import assert from "node:assert/strict";
import test from "node:test";
import { financeListSchema, financeMutationSchema } from "../lib/validations/finance.schema.ts";

const id = "507f1f77bcf86cd799439011";
const scope = { organizationId: id, branchId: "507f1f77bcf86cd799439012" };

test("cash ledger contracts require scoped, idempotent, whole-taka records", () => {
  const valid = { action: "record-cash", ...scope, idempotencyKey: "receipt-0001", userId: "507f1f77bcf86cd799439013", role: "student", kind: "student-fee", period: "2026-08", invoiceAmountTk: 1000, description: "August fee", direction: "in", amountTk: 400, allocationTk: 400, occurredAt: "2026-08-10" };
  assert.equal(financeMutationSchema.safeParse(valid).success, true);
  assert.equal(financeMutationSchema.safeParse({ ...valid, amountTk: 400.5 }).success, false);
  assert.equal(financeMutationSchema.safeParse({ ...valid, idempotencyKey: "short" }).success, false);
});

test("finance ledger exposes explicit adjustment and reversal contracts", () => {
  assert.equal(financeMutationSchema.safeParse({ action: "adjust-invoice", ...scope, idempotencyKey: "adjustment-0001", invoiceId: id, type: "discount", amountTk: 100, effect: "credit", reason: "Approved scholarship", occurredAt: "2026-08-10" }).success, true);
  assert.equal(financeMutationSchema.safeParse({ action: "reverse-cash", ...scope, idempotencyKey: "reversal-0001", transactionId: id, occurredAt: "2026-08-11", reason: "Cash entry was duplicated" }).success, true);
});

test("finance list accepts the empty optional filters sent by the all-batches view", () => {
  const parsed = financeListSchema.parse({ month: "2026-08", role: "student", batchId: "", organizationId: "", branchId: "", q: "" });
  assert.equal(parsed.batchId, undefined);
  assert.equal(parsed.organizationId, undefined);
  assert.equal(parsed.branchId, undefined);
});
