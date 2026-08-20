import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPaymentProfile extends Document {
  userId: Types.ObjectId;
  role: "student" | "teacher";
  subjects: string[];
  defaultAmountTk: number;
  isActive: boolean;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentProfileSchema = new Schema<IPaymentProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    role: { type: String, enum: ["student", "teacher"], required: true },
    subjects: [{ type: String, trim: true }],
    defaultAmountTk: { type: Number, required: true, min: 0, max: 10_000_000 },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

PaymentProfileSchema.index({ role: 1, isActive: 1 });

export const PaymentProfile: Model<IPaymentProfile> =
  (mongoose.models.PaymentProfile as Model<IPaymentProfile> | undefined) ||
  mongoose.model<IPaymentProfile>("PaymentProfile", PaymentProfileSchema);
