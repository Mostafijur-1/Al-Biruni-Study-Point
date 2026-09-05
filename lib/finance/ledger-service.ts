import mongoose, { type ClientSession, type HydratedDocument, Types } from "mongoose";

import { idempotencyPayloadHash } from "../application/idempotency-key.ts";
import type { RequestContext } from "../application/request-context.ts";
import { writeAuditLog } from "../audit/write-audit-log.ts";
import { CashReceipt, CashTransaction, FeePlan, FinanceInvoice, FinanceInvoiceLine, LedgerAdjustment, LedgerExpense, PaymentAllocation, StudentFeeAssignment, type IFinanceInvoice, type LedgerCounterpartyRole, type LedgerInvoiceKind } from "../db/models/FinanceLedger.ts";

type Scope = { organizationId: string };
type InvoiceInput = Scope & { counterpartyId: string; counterpartyRole: LedgerCounterpartyRole; kind: LedgerInvoiceKind; period: string; amountTk: number; description: string; issuedAt: Date; dueAt?: Date; legacySource?: { collection: string; id: string } };

function requireWholeTaka(value: number, field: string, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new Error(`${field} must be a positive whole-taka amount.`);
}
function invoiceNumber(input: InvoiceInput) { return `INV-${input.period.replace("-", "")}-${input.kind.toUpperCase()}-${input.counterpartyId.toUpperCase()}`; }
function isDuplicate(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === 11000; }

export async function ensureLedgerInvoice(context: RequestContext, input: InvoiceInput, session?: ClientSession): Promise<HydratedDocument<IFinanceInvoice>> {
  requireWholeTaka(input.amountTk, "Invoice amount", true);
  if (!session) {
    const ownedSession = await mongoose.startSession();
    try {
      let output: HydratedDocument<IFinanceInvoice> | null = null;
      await ownedSession.withTransaction(async () => { output = await ensureLedgerInvoice(context, input, ownedSession); });
      if (!output) throw new Error("Finance invoice did not complete.");
      return output;
    } finally { await ownedSession.endSession(); }
  }
  const filter = { organizationId: input.organizationId, counterpartyId: input.counterpartyId, period: input.period, kind: input.kind };
  const existing = await FinanceInvoice.findOne(filter).session(session);
  if (existing) {
    if (existing.totalTk !== input.amountTk) throw new Error("An immutable invoice already exists with a different amount; append an adjustment.");
    return existing;
  }
  try {
    const [invoice] = await FinanceInvoice.create([{ organizationId: input.organizationId, counterpartyId: input.counterpartyId, counterpartyRole: input.counterpartyRole, kind: input.kind, period: input.period, invoiceNumber: invoiceNumber(input), currency: "BDT", totalTk: input.amountTk, issuedAt: input.issuedAt, dueAt: input.dueAt, createdBy: context.actor.id, legacySource: input.legacySource }], { session });
    await FinanceInvoiceLine.create([{ organizationId: input.organizationId, invoiceId: invoice._id, lineNo: 1, description: input.description, quantity: 1, unitAmountTk: input.amountTk, amountTk: input.amountTk, createdBy: context.actor.id }], { session });
    await writeAuditLog({ request: context.request, actor: context.actor, organizationId: input.organizationId, action: "finance.invoice-issued", resourceType: "FinanceInvoice", resourceId: invoice._id, reason: "Finance invoice issued", after: { invoiceNumber: invoice.invoiceNumber, kind: invoice.kind, period: invoice.period, totalTk: invoice.totalTk }, session });
    return invoice;
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const raced = await FinanceInvoice.findOne(filter).session(session);
    if (!raced || raced.totalTk !== input.amountTk) throw error;
    return raced;
  }
}

export async function invoicePosition(invoiceId: Types.ObjectId, session?: ClientSession) {
  const invoice = await FinanceInvoice.findById(invoiceId).session(session ?? null).lean();
  if (!invoice) throw new Error("Finance invoice not found.");
  const [adjustments, allocations] = await Promise.all([
    LedgerAdjustment.find({ invoiceId }).session(session ?? null).lean(),
    PaymentAllocation.find({ invoiceId }).session(session ?? null).lean(),
  ]);
  const transactionIds = allocations.map((row) => row.transactionId);
  const transactions = await CashTransaction.find({ _id: { $in: transactionIds } }).session(session ?? null).lean();
  const transactionById = new Map(transactions.map((row) => [String(row._id), row]));
  const adjustedTotalTk = invoice.totalTk + adjustments.reduce((sum, row) => sum + (row.effect === "debit" ? row.amountTk : -row.amountTk), 0);
  const expectedDirection = invoice.kind === "student-fee" ? "in" : "out";
  const settledTk = allocations.reduce((sum, row) => {
    const transaction = transactionById.get(String(row.transactionId));
    if (!transaction) throw new Error("Payment allocation references a missing transaction.");
    return sum + (transaction.direction === expectedDirection ? row.amountTk : -row.amountTk);
  }, 0);
  return { invoice, adjustedTotalTk, settledTk, balanceTk: adjustedTotalTk - settledTk };
}

export async function recordCashTransaction(context: RequestContext, input: Scope & { idempotencyKey: string; counterpartyId: string; counterpartyRole: LedgerCounterpartyRole; direction: "in" | "out"; type?: "payment" | "refund" | "reversal"; amountTk: number; occurredAt: Date; invoiceId?: string; allocationTk?: number; reference?: string; note?: string; reversesTransactionId?: string; legacySource?: { collection: string; id: string } }) {
  requireWholeTaka(input.amountTk, "Cash amount");
  const allocationTk = input.allocationTk ?? (input.invoiceId ? input.amountTk : 0);
  requireWholeTaka(allocationTk, "Allocation", true);
  if (allocationTk > input.amountTk) throw new Error("Allocation cannot exceed the cash amount.");
  const payloadHash = idempotencyPayloadHash(input);
  const identity = { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey };
  const existing = await CashTransaction.findOne(identity).lean();
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new Error("Cash idempotency key was reused with different details.");
    return { transaction: existing, receipt: await CashReceipt.findOne({ transactionId: existing._id }).lean(), replayed: true, unappliedTk: existing.amountTk - (await PaymentAllocation.find({ transactionId: existing._id }).then((rows) => rows.reduce((sum, row) => sum + row.amountTk, 0))) };
  }
  const session = await mongoose.startSession();
  try {
    let output: Awaited<ReturnType<typeof loadTransactionOutcome>> | null = null;
    await session.withTransaction(async () => {
      if (input.invoiceId) {
        const position = await invoicePosition(new Types.ObjectId(input.invoiceId), session);
        if (String(position.invoice.organizationId) !== input.organizationId || String(position.invoice.counterpartyId) !== input.counterpartyId) throw new Error("Cash allocation is outside the organization or counterparty.");
        const expectedDirection = position.invoice.kind === "student-fee" ? "in" : "out";
        const transactionType = input.type ?? "payment";
        if ((transactionType === "payment" && input.direction !== expectedDirection) || (transactionType !== "payment" && input.direction === expectedDirection)) throw new Error("Cash direction is inconsistent with the invoice and transaction type.");
        if (transactionType === "payment" && allocationTk > Math.max(0, position.balanceTk)) throw new Error("Allocation exceeds the current invoice balance; leave the remainder as unapplied cash.");
      }
      const [transaction] = await CashTransaction.create([{ ...input, type: input.type ?? "payment", method: "cash", recordedBy: context.actor.id, payloadHash }], { session });
      if (input.invoiceId && allocationTk) await PaymentAllocation.create([{ organizationId: input.organizationId, transactionId: transaction._id, invoiceId: input.invoiceId, amountTk: allocationTk, allocatedBy: context.actor.id }], { session });
      const [receipt] = await CashReceipt.create([{ organizationId: input.organizationId, transactionId: transaction._id, receiptNumber: `CASH-${input.occurredAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(transaction._id).toUpperCase()}`, issuedAt: input.occurredAt, issuedBy: context.actor.id }], { session });
      await writeAuditLog({ request: context.request, actor: context.actor, organizationId: input.organizationId, action: "finance.cash-recorded", resourceType: "CashTransaction", resourceId: transaction._id, reason: input.note ?? "Cash transaction recorded", after: { direction: input.direction, type: input.type ?? "payment", amountTk: input.amountTk, allocationTk, receiptNumber: receipt.receiptNumber }, session });
      output = { transaction, receipt, replayed: false, unappliedTk: input.amountTk - allocationTk };
    });
    if (!output) throw new Error("Cash transaction did not complete.");
    return output;
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const raced = await CashTransaction.findOne(identity).lean();
    if (!raced || raced.payloadHash !== payloadHash) throw error;
    return { ...(await loadTransactionOutcome(raced._id)), replayed: true };
  } finally { await session.endSession(); }
}

async function loadTransactionOutcome(transactionId: Types.ObjectId) {
  const transaction = await CashTransaction.findById(transactionId).lean();
  if (!transaction) throw new Error("Cash transaction not found.");
  const [receipt, allocations] = await Promise.all([CashReceipt.findOne({ transactionId }).lean(), PaymentAllocation.find({ transactionId }).lean()]);
  return { transaction, receipt, replayed: false, unappliedTk: transaction.amountTk - allocations.reduce((sum, row) => sum + row.amountTk, 0) };
}

export async function reverseCashTransaction(context: RequestContext, input: Scope & { transactionId: string; idempotencyKey: string; occurredAt: Date; reason: string }) {
  const original = await CashTransaction.findOne({ _id: input.transactionId, organizationId: input.organizationId }).lean();
  if (!original) throw new Error("Cash transaction not found.");
  if (original.type === "reversal") throw new Error("A reversal cannot be reversed directly.");
  if (await CashTransaction.exists({ reversesTransactionId: original._id })) throw new Error("Cash transaction has already been reversed.");
  const allocations = await PaymentAllocation.find({ transactionId: original._id }).lean();
  if (allocations.length > 1) throw new Error("Multiple-allocation reversal is not supported by this workflow.");
  return recordCashTransaction(context, { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey, counterpartyId: String(original.counterpartyId), counterpartyRole: original.counterpartyRole, direction: original.direction === "in" ? "out" : "in", type: "reversal", amountTk: original.amountTk, occurredAt: input.occurredAt, invoiceId: allocations[0] ? String(allocations[0].invoiceId) : undefined, allocationTk: allocations[0]?.amountTk, reversesTransactionId: String(original._id), note: input.reason });
}

export async function appendLedgerAdjustment(context: RequestContext, input: Scope & { invoiceId: string; idempotencyKey: string; type: "discount" | "charge" | "correction"; amountTk: number; effect: "debit" | "credit"; reason: string; occurredAt: Date }) {
  requireWholeTaka(input.amountTk, "Adjustment amount");
  const payloadHash = idempotencyPayloadHash(input);
  const identity = { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey };
  const existing = await LedgerAdjustment.findOne(identity).lean();
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new Error("Adjustment idempotency key was reused with different details.");
    return { adjustment: existing, replayed: true };
  }
  const session = await mongoose.startSession();
  try {
    let adjustmentId: Types.ObjectId | null = null;
    await session.withTransaction(async () => {
      const invoice = await FinanceInvoice.findOne({ _id: input.invoiceId, organizationId: input.organizationId }).session(session).lean();
      if (!invoice) throw new Error("Finance invoice not found.");
      const [adjustment] = await LedgerAdjustment.create([{ ...input, recordedBy: context.actor.id, payloadHash }], { session });
      adjustmentId = adjustment._id;
      await writeAuditLog({ request: context.request, actor: context.actor, organizationId: input.organizationId, action: "finance.adjustment-recorded", resourceType: "LedgerAdjustment", resourceId: adjustment._id, reason: input.reason, after: { invoiceId: input.invoiceId, type: input.type, amountTk: input.amountTk, effect: input.effect }, session });
    });
    if (!adjustmentId) throw new Error("Ledger adjustment did not complete.");
    const adjustment = await LedgerAdjustment.findById(adjustmentId);
    if (!adjustment) throw new Error("Ledger adjustment could not be reloaded.");
    return { adjustment, replayed: false };
  } finally { await session.endSession(); }
}

export async function assignStudentFeePlan(context: RequestContext, input: Scope & { studentId: string; code: string; name: string; amountTk: number; effectiveFrom: string }): Promise<{ feePlanId: Types.ObjectId; assignmentId: Types.ObjectId; replayed: boolean }> {
  requireWholeTaka(input.amountTk, "Fee plan amount", true);
  const session = await mongoose.startSession();
  try {
    let output: { feePlanId: Types.ObjectId; assignmentId: Types.ObjectId; replayed: boolean } | null = null;
    await session.withTransaction(async () => {
      let plan = await FeePlan.findOne({ organizationId: input.organizationId, code: input.code }).session(session);
      if (plan && (plan.amountTk !== input.amountTk || plan.name !== input.name)) throw new Error("Fee-plan code already exists with different terms.");
      if (!plan) plan = await FeePlan.create([{ organizationId: input.organizationId, code: input.code, name: input.name, amountTk: input.amountTk, billingCycle: "monthly", activeFrom: input.effectiveFrom, status: "active", createdBy: context.actor.id }], { session }).then((rows) => rows[0]);
      if (!plan) throw new Error("Fee plan could not be created.");
      const existing = await StudentFeeAssignment.findOne({ organizationId: input.organizationId, studentId: input.studentId, effectiveFrom: input.effectiveFrom }).session(session);
      if (existing) {
        if (String(existing.feePlanId) !== String(plan._id) || existing.amountTk !== input.amountTk) throw new Error("A different fee assignment already starts in this period.");
        output = { feePlanId: plan._id, assignmentId: existing._id, replayed: true }; return;
      }
      const previousMonth = new Date(`${input.effectiveFrom}-01T00:00:00.000Z`); previousMonth.setUTCDate(0);
      await StudentFeeAssignment.updateMany({ organizationId: input.organizationId, studentId: input.studentId, status: "active", effectiveFrom: { $lt: input.effectiveFrom } }, { $set: { status: "ended", effectiveTo: previousMonth.toISOString().slice(0, 7) } }, { session });
      const [assignment] = await StudentFeeAssignment.create([{ organizationId: input.organizationId, studentId: input.studentId, feePlanId: plan._id, amountTk: input.amountTk, effectiveFrom: input.effectiveFrom, status: "active", assignedBy: context.actor.id }], { session });
      await writeAuditLog({ request: context.request, actor: context.actor, organizationId: input.organizationId, action: "finance.fee-plan-assigned", resourceType: "StudentFeeAssignment", resourceId: assignment._id, reason: "Student fee plan assigned", after: { studentId: input.studentId, feePlanId: String(plan._id), amountTk: input.amountTk, effectiveFrom: input.effectiveFrom }, session });
      output = { feePlanId: plan._id, assignmentId: assignment._id, replayed: false };
    });
    if (!output) throw new Error("Fee assignment did not complete.");
    return output;
  } finally { await session.endSession(); }
}

export async function ensureLedgerExpense(context: RequestContext, input: Scope & { invoiceId: string; category: "room-rent" | "electricity" | "other"; vendorName: string; period: string; amountTk: number; incurredAt: Date; note?: string }) {
  requireWholeTaka(input.amountTk, "Expense amount", true);
  const existing = await LedgerExpense.findOne({ invoiceId: input.invoiceId });
  if (existing) {
    if (existing.amountTk !== input.amountTk || existing.category !== input.category || existing.vendorName !== input.vendorName) throw new Error("An immutable expense already exists with different details.");
    return existing;
  }
  return LedgerExpense.create({ ...input, createdBy: context.actor.id });
}
