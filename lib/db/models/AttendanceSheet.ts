import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { AttendancePolicySnapshot } from "../../attendance-rules.ts";

export interface IAttendanceSheet extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  batchId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  teacherAssignmentId: Types.ObjectId;
  classSessionId: Types.ObjectId;
  routineSlotId?: Types.ObjectId;
  rosterVersion: number;
  rosterHash: string;
  rosterSnapshotAt: Date;
  policySnapshot: AttendancePolicySnapshot;
  status: "draft" | "submitted";
  workflowVersion: number;
  openedBy: Types.ObjectId;
  openedAt: Date;
  submittedBy?: Types.ObjectId;
  submittedAt?: Date;
  summary?: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    attended: number;
    denominator: number;
    percentage?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSheetSchema = new Schema<IAttendanceSheet>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacherAssignmentId: { type: Schema.Types.ObjectId, ref: "TeacherAssignment", required: true },
    classSessionId: { type: Schema.Types.ObjectId, ref: "ClassSession", required: true },
    routineSlotId: { type: Schema.Types.ObjectId, ref: "RoutineSlot" },
    rosterVersion: { type: Number, required: true, default: 1, min: 1 },
    rosterHash: { type: String, required: true, trim: true },
    rosterSnapshotAt: { type: Date, required: true },
    policySnapshot: {
      presentCountsAsAttended: { type: Boolean, required: true },
      lateCountsAsAttended: { type: Boolean, required: true },
      absentCountsInDenominator: { type: Boolean, required: true },
      excusedExcluded: { type: Boolean, required: true },
      lowAttendanceThresholdPercent: { type: Number, required: true, min: 0, max: 100 },
    },
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    workflowVersion: { type: Number, required: true, default: 1, min: 1 },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, required: true, default: Date.now },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date },
    summary: {
      present: { type: Number, min: 0 },
      absent: { type: Number, min: 0 },
      late: { type: Number, min: 0 },
      excused: { type: Number, min: 0 },
      attended: { type: Number, min: 0 },
      denominator: { type: Number, min: 0 },
      percentage: { type: Number, min: 0, max: 100 },
    },
  },
  { timestamps: true },
);

AttendanceSheetSchema.index({ classSessionId: 1 }, { unique: true });
AttendanceSheetSchema.index({ branchId: 1, batchId: 1, status: 1, rosterSnapshotAt: -1 });
AttendanceSheetSchema.index({ teacherId: 1, status: 1, rosterSnapshotAt: -1 });
AttendanceSheetSchema.index({ organizationId: 1, submittedAt: -1 });

export const AttendanceSheet: Model<IAttendanceSheet> =
  (mongoose.models.AttendanceSheet as Model<IAttendanceSheet> | undefined) ||
  mongoose.model<IAttendanceSheet>("AttendanceSheet", AttendanceSheetSchema);
