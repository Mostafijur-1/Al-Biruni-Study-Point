import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type {
  FocusIntention,
  FocusReflection,
} from "@/lib/focus/rules";
import type { StudentClass } from "@/types";

export type FocusSessionStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "expired";

export interface IFocusSession extends Document {
  student: Types.ObjectId;
  studentClass: StudentClass;
  subject: string;
  intention: FocusIntention;
  durationMinutes: number;
  status: FocusSessionStatus;
  dateKey: string;
  startedAt: Date;
  endsAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  reflection?: FocusReflection;
  xpEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

const FocusSessionSchema = new Schema<IFocusSession>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 80 },
    intention: {
      type: String,
      enum: ["practice", "review", "lesson", "assignment"],
      required: true,
    },
    durationMinutes: {
      type: Number,
      enum: [15, 25, 45],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled", "expired"],
      default: "active",
    },
    dateKey: { type: String, required: true, trim: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    reflection: {
      type: String,
      enum: ["energized", "steady", "challenging"],
    },
    xpEarned: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

FocusSessionSchema.index({ student: 1, status: 1, startedAt: -1 });
FocusSessionSchema.index({
  studentClass: 1,
  status: 1,
  endsAt: 1,
});
FocusSessionSchema.index({ student: 1, dateKey: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.FocusSession) {
  mongoose.deleteModel("FocusSession");
}

export const FocusSession: Model<IFocusSession> =
  mongoose.models.FocusSession ||
  mongoose.model<IFocusSession>("FocusSession", FocusSessionSchema);
