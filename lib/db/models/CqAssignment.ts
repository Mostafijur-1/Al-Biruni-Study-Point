import mongoose, { Document, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "@/lib/db/ensure-schema-path";
import { requireCanonicalPathsWhenEnabled } from "@/lib/db/canonical-scope-guard";
import type { StudentClass } from "@/types";

export interface ICqAssignment extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  chapterId?: Types.ObjectId;
  title: string;
  description?: string;
  subject?: string;
  targetClasses: StudentClass[];
  teacher: Types.ObjectId;
  totalMarks: number;
  dueDate?: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CqAssignmentSchema = new Schema<ICqAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject" },
    chapterId: { type: Schema.Types.ObjectId, ref: "AcademicChapter" },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    subject: { type: String, trim: true },
    targetClasses: {
      type: [String],
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
      validate: {
        validator: (value: string[]) => value.length > 0,
        message: "At least one target class is required.",
      },
    },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalMarks: { type: Number, required: true, min: 1 },
    dueDate: { type: Date },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CqAssignmentSchema.index({ teacher: 1, createdAt: -1 });
CqAssignmentSchema.index({ subject: 1, targetClasses: 1, isPublished: 1 });
CqAssignmentSchema.index({ targetClasses: 1, isPublished: 1 });
CqAssignmentSchema.index({ organizationId: 1, subjectId: 1, isPublished: 1 });
requireCanonicalPathsWhenEnabled(CqAssignmentSchema, ["organizationId", "subjectId"]);

const CqAssignmentModel =
  mongoose.models.CqAssignment ||
  mongoose.model<ICqAssignment>("CqAssignment", CqAssignmentSchema);

ensureSchemaPaths(CqAssignmentModel, CqAssignmentSchema);

export const CqAssignment = CqAssignmentModel;
