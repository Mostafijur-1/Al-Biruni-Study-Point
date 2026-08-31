import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ExpenseCategory = "room-rent" | "electricity";

export interface IMonthlyExpense extends Document {
  organizationId?: Types.ObjectId;
  month: string;
  category: ExpenseCategory;
  amountTk: number;
  status: "due" | "clear";
  clearedAt?: Date;
  note?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyExpenseSchema = new Schema<IMonthlyExpense>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    category: { type: String, enum: ["room-rent", "electricity"], required: true },
    amountTk: { type: Number, required: true, min: 0, max: 10_000_000 },
    status: { type: String, enum: ["due", "clear"], default: "due" },
    clearedAt: Date,
    note: { type: String, trim: true, maxlength: 300 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

MonthlyExpenseSchema.index({ month: 1, category: 1 }, { unique: true });
MonthlyExpenseSchema.index({ month: 1, status: 1 });
MonthlyExpenseSchema.index({ organizationId: 1, month: 1, status: 1 });

export const MonthlyExpense: Model<IMonthlyExpense> =
  (mongoose.models.MonthlyExpense as Model<IMonthlyExpense> | undefined) ||
  mongoose.model<IMonthlyExpense>("MonthlyExpense", MonthlyExpenseSchema);
