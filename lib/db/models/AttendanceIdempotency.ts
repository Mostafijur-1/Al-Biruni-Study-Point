import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAttendanceIdempotency extends Document {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  workflow: string;
  targetId: string;
  key: string;
  payloadHash: string;
  status: "started" | "completed";
  resultResourceId?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceIdempotencySchema = new Schema<IAttendanceIdempotency>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workflow: { type: String, required: true, trim: true },
    targetId: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, maxlength: 200 },
    payloadHash: { type: String, required: true, trim: true },
    status: { type: String, enum: ["started", "completed"], default: "started" },
    resultResourceId: { type: String, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AttendanceIdempotencySchema.index(
  { organizationId: 1, actorId: 1, workflow: 1, key: 1 },
  { unique: true },
);
AttendanceIdempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AttendanceIdempotency: Model<IAttendanceIdempotency> =
  (mongoose.models.AttendanceIdempotency as Model<IAttendanceIdempotency> | undefined) ||
  mongoose.model<IAttendanceIdempotency>("AttendanceIdempotency", AttendanceIdempotencySchema);
