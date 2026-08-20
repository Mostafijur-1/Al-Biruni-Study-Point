import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { AttendanceRecordStatus } from "../../attendance-rules.ts";

export interface IAttendanceRecord extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  sheetId: Types.ObjectId;
  classSessionId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  studentNameSnapshot: string;
  studentClassSnapshot?: string;
  status: AttendanceRecordStatus;
  minutesLate?: number;
  privateNote?: string;
  markedBy?: Types.ObjectId;
  markedAt?: Date;
  workflowVersion: number;
  correctionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    sheetId: { type: Schema.Types.ObjectId, ref: "AttendanceSheet", required: true },
    classSessionId: { type: Schema.Types.ObjectId, ref: "ClassSession", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "BatchEnrollment", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentNameSnapshot: { type: String, required: true, trim: true, maxlength: 160 },
    studentClassSnapshot: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      enum: ["unmarked", "present", "absent", "late", "excused"],
      default: "unmarked",
    },
    minutesLate: { type: Number, min: 1, max: 720 },
    privateNote: { type: String, trim: true, maxlength: 500 },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
    markedAt: { type: Date },
    workflowVersion: { type: Number, required: true, default: 1, min: 1 },
    correctionVersion: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

AttendanceRecordSchema.index({ sheetId: 1, enrollmentId: 1 }, { unique: true });
AttendanceRecordSchema.index({ sheetId: 1, studentId: 1 }, { unique: true });
AttendanceRecordSchema.index({ studentId: 1, createdAt: -1 });
AttendanceRecordSchema.index({ branchId: 1, classSessionId: 1, status: 1 });

export const AttendanceRecord: Model<IAttendanceRecord> =
  (mongoose.models.AttendanceRecord as Model<IAttendanceRecord> | undefined) ||
  mongoose.model<IAttendanceRecord>("AttendanceRecord", AttendanceRecordSchema);
