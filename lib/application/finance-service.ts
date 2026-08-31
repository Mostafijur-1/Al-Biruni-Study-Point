import { DomainError } from "@/lib/application/domain-error";
import { runIdempotentMutation } from "@/lib/application/idempotency";
import type { RequestContext } from "@/lib/application/request-context";
import { assertAdmin } from "@/lib/application/scope-policy";
import type { ExpenseCategory } from "@/lib/db/models/MonthlyExpense";
import { findFinanceUser, isFinanceUserEligible, loadFinanceLedger, upsertFinanceExpense, upsertMonthlyPayment, upsertPaymentProfile } from "@/lib/repositories/finance-repository";
import type { FinanceListInput, FinanceMutationInput } from "@/lib/validations/finance.schema";

export async function getFinanceLedger(context: RequestContext, input: FinanceListInput) {
  assertAdmin(context.actor);
  const rows = await loadFinanceLedger(context, input);
  const batchMap = new Map(rows.batches.map((row) => [String(row._id), row]));
  const studentBatchMap = new Map(rows.allActiveEnrollments.map((row) => [String(row.studentId), String(row.batchId)]));
  const profileMap = new Map(rows.profiles.map((row) => [String(row.userId), row]));
  const paymentMap = new Map(rows.payments.map((row) => [String(row.userId), row]));
  const toRecord = (user: (typeof rows.financeUsers)[number]) => {
    const role = user.role as "student" | "teacher";
    const profile = profileMap.get(String(user._id));
    const payment = paymentMap.get(String(user._id));
    const batchId = studentBatchMap.get(String(user._id));
    return {
      user: { id: String(user._id), name: user.name, studentCode: user.studentCode, reference: user.reference, phone: user.phone, email: user.email, role, studentClass: user.studentClass, isActive: user.isActive, ...(role === "student" && batchId ? { batch: { id: batchId, name: batchMap.get(batchId)?.name } } : {}) },
      profile: { subjects: profile?.subjects ?? [], defaultAmountTk: profile?.defaultAmountTk ?? 0, configured: Boolean(profile) },
      payment: { amountTk: payment?.amountTk ?? profile?.defaultAmountTk ?? 0, status: payment?.status ?? "due", clearedAt: payment?.clearedAt?.toISOString(), note: payment?.note, saved: Boolean(payment) },
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
  return { month: input.month, records, batches: rows.batches.map((batch) => ({ id: String(batch._id), name: batch.name, status: batch.status })), expenses, summary: {
    studentExpectedTk, studentCollectedTk, studentDueTk: studentExpectedTk - studentCollectedTk,
    teacherPayrollTk, teacherPaidTk, teacherDueTk: teacherPayrollTk - teacherPaidTk,
    operatingExpenseTk, operatingPaidTk, operatingDueTk: operatingExpenseTk - operatingPaidTk,
    netCashTk: studentCollectedTk - teacherPaidTk - operatingPaidTk,
    studentClearCount: students.filter((row) => row.payment.status === "clear").length, studentDueCount: students.filter((row) => row.payment.status === "due").length,
    teacherClearCount: teachers.filter((row) => row.payment.status === "clear").length, teacherDueCount: teachers.filter((row) => row.payment.status === "due").length,
  } };
}

export async function mutateFinance(context: RequestContext, input: FinanceMutationInput) {
  assertAdmin(context.actor);
  return runIdempotentMutation(context, { workflow: `finance.${input.action}`, targetId: "userId" in input ? input.userId : `${input.month}:${input.category}`, payload: input }, async () => {
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
