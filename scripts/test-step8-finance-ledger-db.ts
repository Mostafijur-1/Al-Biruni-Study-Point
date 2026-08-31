import assert from "node:assert/strict";
import mongoose from "mongoose";
import { NextRequest } from "next/server.js";

import type { RequestContext } from "../lib/application/request-context.ts";
import { AuditLog } from "../lib/db/models/AuditLog.ts";
import { Branch } from "../lib/db/models/Branch.ts";
import { CashReceipt, CashTransaction, FeePlan, FinanceInvoice, LedgerAdjustment, LedgerExpense, PaymentAllocation, StudentFeeAssignment } from "../lib/db/models/FinanceLedger.ts";
import { applyFinanceLedgerBackfill, inspectFinanceLedgerBackfill } from "../lib/db/finance-ledger-backfill.ts";
import { appendLedgerAdjustment, assignStudentFeePlan, ensureLedgerExpense, ensureLedgerInvoice, invoicePosition, recordCashTransaction, reverseCashTransaction } from "../lib/finance/ledger-service.ts";
import { rebuildFinanceMonthSummary } from "../lib/finance/ledger-summary.ts";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is required.");
await mongoose.connect(uri, { dbName: "absp", autoIndex: true });
try {
  const organizationId = new mongoose.Types.ObjectId();
  const branch = await Branch.create({ organizationId, name: "Main", code: "MAIN", status: "active" });
  const actorId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const student2Id = new mongoose.Types.ObjectId();
  const scope = { organizationId: String(organizationId), branchId: String(branch._id) };
  const context: RequestContext = { actor: { id: String(actorId), name: "Cashier", role: "admin" }, request: new NextRequest("http://localhost/api/admin/finance", { headers: { "x-request-id": "step8-test" } }), requestId: "step8-test", scope };

  const invoice = await ensureLedgerInvoice(context, { ...scope, counterpartyId: String(studentId), counterpartyRole: "student", kind: "student-fee", period: "2026-08", amountTk: 1000, description: "August fee", issuedAt: new Date("2026-08-01") });
  const partialInput = { ...scope, idempotencyKey: "cash-partial-0001", counterpartyId: String(studentId), counterpartyRole: "student" as const, direction: "in" as const, amountTk: 400, occurredAt: new Date("2026-08-10"), invoiceId: String(invoice._id), allocationTk: 400 };
  const partial = await recordCashTransaction(context, partialInput);
  const replay = await recordCashTransaction(context, partialInput);
  assert.equal(replay.replayed, true);
  assert.equal(String(partial.transaction._id), String(replay.transaction._id));
  assert.equal((await invoicePosition(invoice._id)).balanceTk, 600);

  const overpayment = await recordCashTransaction(context, { ...scope, idempotencyKey: "cash-overpay-0001", counterpartyId: String(studentId), counterpartyRole: "student", direction: "in", amountTk: 800, occurredAt: new Date("2026-08-11"), invoiceId: String(invoice._id), allocationTk: 600 });
  assert.equal(overpayment.unappliedTk, 200);
  assert.equal((await invoicePosition(invoice._id)).balanceTk, 0);
  assert.equal(await CashTransaction.countDocuments({ counterpartyId: studentId }), 2);
  assert.equal(await CashReceipt.countDocuments({ transactionId: partial.transaction._id }), 1);

  const reversal = await reverseCashTransaction(context, { ...scope, transactionId: String(partial.transaction._id), idempotencyKey: "cash-reversal-0001", occurredAt: new Date("2026-08-12"), reason: "Duplicate cash entry" });
  assert.equal(reversal.transaction.type, "reversal");
  assert.equal((await invoicePosition(invoice._id)).balanceTk, 400);
  await assert.rejects(reverseCashTransaction(context, { ...scope, transactionId: String(partial.transaction._id), idempotencyKey: "cash-reversal-0002", occurredAt: new Date("2026-08-13"), reason: "Second reversal" }), /already been reversed/);

  const discountInvoice = await ensureLedgerInvoice(context, { ...scope, counterpartyId: String(student2Id), counterpartyRole: "student", kind: "student-fee", period: "2026-08", amountTk: 1000, description: "August fee", issuedAt: new Date("2026-08-01") });
  const discount = await appendLedgerAdjustment(context, { ...scope, invoiceId: String(discountInvoice._id), idempotencyKey: "discount-0001", type: "discount", amountTk: 100, effect: "credit", reason: "Approved scholarship", occurredAt: new Date("2026-08-09") });
  const discountReplay = await appendLedgerAdjustment(context, { ...scope, invoiceId: String(discountInvoice._id), idempotencyKey: "discount-0001", type: "discount", amountTk: 100, effect: "credit", reason: "Approved scholarship", occurredAt: new Date("2026-08-09") });
  assert.equal(discountReplay.replayed, true);
  assert.equal(String(discount.adjustment._id), String(discountReplay.adjustment._id));
  assert.equal((await invoicePosition(discountInvoice._id)).balanceTk, 900);
  await assert.rejects(FinanceInvoice.updateOne({ _id: invoice._id }, { $set: { totalTk: 1 } }), /immutable/);
  await assert.rejects(CashTransaction.updateOne({ _id: partial.transaction._id }, { $set: { amountTk: 1 } }), /immutable/);
  await assert.rejects(LedgerAdjustment.deleteOne({ _id: discount.adjustment._id }), /immutable/);

  const summary = await rebuildFinanceMonthSummary({ ...scope, period: "2026-08" });
  assert.equal(summary.student.expectedTk, 1900);
  assert.equal(summary.student.settledTk, 600);
  assert.equal(summary.student.balanceTk, 1300);
  assert.equal(summary.netCashTk, 800);
  assert.equal(summary.unappliedCashTk, 200);
  assert.equal(await PaymentAllocation.countDocuments(), 3);
  assert.ok(await AuditLog.exists({ action: "finance.cash-recorded" }));

  const assigned = await assignStudentFeePlan(context, { ...scope, studentId: String(studentId), code: "MONTHLY-1000", name: "Monthly fee", amountTk: 1000, effectiveFrom: "2026-09" });
  const assignedReplay = await assignStudentFeePlan(context, { ...scope, studentId: String(studentId), code: "MONTHLY-1000", name: "Monthly fee", amountTk: 1000, effectiveFrom: "2026-09" });
  assert.equal(String(assigned.assignmentId), String(assignedReplay.assignmentId));
  assert.equal(await FeePlan.countDocuments(), 1);
  assert.equal(await StudentFeeAssignment.countDocuments(), 1);
  const vendorId = new mongoose.Types.ObjectId();
  const expenseInvoice = await ensureLedgerInvoice(context, { ...scope, counterpartyId: String(vendorId), counterpartyRole: "vendor", kind: "operating-expense", period: "2026-09", amountTk: 2000, description: "Room rent", issuedAt: new Date("2026-09-01") });
  const expense = await ensureLedgerExpense(context, { ...scope, invoiceId: String(expenseInvoice._id), category: "room-rent", vendorName: "Landlord", period: "2026-09", amountTk: 2000, incurredAt: new Date("2026-09-01") });
  assert.equal(String(expense.invoiceId), String(expenseInvoice._id));
  assert.equal(await LedgerExpense.countDocuments(), 1);

  const legacyUserId = new mongoose.Types.ObjectId();
  const legacyPaymentId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection("monthlypayments").insertOne({ _id: legacyPaymentId, organizationId, userId: legacyUserId, role: "teacher", month: "2026-07", kind: "teacher-payroll", amountTk: 5000, status: "clear", updatedBy: actorId, createdAt: new Date(), updatedAt: new Date() });
  const db = mongoose.connection.db;
  if (!db) throw new Error("Missing database handle.");
  const inspected = await inspectFinanceLedgerBackfill(db, 100);
  assert.equal(inspected.report.unresolvedCount, 0);
  assert.equal(inspected.report.legacyTotals.teacherPaidTk, 5000);
  const firstMigration = await applyFinanceLedgerBackfill(db, 100);
  const retryMigration = await applyFinanceLedgerBackfill(db, 100);
  assert.ok(firstMigration.insertedTotal > 0);
  assert.equal(retryMigration.insertedTotal, 0);
  assert.equal(await db.collection("cashtransactions").countDocuments({ "legacySource.collection": "MonthlyPayment", "legacySource.id": String(legacyPaymentId) }), 1);

  console.log(JSON.stringify({ status: "passed", scenarios: ["fee-plan-assignment", "partial-payment", "overpayment", "discount", "expense", "reversal", "idempotent-replay", "immutable-records", "ledger-summary", "legacy-opening-reconciliation"] }, null, 2));
} finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
