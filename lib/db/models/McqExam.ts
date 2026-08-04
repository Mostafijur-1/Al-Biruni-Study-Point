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
  publishedAt?: Date;
  publishedQuestionCount?: number;
  publishedTotalMarks?: number;
  version: number;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  archiveReason?: string;
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
    publishedAt: { type: Date },
    publishedQuestionCount: { type: Number, min: 1 },
    publishedTotalMarks: { type: Number, min: 1 },
    version: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    archiveReason: { type: String, trim: true },
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
