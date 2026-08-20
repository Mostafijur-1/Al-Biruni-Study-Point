import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { AttendanceStatus } from "../../attendance-rules.ts";

type CorrectionValue = {
  status: AttendanceStatus;
  minutesLate?: number;
  privateNote?: string;
};

export interface IAttendanceCorrection extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  sheetId: Types.ObjectId;
  recordId: Types.ObjectId;
  sequence: number;
  status: "pending" | "approved" | "rejected";
  before: CorrectionValue;
  after: CorrectionValue;
  reason: string;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewReason?: string;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

const correctionValueSchema = new Schema<CorrectionValue>(
  {
    status: { type: String, enum: ["present", "absent", "late", "excused"], required: true },
    minutesLate: { type: Number, min: 1, max: 720 },
    privateNote: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const AttendanceCorrectionSchema = new Schema<IAttendanceCorrection>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    sheetId: { type: Schema.Types.ObjectId, ref: "AttendanceSheet", required: true },
    recordId: { type: Schema.Types.ObjectId, ref: "AttendanceRecord", required: true },
    sequence: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    before: { type: correctionValueSchema, required: true },
    after: { type: correctionValueSchema, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewReason: { type: String, trim: true, maxlength: 500 },
    requestId: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

AttendanceCorrectionSchema.index({ recordId: 1, sequence: 1 }, { unique: true });
AttendanceCorrectionSchema.index({ sheetId: 1, status: 1, createdAt: -1 });
AttendanceCorrectionSchema.index({ branchId: 1, status: 1, createdAt: -1 });

export const AttendanceCorrection: Model<IAttendanceCorrection> =
  (mongoose.models.AttendanceCorrection as Model<IAttendanceCorrection> | undefined) ||
  mongoose.model<IAttendanceCorrection>("AttendanceCorrection", AttendanceCorrectionSchema);
