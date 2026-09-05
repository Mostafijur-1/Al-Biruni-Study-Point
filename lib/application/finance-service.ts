import { DomainError } from "@/lib/application/domain-error";
import { runIdempotentMutation } from "@/lib/application/idempotency";
import type { RequestContext } from "@/lib/application/request-context";
import { assertAdmin } from "@/lib/application/scope-policy";
import type { ExpenseCategory } from "@/lib/db/models/MonthlyExpense";
import { findFinanceUser, isFinanceUserEligible, loadFinanceLedger, resolveFinanceLedgerScope, upsertFinanceExpense, upsertMonthlyPayment, upsertPaymentProfile } from "@/lib/repositories/finance-repository";
import { appendLedgerAdjustment, assignStudentFeePlan, ensureLedgerExpense, ensureLedgerInvoice, recordCashTransaction, reverseCashTransaction } from "@/lib/finance/ledger-service";
import { rebuildFinanceMonthSummary } from "@/lib/finance/ledger-summary";
import { readFinanceMonthProjection } from "@/lib/reporting/projection-service";
import type { FinanceListInput, FinanceMutationInput } from "@/lib/validations/finance.schema";

export async function getFinanceLedger(context: RequestContext, input: FinanceListInput) {
  assertAdmin(context.actor);
  const rows = await loadFinanceLedger(context, input);
  const ledgerScope = await resolveFinanceLedgerScope(context, input);
  const ledger = ledgerScope ? await readFinanceMonthProjection({ ...ledgerScope, period: input.month }) ?? await rebuildFinanceMonthSummary({ ...ledgerScope, period: input.month }) : null;
  const ledgerAuthoritative = process.env.FINANCE_LEDGER_AUTHORITY_ENABLED?.trim().toLowerCase() === "true" && Boolean(ledger);
  const ledgerPositionByUser = new Map(ledger?.positions.filter((row) => row.kind !== "operating-expense").map((row) => [row.counterpartyId, row]) ?? []);
  const batchMap = new Map(rows.batches.map((row) => [String(row._id), row]));
  const studentBatchMap = new Map(rows.allActiveEnrollments.map((row) => [String(row.studentId), String(row.batchId)]));
  const profileMap = new Map(rows.profiles.map((row) => [String(row.userId), row]));
  const paymentMap = new Map(rows.payments.map((row) => [String(row.userId), row]));
  const toRecord = (user: (typeof rows.financeUsers)[number]) => {
    const role = user.role as "student" | "teacher";
    const profile = profileMap.get(String(user._id));
    const payment = paymentMap.get(String(user._id));
    const ledgerPosition = ledgerAuthoritative ? ledgerPositionByUser.get(String(user._id)) : undefined;
    const batchId = studentBatchMap.get(String(user._id));
    return {
      user: { id: String(user._id), name: user.name, studentCode: user.studentCode, reference: user.reference, phone: user.phone, email: user.email, role, studentClass: user.studentClass, isActive: user.isActive, ...(role === "student" && batchId ? { batch: { id: batchId, name: batchMap.get(batchId)?.name } } : {}) },
      profile: { subjects: profile?.subjects ?? [], defaultAmountTk: profile?.defaultAmountTk ?? 0, configured: Boolean(profile) },
      payment: ledgerPosition ? { amountTk: ledgerPosition.adjustedTotalTk, paidTk: ledgerPosition.settledTk, balanceTk: ledgerPosition.balanceTk, status: ledgerPosition.balanceTk < 0 ? "overpaid" : ledgerPosition.balanceTk === 0 ? "clear" : ledgerPosition.settledTk > 0 ? "partial" : "due", saved: true }
        : { amountTk: payment?.amountTk ?? profile?.defaultAmountTk ?? 0, paidTk: payment?.status === "clear" ? payment.amountTk : 0, balanceTk: payment?.status === "clear" ? 0 : payment?.amountTk ?? profile?.defaultAmountTk ?? 0, status: payment?.status ?? "due", clearedAt: payment?.clearedAt?.toISOString(), note: payment?.note, saved: Boolean(payment) },
    };
  };
  const records = rows.users.map(toRecord);
  const financeRecords = rows.financeUsers.map(toRecord);
  const students = financeRecords.filter((row) => row.user.role === "student");
  const teachers = financeRecords.filter((row) => row.user.role === "teacher");
  const studentExpectedTk = students.reduce((sum, row) => sum + row.payment.amountTk, 0);
  const studentCollectedTk = students.filter((row) => row.payment.status === "clear").reduce((sum, row) => sum + row.payment.amountTk, 0);
  const teacherPayrollTk = teachers.reduce((sum, row) => sum + row.payment.amountTk, 0);
  const teacherPaidTk = teachers.filter((row) => row.payment.status === "clear").reduce((sum, row) => sum + row.payment.amountTk, 0);
  const expenseMap = new Map(rows.expenses.map((row) => [row.category, row]));
  const expenses = (["room-rent", "electricity"] as ExpenseCategory[]).map((category) => {
    const expense = expenseMap.get(category);
    return { category, amountTk: expense?.amountTk ?? 0, status: expense?.status ?? "due", clearedAt: expense?.clearedAt?.toISOString(), note: expense?.note, saved: Boolean(expense) };
  });
  const operatingExpenseTk = expenses.reduce((sum, row) => sum + row.amountTk, 0);
  const operatingPaidTk = expenses.filter((row) => row.status === "clear").reduce((sum, row) => sum + row.amountTk, 0);
  const legacySummary = {
    studentExpectedTk, studentCollectedTk, studentDueTk: studentExpectedTk - studentCollectedTk,
    teacherPayrollTk, teacherPaidTk, teacherDueTk: teacherPayrollTk - teacherPaidTk,
    operatingExpenseTk, operatingPaidTk, operatingDueTk: operatingExpenseTk - operatingPaidTk,
    netCashTk: studentCollectedTk - teacherPaidTk - operatingPaidTk,
    studentClearCount: students.filter((row) => row.payment.status === "clear").length, studentDueCount: students.filter((row) => row.payment.status !== "clear").length,
    teacherClearCount: teachers.filter((row) => row.payment.status === "clear").length, teacherDueCount: teachers.filter((row) => row.payment.status !== "clear").length,
  };
  const ledgerSummary = ledger ? { studentExpectedTk: ledger.student.expectedTk, studentCollectedTk: ledger.student.settledTk, studentDueTk: ledger.student.balanceTk, teacherPayrollTk: ledger.payroll.expectedTk, teacherPaidTk: ledger.payroll.settledTk, teacherDueTk: ledger.payroll.balanceTk, operatingExpenseTk: ledger.expense.expectedTk, operatingPaidTk: ledger.expense.settledTk, operatingDueTk: ledger.expense.balanceTk, netCashTk: ledger.netCashTk, studentClearCount: ledger.positions.filter((row) => row.kind === "student-fee" && row.balanceTk === 0).length, studentDueCount: ledger.positions.filter((row) => row.kind === "student-fee" && row.balanceTk !== 0).length, teacherClearCount: ledger.positions.filter((row) => row.kind === "teacher-payroll" && row.balanceTk === 0).length, teacherDueCount: ledger.positions.filter((row) => row.kind === "teacher-payroll" && row.balanceTk !== 0).length } : null;
  return { month: input.month, ledgerMode: ledgerAuthoritative ? "authoritative" : ledger ? "shadow" : "legacy", records, batches: rows.batches.map((batch) => ({ id: String(batch._id), name: batch.name, status: batch.status })), expenses, summary: ledgerAuthoritative && ledgerSummary ? ledgerSummary : legacySummary, reconciliation: ledgerSummary ? { legacy: legacySummary, ledger: ledgerSummary, matches: JSON.stringify(legacySummary) === JSON.stringify(ledgerSummary), unappliedCashTk: ledger?.unappliedCashTk ?? 0 } : undefined };
}

export async function mutateFinance(context: RequestContext, input: FinanceMutationInput) {
  assertAdmin(context.actor);
  const targetId = "userId" in input ? input.userId : "studentId" in input ? input.studentId : "invoiceId" in input ? input.invoiceId : "transactionId" in input ? input.transactionId : `${input.month}:${input.category}`;
  return runIdempotentMutation(context, { workflow: `finance.${input.action}`, targetId, payload: input }, async () => {
    if (input.action === "assign-fee-plan") {
      const scope = await resolveFinanceLedgerScope(context, input);
      if (!scope) throw new DomainError("Configure the active organization before assigning a fee plan.", 409);
      const user = await findFinanceUser(context, input.studentId);
      if (!user || user.role !== "student" || !(await isFinanceUserEligible({ ...context, scope }, input.studentId, "student"))) throw new DomainError("Active student not found in this organization.", 404);
      return assignStudentFeePlan(context, { ...scope, studentId: input.studentId, code: input.code, name: input.name, amountTk: input.amountTk, effectiveFrom: input.effectiveFrom });
    }
    if (input.action === "issue-invoice") {
      const scope = await resolveFinanceLedgerScope(context, input);
      if (!scope) throw new DomainError("Configure the active organization before issuing an invoice.", 409);
      if (input.role !== "vendor") {
        const user = await findFinanceUser(context, input.userId);
        if (!user || user.role !== input.role || !(await isFinanceUserEligible({ ...context, scope }, input.userId, input.role))) throw new DomainError("Active finance counterparty not found in this organization.", 404);
      }
      const validShape = input.role === "student" ? input.kind === "student-fee" : input.role === "teacher" ? input.kind === "teacher-payroll" : input.kind === "operating-expense";
      if (!validShape) throw new DomainError("Role and invoice kind are inconsistent.", 400, "VALIDATION_ERROR");
      const invoice = await ensureLedgerInvoice(context, { ...scope, counterpartyId: input.userId, counterpartyRole: input.role, kind: input.kind, period: input.period, amountTk: input.amountTk, description: input.description, issuedAt: input.issuedAt });
      if (input.kind === "operating-expense") {
        if (!input.expenseCategory || !input.vendorName) throw new DomainError("Operating invoices require an expense category and vendor name.", 400, "VALIDATION_ERROR");
        await ensureLedgerExpense(context, { ...scope, invoiceId: String(invoice._id), category: input.expenseCategory, vendorName: input.vendorName, period: input.period, amountTk: input.amountTk, incurredAt: input.issuedAt });
      }
      return { invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber };
    }
    if (input.action === "record-cash") {
      const scope = await resolveFinanceLedgerScope(context, input);
      if (!scope) throw new DomainError("Configure the active organization before recording cash.", 409);
      if (input.role !== "vendor") {
        const user = await findFinanceUser(context, input.userId);
        if (!user || user.role !== input.role) throw new DomainError("Finance counterparty not found.", 404);
        if (!(await isFinanceUserEligible({ ...context, scope }, input.userId, input.role))) throw new DomainError("Finance counterparty is not active in this organization.", 403);
      }
      const validCashShape = input.role === "student" ? input.kind === "student-fee" && input.direction === "in"
        : input.role === "teacher" ? input.kind === "teacher-payroll" && input.direction === "out"
        : input.kind === "operating-expense" && input.direction === "out";
      if (!validCashShape) throw new DomainError("Cash direction, role, and invoice kind are inconsistent.", 400, "VALIDATION_ERROR");
      const invoice = await ensureLedgerInvoice(context, { ...scope, counterpartyId: input.userId, counterpartyRole: input.role, kind: input.kind, period: input.period, amountTk: input.invoiceAmountTk, description: input.description, issuedAt: input.occurredAt });
      if (input.kind === "operating-expense") {
        if (!input.expenseCategory || !input.vendorName) throw new DomainError("Operating cash requires an expense category and vendor name.", 400, "VALIDATION_ERROR");
        await ensureLedgerExpense(context, { ...scope, invoiceId: String(invoice._id), category: input.expenseCategory, vendorName: input.vendorName, period: input.period, amountTk: input.invoiceAmountTk, incurredAt: input.occurredAt, note: input.note });
      }
      const recorded = await recordCashTransaction(context, { ...scope, idempotencyKey: input.idempotencyKey, counterpartyId: input.userId, counterpartyRole: input.role, direction: input.direction, amountTk: input.amountTk, occurredAt: input.occurredAt, invoiceId: String(invoice._id), allocationTk: input.allocationTk, reference: input.reference, note: input.note });
      return { invoiceId: String(invoice._id), transactionId: String(recorded.transaction._id), receiptNumber: recorded.receipt?.receiptNumber, amountTk: recorded.transaction.amountTk, unappliedTk: recorded.unappliedTk, replayed: recorded.replayed };
    }
    if (input.action === "adjust-invoice") {
      const scope = await resolveFinanceLedgerScope(context, input);
      if (!scope) throw new DomainError("Configure the active organization before adjusting an invoice.", 409);
      const result = await appendLedgerAdjustment(context, { ...scope, invoiceId: input.invoiceId, idempotencyKey: input.idempotencyKey, type: input.type, amountTk: input.amountTk, effect: input.effect, reason: input.reason, occurredAt: input.occurredAt });
      return { adjustmentId: String(result.adjustment._id), replayed: result.replayed };
    }
    if (input.action === "reverse-cash") {
      const scope = await resolveFinanceLedgerScope(context, input);
      if (!scope) throw new DomainError("Configure the active organization before reversing cash.", 409);
      const result = await reverseCashTransaction(context, { ...scope, transactionId: input.transactionId, idempotencyKey: input.idempotencyKey, occurredAt: input.occurredAt, reason: input.reason });
      return { transactionId: String(result.transaction._id), receiptNumber: result.receipt?.receiptNumber, replayed: result.replayed };
    }
    if (input.action === "set-expense") {
      const expense = await upsertFinanceExpense(context, input);
      return { expense: { month: expense.month, category: expense.category, amountTk: expense.amountTk, status: expense.status, clearedAt: expense.clearedAt?.toISOString() } };
    }
    const user = await findFinanceUser(context, input.userId);
    if (!user) throw new DomainError("Student or teacher not found.", 404);
    const role = user.role as "student" | "teacher";
    if (!(await isFinanceUserEligible(context, input.userId, role))) {
      throw new DomainError(role === "student" ? "Student has no active batch enrollment." : "This teacher is not an ABSP member.", 403);
    }
    if (input.action === "set-profile") {
      const profile = await upsertPaymentProfile(context, { ...input, role });
      return { profile: { userId: String(profile.userId), subjects: profile.subjects, defaultAmountTk: profile.defaultAmountTk } };
    }
    const payment = await upsertMonthlyPayment(context, { ...input, role });
    return { payment: { userId: String(payment.userId), month: payment.month, amountTk: payment.amountTk, status: payment.status, clearedAt: payment.clearedAt?.toISOString() } };
  });
}
