import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type {
  CoachAvailableMinutes,
  CoachEnergy,
  CoachIntent,
} from "@/lib/coach/rules";

export interface IStudentCoachCheckIn extends Document {
  student: Types.ObjectId;
  dateKey: string;
  availableMinutes: CoachAvailableMinutes;
  energy: CoachEnergy;
  intent: CoachIntent;
  recommendation: {
    key: string;
    title: string;
    reason: string;
    href: string;
    estimatedMinutes: number;
    category: string;
    accent: string;
  };
  launchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentCoachCheckInSchema = new Schema<IStudentCoachCheckIn>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateKey: { type: String, required: true, trim: true },
    availableMinutes: {
      type: Number,
      enum: [5, 15, 30, 45],
      required: true,
    },
    energy: {
      type: String,
      enum: ["low", "steady", "high"],
      required: true,
    },
    intent: {
      type: String,
      enum: ["auto", "revise", "practice", "focus", "explore"],
      required: true,
    },
    recommendation: {
      key: { type: String, required: true, trim: true },
      title: { type: String, required: true, trim: true },
      reason: { type: String, required: true, trim: true },
      href: { type: String, required: true, trim: true },
      estimatedMinutes: { type: Number, required: true, min: 1 },
      category: { type: String, required: true, trim: true },
      accent: { type: String, required: true, trim: true },
    },
    launchedAt: { type: Date },
  },
  { timestamps: true },
);

StudentCoachCheckInSchema.index(
  { student: 1, dateKey: 1 },
  { unique: true },
);
StudentCoachCheckInSchema.index({ student: 1, createdAt: -1 });

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.StudentCoachCheckIn
) {
  mongoose.deleteModel("StudentCoachCheckIn");
}

export const StudentCoachCheckIn: Model<IStudentCoachCheckIn> =
  mongoose.models.StudentCoachCheckIn ||
  mongoose.model<IStudentCoachCheckIn>(
    "StudentCoachCheckIn",
    StudentCoachCheckInSchema,
  );
