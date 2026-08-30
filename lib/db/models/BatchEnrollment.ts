import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { EnrollmentStatus } from "@/lib/academic-rules";

export interface IBatchEnrollment extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  batchId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: EnrollmentStatus;
  effectiveFrom: Date;
  effectiveTo?: Date;
  endReason?: string;
  guardianPhone?: string;
  guardianRelation?: "father" | "mother" | "brother" | "sister" | "uncle" | "aunt" | "other";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BatchEnrollmentSchema = new Schema<IBatchEnrollment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["active", "completed", "withdrawn", "transferred"],
      default: "active",
    },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date },
    endReason: { type: String, trim: true },
    guardianPhone: { type: String, trim: true, maxlength: 20 },
    guardianRelation: {
      type: String,
      enum: ["father", "mother", "brother", "sister", "uncle", "aunt", "other"],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

BatchEnrollmentSchema.index(
  { organizationId: 1, academicSessionId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
BatchEnrollmentSchema.index({ branchId: 1, batchId: 1, status: 1, studentId: 1 });
BatchEnrollmentSchema.index({ studentId: 1, status: 1, effectiveFrom: -1 });

export const BatchEnrollment: Model<IBatchEnrollment> =
  (mongoose.models.BatchEnrollment as Model<IBatchEnrollment> | undefined) ||
  mongoose.model<IBatchEnrollment>("BatchEnrollment", BatchEnrollmentSchema);
