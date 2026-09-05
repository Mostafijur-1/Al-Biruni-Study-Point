import { createHash } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";

export const STEP8_FINANCE_LEDGER_MIGRATION_ID = "step8-finance-ledger-opening-v1";
type PlannedInsert = { collection: string; id: ObjectId; document: Document };
type Unresolved = { collection: string; id: string; reason: string };

function stableId(namespace: string, id: string) { return new ObjectId(createHash("sha256").update(`${namespace}:${id}`).digest("hex").slice(0, 24)); }
function payloadHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function monthDate(month: string) { return new Date(`${month}-01T00:00:00.000Z`); }
function invoiceNumber(month: string, kind: string, counterpartyId: ObjectId) { return `INV-${month.replace("-", "")}-${kind.toUpperCase()}-${String(counterpartyId).toUpperCase()}`; }

async function resolveUserScope(db: Db, row: Document) {
  if (row.organizationId) return { organizationId: row.organizationId as ObjectId };
  if (row.role === "student") {
    const enrollment = await db.collection("batchenrollments").findOne({ studentId: row.userId, status: "active" }, { sort: { effectiveFrom: -1 } });
    const batch = enrollment ? await db.collection("batches").findOne({ _id: enrollment.batchId }, { projection: { organizationId: 1 } }) : null;
    if (batch?.organizationId) return { organizationId: batch.organizationId as ObjectId };
  }
  const organizations = await db.collection("organizations").find({ status: "active" }, { projection: { _id: 1 } }).limit(2).toArray();
  if (organizations.length === 1) return { organizationId: organizations[0]._id as ObjectId };
  return null;
}

function openingRecords(input: { sourceCollection: string; sourceId: ObjectId; organizationId: ObjectId; counterpartyId: ObjectId; role: "student" | "teacher" | "vendor"; kind: "student-fee" | "teacher-payroll" | "operating-expense"; month: string; amountTk: number; clear: boolean; actorId: ObjectId; description: string; category?: string; note?: string }) {
  const invoiceId = stableId("invoice", `${input.sourceCollection}:${input.sourceId}`);
  const lineId = stableId("invoice-line", String(invoiceId));
  const issuedAt = monthDate(input.month);
  const base = { organizationId: input.organizationId };
  const inserts: PlannedInsert[] = [
    { collection: "financeinvoices", id: invoiceId, document: { _id: invoiceId, ...base, counterpartyId: input.counterpartyId, counterpartyRole: input.role, kind: input.kind, period: input.month, invoiceNumber: invoiceNumber(input.month, input.kind, input.counterpartyId), currency: "BDT", totalTk: input.amountTk, issuedAt, createdBy: input.actorId, legacySource: { collection: input.sourceCollection, id: String(input.sourceId) }, createdAt: issuedAt } },
    { collection: "financeinvoicelines", id: lineId, document: { _id: lineId, ...base, invoiceId, lineNo: 1, description: input.description, quantity: 1, unitAmountTk: input.amountTk, amountTk: input.amountTk, createdBy: input.actorId, createdAt: issuedAt } },
  ];
  if (input.category) {
    const expenseId = stableId("ledger-expense", String(input.sourceId));
    inserts.push({ collection: "ledgerexpenses", id: expenseId, document: { _id: expenseId, ...base, invoiceId, category: input.category, vendorName: input.description, period: input.month, amountTk: input.amountTk, incurredAt: issuedAt, note: input.note, createdBy: input.actorId, legacySource: { collection: input.sourceCollection, id: String(input.sourceId) }, createdAt: issuedAt } });
  }
  if (input.clear && input.amountTk > 0) {
    const transactionId = stableId("cash", `${input.sourceCollection}:${input.sourceId}`);
    const direction = input.kind === "student-fee" ? "in" : "out";
    const key = `opening:${input.sourceCollection}:${input.sourceId}`;
    const transactionPayload = { ...base, idempotencyKey: key, counterpartyId: input.counterpartyId, counterpartyRole: input.role, direction, type: "payment", amountTk: input.amountTk, occurredAt: issuedAt, invoiceId: String(invoiceId), allocationTk: input.amountTk, legacySource: { collection: input.sourceCollection, id: String(input.sourceId) } };
    inserts.push(
      { collection: "cashtransactions", id: transactionId, document: { _id: transactionId, ...base, counterpartyId: input.counterpartyId, counterpartyRole: input.role, direction, type: "payment", amountTk: input.amountTk, occurredAt: issuedAt, method: "cash", note: input.note, recordedBy: input.actorId, idempotencyKey: key, payloadHash: payloadHash(transactionPayload), legacySource: { collection: input.sourceCollection, id: String(input.sourceId) }, createdAt: issuedAt } },
      { collection: "paymentallocations", id: stableId("allocation", String(transactionId)), document: { _id: stableId("allocation", String(transactionId)), ...base, transactionId, invoiceId, amountTk: input.amountTk, allocatedBy: input.actorId, createdAt: issuedAt } },
      { collection: "cashreceipts", id: stableId("receipt", String(transactionId)), document: { _id: stableId("receipt", String(transactionId)), ...base, transactionId, receiptNumber: `OPEN-${input.month.replace("-", "")}-${String(transactionId).toUpperCase()}`, issuedAt, issuedBy: input.actorId, createdAt: issuedAt } },
    );
  }
  return inserts;
}

export async function inspectFinanceLedgerBackfill(db: Db, limit = 500) {
  const inserts: PlannedInsert[] = [];
  const unresolved: Unresolved[] = [];
  const payments = await db.collection("monthlypayments").find({}).sort({ month: 1, userId: 1 }).limit(limit).toArray();
  for (const row of payments) {
    if (!Number.isSafeInteger(row.amountTk) || row.amountTk < 0) { unresolved.push({ collection: "MonthlyPayment", id: String(row._id), reason: "Amount is not non-negative whole taka." }); continue; }
    const resolved = await resolveUserScope(db, row);
    if (!resolved) { unresolved.push({ collection: "MonthlyPayment", id: String(row._id), reason: "Organization cannot be resolved uniquely." }); continue; }
    inserts.push(...openingRecords({ sourceCollection: "MonthlyPayment", sourceId: row._id, ...resolved, counterpartyId: row.userId, role: row.role, kind: row.kind, month: row.month, amountTk: row.amountTk, clear: row.status === "clear", actorId: row.updatedBy, description: row.kind === "student-fee" ? "Opening monthly student fee" : "Opening monthly teacher payroll", note: row.note }));
  }
  const expenses = await db.collection("monthlyexpenses").find({}).sort({ month: 1, category: 1 }).limit(limit).toArray();
  for (const row of expenses) {
    if (!Number.isSafeInteger(row.amountTk) || row.amountTk < 0) { unresolved.push({ collection: "MonthlyExpense", id: String(row._id), reason: "Amount is not non-negative whole taka." }); continue; }
    const resolved = await resolveUserScope(db, { ...row, role: "vendor", userId: row._id });
    if (!resolved) { unresolved.push({ collection: "MonthlyExpense", id: String(row._id), reason: "Organization cannot be resolved uniquely." }); continue; }
    inserts.push(...openingRecords({ sourceCollection: "MonthlyExpense", sourceId: row._id, ...resolved, counterpartyId: row._id, role: "vendor", kind: "operating-expense", month: row.month, amountTk: row.amountTk, clear: row.status === "clear", actorId: row.updatedBy, description: row.category === "room-rent" ? "Room rent" : "Electricity bill", category: row.category, note: row.note }));
  }
  const profiles = await db.collection("paymentprofiles").find({ role: "student", isActive: true }).limit(limit).toArray();
  for (const row of profiles) {
    const resolved = await resolveUserScope(db, row);
    if (!resolved) { unresolved.push({ collection: "PaymentProfile", id: String(row._id), reason: "Organization cannot be resolved uniquely." }); continue; }
    const planId = stableId("fee-plan", String(row._id));
    inserts.push(
      { collection: "feeplans", id: planId, document: { _id: planId, ...resolved, code: `LEGACY-${String(row.userId).toUpperCase()}`, name: "Legacy monthly student fee", amountTk: row.defaultAmountTk, billingCycle: "monthly", activeFrom: payments.find((payment) => String(payment.userId) === String(row.userId))?.month ?? new Date().toISOString().slice(0, 7), status: "active", createdBy: row.updatedBy, createdAt: row.createdAt ?? new Date(), updatedAt: row.updatedAt ?? new Date() } },
      { collection: "studentfeeassignments", id: stableId("fee-assignment", String(row._id)), document: { _id: stableId("fee-assignment", String(row._id)), ...resolved, studentId: row.userId, feePlanId: planId, amountTk: row.defaultAmountTk, effectiveFrom: payments.find((payment) => String(payment.userId) === String(row.userId))?.month ?? new Date().toISOString().slice(0, 7), status: "active", assignedBy: row.updatedBy, createdAt: row.createdAt ?? new Date(), updatedAt: row.updatedAt ?? new Date() } },
    );
  }
  const byCollection = Object.fromEntries([...new Set(inserts.map((row) => row.collection))].map((collection) => [collection, inserts.filter((row) => row.collection === collection).length]));
  const legacyTotals = { studentExpectedTk: payments.filter((row) => row.kind === "student-fee").reduce((sum, row) => sum + row.amountTk, 0), studentCollectedTk: payments.filter((row) => row.kind === "student-fee" && row.status === "clear").reduce((sum, row) => sum + row.amountTk, 0), teacherExpectedTk: payments.filter((row) => row.kind === "teacher-payroll").reduce((sum, row) => sum + row.amountTk, 0), teacherPaidTk: payments.filter((row) => row.kind === "teacher-payroll" && row.status === "clear").reduce((sum, row) => sum + row.amountTk, 0), expenseExpectedTk: expenses.reduce((sum, row) => sum + row.amountTk, 0), expensePaidTk: expenses.filter((row) => row.status === "clear").reduce((sum, row) => sum + row.amountTk, 0) };
  return { inserts, report: { plannedTotal: inserts.length, byCollection, unresolvedCount: unresolved.length, unresolved, legacyTotals } };
}

export async function applyFinanceLedgerBackfill(db: Db, limit = 500) {
  const { inserts, report } = await inspectFinanceLedgerBackfill(db, limit);
  if (report.unresolvedCount) throw new Error("Finance ledger migration has unresolved records; review the dry-run report first.");
  let insertedTotal = 0;
  for (const row of inserts) insertedTotal += (await db.collection(row.collection).updateOne({ _id: row.id }, { $setOnInsert: row.document }, { upsert: true })).upsertedCount;
  return { ...report, insertedTotal };
}
