import mongoose, { Document, Model, Schema, Types } from "mongoose";
import type { StudentClass } from "@/types";

export interface IMcqExam extends Document {
  title: string;
  teacher: Types.ObjectId;
  subject: string;
  duration: number; // in minutes
  totalMarks: number;
  passMark: number;
  targetClasses: StudentClass[];
  isPublished: boolean;
  resultsPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const McqExamSchema = new Schema<IMcqExam>(
  {
    title: { type: String, required: true, trim: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    duration: { type: Number, required: true, min: 1 }, // in minutes
    totalMarks: { type: Number, required: true, min: 1 },
    passMark: { type: Number, required: true, min: 1 },
    targetClasses: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    resultsPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent Next.js hot-reloading model duplication error
if (process.env.NODE_ENV !== "production" && mongoose.models.McqExam) {
  mongoose.deleteModel("McqExam");
}

export const McqExam: Model<IMcqExam> =
  mongoose.models.McqExam ||
  mongoose.model<IMcqExam>("McqExam", McqExamSchema);
