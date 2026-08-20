import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAttendanceOutbox extends Document {
  eventId: string;
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  eventType: "attendance.sheet.submitted" | "attendance.correction.approved";
  aggregateId: string;
  payload: Record<string, unknown>;
  status: "pending" | "processed" | "failed";
  attempts: number;
  occurredAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceOutboxSchema = new Schema<IAttendanceOutbox>(
  {
    eventId: { type: String, required: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    eventType: {
      type: String,
      enum: ["attendance.sheet.submitted", "attendance.correction.approved"],
      required: true,
    },
    aggregateId: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "processed", "failed"], default: "pending" },
    attempts: { type: Number, default: 0, min: 0 },
    occurredAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

AttendanceOutboxSchema.index({ eventId: 1 }, { unique: true });
AttendanceOutboxSchema.index({ status: 1, occurredAt: 1 });
AttendanceOutboxSchema.index({ organizationId: 1, eventType: 1, occurredAt: -1 });

export const AttendanceOutbox: Model<IAttendanceOutbox> =
  (mongoose.models.AttendanceOutbox as Model<IAttendanceOutbox> | undefined) ||
  mongoose.model<IAttendanceOutbox>("AttendanceOutbox", AttendanceOutboxSchema);
