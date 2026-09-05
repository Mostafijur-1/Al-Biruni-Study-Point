import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { AssignmentStatus } from "@/lib/academic-rules";

export interface ITeacherAssignment extends Document {
  organizationId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  batchId: Types.ObjectId;
  teacherId: Types.ObjectId;
  subjectId: Types.ObjectId;
  studentIds?: Types.ObjectId[];
  status: AssignmentStatus;
  effectiveFrom: Date;
  effectiveTo?: Date;
  endReason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherAssignmentSchema = new Schema<ITeacherAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    studentIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: undefined },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date },
    endReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

TeacherAssignmentSchema.index(
  { batchId: 1, teacherId: 1, subjectId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
TeacherAssignmentSchema.index({ teacherId: 1, academicSessionId: 1, status: 1 });
TeacherAssignmentSchema.index({ batchId: 1, subjectId: 1, status: 1 });
TeacherAssignmentSchema.index({ teacherId: 1, studentIds: 1, status: 1 });

export const TeacherAssignment: Model<ITeacherAssignment> =
  (mongoose.models.TeacherAssignment as Model<ITeacherAssignment> | undefined) ||
  mongoose.model<ITeacherAssignment>("TeacherAssignment", TeacherAssignmentSchema);
