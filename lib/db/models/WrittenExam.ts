import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { requireCanonicalPathsWhenEnabled } from "../canonical-scope-guard.ts";

export interface IWrittenExam extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  batchId: Types.ObjectId;
  subjectId: Types.ObjectId;
  assessmentId?: Types.ObjectId;
  assessmentVersionId?: Types.ObjectId;
  title: string;
  examDate: Date;
  totalMarks: number;
  questionFile?: { data: Buffer; contentType: string; fileName: string };
  questionLink?: { provider: "google-drive"; url: string; setBy: Types.ObjectId; setAt: Date };
  instructions?: string;
  createdBy: Types.ObjectId;
  creatorRole: "admin" | "teacher";
  isPublished: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WrittenExamSchema = new Schema<IWrittenExam>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: "Assessment" }, assessmentVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentVersion" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    examDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, min: 1, max: 10_000 },
    questionFile: {
      data: { type: Buffer, select: false },
      contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
      fileName: { type: String, trim: true, maxlength: 180 },
    },
    questionLink: {
      provider: { type: String, enum: ["google-drive"] },
      url: { type: String, trim: true, maxlength: 2_000 },
      setBy: { type: Schema.Types.ObjectId, ref: "User" }, setAt: Date,
    },
    instructions: { type: String, trim: true, maxlength: 1_000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    creatorRole: { type: String, enum: ["admin", "teacher"], required: true },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

WrittenExamSchema.index({ batchId: 1, examDate: -1 });
WrittenExamSchema.index({ createdBy: 1, examDate: -1 });
WrittenExamSchema.index({ isPublished: 1, examDate: -1 });
WrittenExamSchema.index({ organizationId: 1, branchId: 1, academicSessionId: 1, examDate: -1 });
WrittenExamSchema.pre("validate", function () {
  if (!this.questionLink) return;
  try {
    const host = new URL(this.questionLink.url).hostname.toLowerCase();
    if ((host !== "drive.google.com" && host !== "docs.google.com") || this.questionLink.provider !== "google-drive" || !this.questionLink.setBy || !this.questionLink.setAt) this.invalidate("questionLink", "Question reference must be a complete Google Drive link.");
  } catch {
    this.invalidate("questionLink.url", "Question reference must be a valid Google Drive URL.");
  }
});
requireCanonicalPathsWhenEnabled(WrittenExamSchema, ["organizationId", "branchId", "academicSessionId", "batchId", "subjectId"]);

export const WrittenExam: Model<IWrittenExam> =
  (mongoose.models.WrittenExam as Model<IWrittenExam> | undefined) ||
  mongoose.model<IWrittenExam>("WrittenExam", WrittenExamSchema);
