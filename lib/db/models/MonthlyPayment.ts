import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IMonthlyPayment extends Document {
  userId: Types.ObjectId;
  role: "student" | "teacher";
  month: string;
  kind: "student-fee" | "teacher-payroll";
  amountTk: number;
  status: "due" | "clear";
  clearedAt?: Date;
  note?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyPaymentSchema = new Schema<IMonthlyPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["student", "teacher"], required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    kind: { type: String, enum: ["student-fee", "teacher-payroll"], required: true },
    amountTk: { type: Number, required: true, min: 0, max: 10_000_000 },
    status: { type: String, enum: ["due", "clear"], default: "due" },
    clearedAt: Date,
    note: { type: String, trim: true, maxlength: 300 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

MonthlyPaymentSchema.index({ userId: 1, month: 1, kind: 1 }, { unique: true });
MonthlyPaymentSchema.index({ month: 1, role: 1, status: 1 });

export const MonthlyPayment: Model<IMonthlyPayment> =
  (mongoose.models.MonthlyPayment as Model<IMonthlyPayment> | undefined) ||
  mongoose.model<IMonthlyPayment>("MonthlyPayment", MonthlyPaymentSchema);
