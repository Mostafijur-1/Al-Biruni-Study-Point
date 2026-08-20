import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { MonthlyPayment } from "@/lib/db/models/MonthlyPayment";
import { MonthlyExpense, type ExpenseCategory } from "@/lib/db/models/MonthlyExpense";
import { PaymentProfile } from "@/lib/db/models/PaymentProfile";
import { User } from "@/lib/db/models/User";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-membership"),
    userId: objectId,
    included: z.boolean(),
  }),
  z.object({
    action: z.literal("set-profile"),
    userId: objectId,
    defaultAmountTk: z.coerce.number().int().min(0).max(10_000_000),
    subjects: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  }),
  z.object({
    action: z.literal("set-month"),
    userId: objectId,
    month: z.string().regex(monthPattern),
    amountTk: z.coerce.number().int().min(0).max(10_000_000),
    status: z.enum(["due", "clear"]),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("set-expense"),
    month: z.string().regex(monthPattern),
    category: z.enum(["room-rent", "electricity"]),
    amountTk: z.coerce.number().int().min(0).max(10_000_000),
    status: z.enum(["due", "clear"]),
    note: z.string().trim().max(300).optional(),
  }),
]);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultProfile(role: "student" | "teacher") {
  return role === "student"
    ? { subjects: [], defaultAmountTk: 0 }
    : { subjects: [], defaultAmountTk: 0 };
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    const month = request.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const roleParam = request.nextUrl.searchParams.get("role") || "all";
    const q = request.nextUrl.searchParams.get("q")?.trim() || "";
    const mode = request.nextUrl.searchParams.get("mode");
    if (!monthPattern.test(month)) return fail("Invalid month.", 400);
    if (!['all', 'student', 'teacher'].includes(roleParam)) return fail("Invalid role.", 400);
    const requestedRole = roleParam === "student" || roleParam === "teacher" ? roleParam : undefined;
    const search = q ? new RegExp(escapeRegex(q), "i") : undefined;
    if (mode === "candidates") {
      if (!requestedRole || q.length < 1) return success({ users: [] });
      const candidates = await User.find({
        role: requestedRole,
        isAbspMember: { $ne: true },
        approvalStatus: "approved",
        $or: [{ name: search }, { reference: search }],
      }).select("name reference phone studentClass role").sort({ name: 1 }).limit(20).lean();
      return success({ users: candidates.map((user) => ({ id: String(user._id), name: user.name, reference: user.reference, phone: user.phone, studentClass: user.studentClass, role: user.role })) });
    }
    const users = await User.find({
      role: requestedRole ?? { $in: ["student", "teacher"] },
      isAbspMember: true,
      approvalStatus: "approved",
      ...(search ? { $or: [{ name: search }, { reference: search }, { phone: search }] } : {}),
    }).select("name reference phone email role studentClass isActive").sort({ role: 1, name: 1 }).limit(500).lean();
    const userIds = users.map((item) => item._id);
    const [profiles, payments, savedExpenses] = await Promise.all([
      PaymentProfile.find({ userId: { $in: userIds } }).lean(),
      MonthlyPayment.find({ userId: { $in: userIds }, month }).lean(),
      MonthlyExpense.find({ month }).lean(),
    ]);
    const profileMap = new Map(profiles.map((item) => [String(item.userId), item]));
    const paymentMap = new Map(payments.map((item) => [String(item.userId), item]));
    const records = users.map((user) => {
      const role = user.role as "student" | "teacher";
      const fallback = defaultProfile(role);
      const profile = profileMap.get(String(user._id));
      const payment = paymentMap.get(String(user._id));
      return {
        user: { id: String(user._id), name: user.name, reference: user.reference, phone: user.phone, email: user.email, role, studentClass: user.studentClass, isActive: user.isActive },
        profile: { subjects: profile?.subjects ?? fallback.subjects, defaultAmountTk: profile?.defaultAmountTk ?? fallback.defaultAmountTk, configured: Boolean(profile) },
        payment: { amountTk: payment?.amountTk ?? profile?.defaultAmountTk ?? fallback.defaultAmountTk, status: payment?.status ?? "due", clearedAt: payment?.clearedAt?.toISOString(), note: payment?.note, saved: Boolean(payment) },
      };
    });
    const students = records.filter((item) => item.user.role === "student");
    const teachers = records.filter((item) => item.user.role === "teacher");
    const studentExpectedTk = students.reduce((sum, item) => sum + item.payment.amountTk, 0);
    const studentCollectedTk = students.filter((item) => item.payment.status === "clear").reduce((sum, item) => sum + item.payment.amountTk, 0);
    const teacherPayrollTk = teachers.reduce((sum, item) => sum + item.payment.amountTk, 0);
    const teacherPaidTk = teachers.filter((item) => item.payment.status === "clear").reduce((sum, item) => sum + item.payment.amountTk, 0);
    const expenseMap = new Map(savedExpenses.map((item) => [item.category, item]));
    const expenses = (["room-rent", "electricity"] as ExpenseCategory[]).map((category) => {
      const expense = expenseMap.get(category);
      return { category, amountTk: expense?.amountTk ?? 0, status: expense?.status ?? "due", clearedAt: expense?.clearedAt?.toISOString(), note: expense?.note, saved: Boolean(expense) };
    });
    const operatingExpenseTk = expenses.reduce((sum, item) => sum + item.amountTk, 0);
    const operatingPaidTk = expenses.filter((item) => item.status === "clear").reduce((sum, item) => sum + item.amountTk, 0);
    return success({ month, records, expenses, summary: {
      studentExpectedTk, studentCollectedTk, studentDueTk: studentExpectedTk - studentCollectedTk,
      teacherPayrollTk, teacherPaidTk, teacherDueTk: teacherPayrollTk - teacherPaidTk,
      operatingExpenseTk, operatingPaidTk, operatingDueTk: operatingExpenseTk - operatingPaidTk,
      netCashTk: studentCollectedTk - teacherPaidTk - operatingPaidTk,
      studentClearCount: students.filter((item) => item.payment.status === "clear").length,
      studentDueCount: students.filter((item) => item.payment.status === "due").length,
      teacherClearCount: teachers.filter((item) => item.payment.status === "clear").length,
      teacherDueCount: teachers.filter((item) => item.payment.status === "due").length,
    }});
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const input = mutationSchema.parse(await request.json());
    if (input.action === "set-expense") {
      const expense = await MonthlyExpense.findOneAndUpdate(
        { month: input.month, category: input.category },
        { $set: { amountTk: input.amountTk, status: input.status, clearedAt: input.status === "clear" ? new Date() : undefined, note: input.note || undefined, updatedBy: actor.id } },
        { upsert: true, new: true, runValidators: true },
      );
      return success({ expense: { month: expense.month, category: expense.category, amountTk: expense.amountTk, status: expense.status, clearedAt: expense.clearedAt?.toISOString() } });
    }
    const user = await User.findOne({ _id: input.userId, role: { $in: ["student", "teacher"] } }).select("role").lean();
    if (!user) return fail("Student or teacher not found.", 404);
    const role = user.role as "student" | "teacher";
    if (input.action === "set-membership") {
      await User.updateOne({ _id: input.userId }, { $set: { isAbspMember: input.included } });
      await PaymentProfile.updateOne({ userId: input.userId }, { $set: { isActive: input.included } });
      return success({ membership: { userId: input.userId, included: input.included } });
    }
    const member = await User.exists({ _id: input.userId, isAbspMember: true });
    if (!member) return fail("This user is not included as an ABSP member.", 403);
    if (input.action === "set-profile") {
      if (role === "student") {
        return fail("শিক্ষার্থীর coaching subjects ও fee Enrollment ব্যবস্থাপনা থেকে পরিবর্তন করুন।", 409);
      }
      const profile = await PaymentProfile.findOneAndUpdate(
        { userId: input.userId },
        { $set: { role, subjects: [], defaultAmountTk: input.defaultAmountTk, isActive: true, updatedBy: actor.id } },
        { upsert: true, new: true, runValidators: true },
      );
      return success({ profile: { userId: String(profile.userId), subjects: profile.subjects, defaultAmountTk: profile.defaultAmountTk } });
    }
    const payment = await MonthlyPayment.findOneAndUpdate(
      { userId: input.userId, month: input.month, kind: role === "student" ? "student-fee" : "teacher-payroll" },
      { $set: { role, amountTk: input.amountTk, status: input.status, clearedAt: input.status === "clear" ? new Date() : undefined, note: input.note || undefined, updatedBy: actor.id } },
      { upsert: true, new: true, runValidators: true },
    );
    return success({ payment: { userId: String(payment.userId), month: payment.month, amountTk: payment.amountTk, status: payment.status, clearedAt: payment.clearedAt?.toISOString() } });
  } catch (error) { return handleApiError(error); }
}
