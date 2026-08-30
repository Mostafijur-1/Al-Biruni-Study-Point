import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { requireCanonicalPathsWhenEnabled } from "../canonical-scope-guard.ts";

export interface IStudentReportComment extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  studentId: Types.ObjectId;
  batchId: Types.ObjectId;
  periodType: "week" | "month";
  periodStart: Date;
  comment: string;
  authorId: Types.ObjectId;
  authorRole: "admin" | "teacher";
  createdAt: Date;
  updatedAt: Date;
}

const StudentReportCommentSchema = new Schema<IStudentReportComment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    periodType: { type: String, enum: ["week", "month"], required: true },
    periodStart: { type: Date, required: true },
    comment: { type: String, required: true, trim: true, maxlength: 1_000 },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorRole: { type: String, enum: ["admin", "teacher"], required: true },
  },
  { timestamps: true },
);

StudentReportCommentSchema.index({ studentId: 1, periodType: 1, periodStart: 1, createdAt: 1 });
StudentReportCommentSchema.index({ authorId: 1, createdAt: -1 });
StudentReportCommentSchema.index({ organizationId: 1, branchId: 1, academicSessionId: 1, periodStart: -1 });
requireCanonicalPathsWhenEnabled(StudentReportCommentSchema, ["organizationId", "branchId", "academicSessionId", "batchId"]);

export const StudentReportComment: Model<IStudentReportComment> =
  (mongoose.models.StudentReportComment as Model<IStudentReportComment> | undefined) ||
  mongoose.model<IStudentReportComment>("StudentReportComment", StudentReportCommentSchema);
