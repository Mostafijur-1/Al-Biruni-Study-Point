import { CashTransaction, FinanceInvoice, LedgerAdjustment, PaymentAllocation } from "../db/models/FinanceLedger.ts";

export async function rebuildFinanceMonthSummary(input: { organizationId: string; branchId: string; period: string }) {
  const scope = { organizationId: input.organizationId, branchId: input.branchId };
  const invoices = await FinanceInvoice.find({ ...scope, period: input.period }).lean();
  const invoiceIds = invoices.map((row) => row._id);
  const [adjustments, allocations] = await Promise.all([
    LedgerAdjustment.find({ ...scope, invoiceId: { $in: invoiceIds } }).lean(),
    PaymentAllocation.find({ ...scope, invoiceId: { $in: invoiceIds } }).lean(),
  ]);
  const transactions = await CashTransaction.find({ ...scope, _id: { $in: allocations.map((row) => row.transactionId) } }).lean();
  const transactionById = new Map(transactions.map((row) => [String(row._id), row]));
  const adjustmentByInvoice = new Map<string, typeof adjustments>();
  const allocationByInvoice = new Map<string, typeof allocations>();
  for (const row of adjustments) adjustmentByInvoice.set(String(row.invoiceId), [...(adjustmentByInvoice.get(String(row.invoiceId)) ?? []), row]);
  for (const row of allocations) allocationByInvoice.set(String(row.invoiceId), [...(allocationByInvoice.get(String(row.invoiceId)) ?? []), row]);
  const positions = invoices.map((invoice) => {
    const adjustedTotalTk = invoice.totalTk + (adjustmentByInvoice.get(String(invoice._id)) ?? []).reduce((sum, row) => sum + (row.effect === "debit" ? row.amountTk : -row.amountTk), 0);
    const expectedDirection = invoice.kind === "student-fee" ? "in" : "out";
    const settledTk = (allocationByInvoice.get(String(invoice._id)) ?? []).reduce((sum, row) => {
      const transaction = transactionById.get(String(row.transactionId));
      if (!transaction) throw new Error("Finance ledger contains an allocation without its cash transaction.");
      return sum + (transaction.direction === expectedDirection ? row.amountTk : -row.amountTk);
    }, 0);
    return { invoiceId: String(invoice._id), kind: invoice.kind, counterpartyId: String(invoice.counterpartyId), adjustedTotalTk, settledTk, balanceTk: adjustedTotalTk - settledTk };
  });
  const totals = (kind: (typeof positions)[number]["kind"]) => positions.filter((row) => row.kind === kind).reduce((sum, row) => ({ expectedTk: sum.expectedTk + row.adjustedTotalTk, settledTk: sum.settledTk + row.settledTk, balanceTk: sum.balanceTk + row.balanceTk }), { expectedTk: 0, settledTk: 0, balanceTk: 0 });
  const student = totals("student-fee");
  const payroll = totals("teacher-payroll");
  const expense = totals("operating-expense");
  const allCash = await CashTransaction.find({ ...scope, occurredAt: { $gte: new Date(`${input.period}-01T00:00:00.000Z`), $lt: new Date(new Date(`${input.period}-01T00:00:00.000Z`).setUTCMonth(new Date(`${input.period}-01T00:00:00.000Z`).getUTCMonth() + 1)) } }).lean();
  const cashInTk = allCash.filter((row) => row.direction === "in").reduce((sum, row) => sum + row.amountTk, 0);
  const cashOutTk = allCash.filter((row) => row.direction === "out").reduce((sum, row) => sum + row.amountTk, 0);
  const allocatedByTransaction = new Map<string, number>();
  for (const allocation of allocations) allocatedByTransaction.set(String(allocation.transactionId), (allocatedByTransaction.get(String(allocation.transactionId)) ?? 0) + allocation.amountTk);
  const unappliedCashTk = transactions.reduce((sum, row) => sum + Math.max(0, row.amountTk - (allocatedByTransaction.get(String(row._id)) ?? 0)), 0);
  return { period: input.period, positions, student, payroll, expense, cashInTk, cashOutTk, netCashTk: cashInTk - cashOutTk, unappliedCashTk };
}
