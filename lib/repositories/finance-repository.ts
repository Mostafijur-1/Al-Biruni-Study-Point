import type { QueryFilter } from "mongoose";

import { canonicalScopeFilter } from "@/lib/application/scope-policy";
import type { RequestContext } from "@/lib/application/request-context";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { Organization } from "@/lib/db/models/Organization";
import { MonthlyExpense } from "@/lib/db/models/MonthlyExpense";
import { MonthlyPayment } from "@/lib/db/models/MonthlyPayment";
import { PaymentProfile } from "@/lib/db/models/PaymentProfile";
import { User, type IUser } from "@/lib/db/models/User";
import type { FinanceListInput } from "@/lib/validations/finance.schema";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function loadFinanceLedger(context: RequestContext, input: FinanceListInput) {
  const scope = canonicalScopeFilter(context.scope);
  const allActiveEnrollments = await BatchEnrollment.find({ ...scope, status: "active" }).select("studentId batchId").limit(5_000).lean();
  const activeEnrollments = input.batchId ? allActiveEnrollments.filter((row) => String(row.batchId) === input.batchId) : allActiveEnrollments;
  const studentIds = activeEnrollments.map((row) => row.studentId);
  const accessFilters: QueryFilter<IUser>[] = input.role === "student" ? [{ role: "student", _id: { $in: studentIds } }]
    : input.role === "teacher" ? [{ role: "teacher", isAbspMember: true }]
    : [{ role: "student", _id: { $in: studentIds } }, { role: "teacher", isAbspMember: true }];
  const financeFilters: QueryFilter<IUser>[] = [
    { role: "student", _id: { $in: allActiveEnrollments.map((row) => row.studentId) } },
    { role: "teacher", isAbspMember: true },
  ];
  const search = input.q ? new RegExp(escapeRegex(input.q), "i") : undefined;
  const projection = "name studentCode reference phone email role studentClass isActive";
  const [users, financeUsers] = await Promise.all([
    User.find({ approvalStatus: "approved", $and: [{ $or: accessFilters }, ...(search ? [{ $or: [{ name: search }, { studentCode: search }, { reference: search }, { phone: search }] }] : [])] }).select(projection).sort({ role: 1, name: 1 }).limit(500).lean(),
    User.find({ approvalStatus: "approved", $or: financeFilters }).select(projection).sort({ role: 1, name: 1 }).limit(5_000).lean(),
  ]);
  const financeUserIds = financeUsers.map((row) => row._id);
  const batchIds = [...new Set(allActiveEnrollments.map((row) => String(row.batchId)))];
  const [profiles, payments, expenses, batches] = await Promise.all([
    PaymentProfile.find({ ...scope, userId: { $in: financeUserIds } }).limit(5_000).lean(),
    MonthlyPayment.find({ ...scope, userId: { $in: financeUserIds }, month: input.month }).limit(5_000).lean(),
    MonthlyExpense.find({ ...scope, month: input.month }).limit(100).lean(),
    Batch.find({ ...scope, _id: { $in: batchIds } }).select("name status").sort({ name: 1 }).limit(5_000).lean(),
  ]);
  return { users, financeUsers, allActiveEnrollments, profiles, payments, expenses, batches };
}

export async function findFinanceUser(context: RequestContext, userId: string) {
  return User.findOne({ _id: userId, role: { $in: ["student", "teacher"] } }).select("role").lean();
}

export async function isFinanceUserEligible(context: RequestContext, userId: string, role: "student" | "teacher") {
  const scope = canonicalScopeFilter(context.scope);
  return role === "student"
    ? Boolean(await BatchEnrollment.exists({ ...scope, studentId: userId, status: "active" }))
    : Boolean(await User.exists({ _id: userId, isAbspMember: true }));
}

export async function resolveFinanceLedgerScope(context: RequestContext, input: { organizationId?: string }) {
  const organizations = await Organization.find({ status: "active", ...(input.organizationId ? { _id: input.organizationId } : {}) }).select("_id").limit(2).lean();
  return organizations.length === 1 ? { organizationId: String(organizations[0]._id) } : null;
}

export async function upsertFinanceExpense(context: RequestContext, input: { month: string; category: "room-rent" | "electricity"; amountTk: number; status: "due" | "clear"; note?: string }) {
  const scope = canonicalScopeFilter(context.scope);
  return MonthlyExpense.findOneAndUpdate(
    { ...scope, month: input.month, category: input.category },
    { $set: { ...scope, amountTk: input.amountTk, status: input.status, clearedAt: input.status === "clear" ? new Date() : undefined, note: input.note || undefined, updatedBy: context.actor.id } },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function upsertPaymentProfile(context: RequestContext, input: { userId: string; role: "student" | "teacher"; defaultAmountTk: number }) {
  const scope = canonicalScopeFilter(context.scope);
  return PaymentProfile.findOneAndUpdate(
    { ...scope, userId: input.userId },
    { $set: { ...scope, role: input.role, defaultAmountTk: input.defaultAmountTk, isActive: true, updatedBy: context.actor.id }, $setOnInsert: { subjects: [] } },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function upsertMonthlyPayment(context: RequestContext, input: { userId: string; role: "student" | "teacher"; month: string; amountTk: number; status: "due" | "clear"; note?: string }) {
  const scope = canonicalScopeFilter(context.scope);
  const kind = input.role === "student" ? "student-fee" : "teacher-payroll";
  return MonthlyPayment.findOneAndUpdate(
    { ...scope, userId: input.userId, month: input.month, kind },
    { $set: { ...scope, role: input.role, amountTk: input.amountTk, status: input.status, clearedAt: input.status === "clear" ? new Date() : undefined, note: input.note || undefined, updatedBy: context.actor.id } },
    { upsert: true, new: true, runValidators: true },
  );
}
