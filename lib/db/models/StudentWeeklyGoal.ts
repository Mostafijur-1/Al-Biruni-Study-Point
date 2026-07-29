import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { WeeklyGoalMetric } from "@/lib/goals/rules";

export type StudentWeeklyGoalStatus = "active" | "claimed";

export interface IStudentWeeklyGoal extends Document {
  student: Types.ObjectId;
  periodKey: string;
  metric: WeeklyGoalMetric;
  subject?: string;
  target: number;
  rewardXp: number;
  status: StudentWeeklyGoalStatus;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentWeeklyGoalSchema = new Schema<IStudentWeeklyGoal>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    periodKey: { type: String, required: true, trim: true },
    metric: {
      type: String,
      enum: ["practice_questions", "focus_minutes", "challenge_days"],
      required: true,
    },
    subject: { type: String, trim: true, maxlength: 80 },
    target: { type: Number, required: true, min: 1 },
    rewardXp: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["active", "claimed"],
      default: "active",
    },
    claimedAt: { type: Date },
  },
  { timestamps: true },
);

StudentWeeklyGoalSchema.index(
  { student: 1, periodKey: 1 },
  { unique: true },
);
StudentWeeklyGoalSchema.index({ student: 1, createdAt: -1 });

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.StudentWeeklyGoal
) {
  mongoose.deleteModel("StudentWeeklyGoal");
}

export const StudentWeeklyGoal: Model<IStudentWeeklyGoal> =
  mongoose.models.StudentWeeklyGoal ||
  mongoose.model<IStudentWeeklyGoal>(
    "StudentWeeklyGoal",
    StudentWeeklyGoalSchema,
  );
