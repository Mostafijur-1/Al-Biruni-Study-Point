import mongoose, { Document, Model, Schema, Types } from "mongoose";
import type { StudentClass } from "@/types";
import { requireCanonicalPathsWhenEnabled } from "../canonical-scope-guard.ts";

export interface IMcqExam extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  batchIds?: Types.ObjectId[];
  subjectId?: Types.ObjectId;
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
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    batchIds: [{ type: Schema.Types.ObjectId, ref: "Batch" }],
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject" },
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
McqExamSchema.index({ organizationId: 1, subjectId: 1, isPublished: 1, createdAt: -1 });
requireCanonicalPathsWhenEnabled(McqExamSchema, ["organizationId", "subjectId"]);

// Prevent Next.js hot-reloading model duplication error
if (process.env.NODE_ENV !== "production" && mongoose.models.McqExam) {
  mongoose.deleteModel("McqExam");
}

export const McqExam: Model<IMcqExam> =
  mongoose.models.McqExam ||
  mongoose.model<IMcqExam>("McqExam", McqExamSchema);
