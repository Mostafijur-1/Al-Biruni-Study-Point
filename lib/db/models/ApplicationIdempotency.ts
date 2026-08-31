import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IApplicationIdempotency extends Document {
  actorId: Types.ObjectId;
  workflow: string;
  targetId: string;
  key: string;
  payloadHash: string;
  status: "started" | "completed";
  result?: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationIdempotencySchema = new Schema<IApplicationIdempotency>({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  workflow: { type: String, required: true, trim: true, maxlength: 100 },
  targetId: { type: String, required: true, trim: true, maxlength: 200 },
  key: { type: String, required: true, trim: true, maxlength: 200 },
  payloadHash: { type: String, required: true, trim: true },
  status: { type: String, enum: ["started", "completed"], default: "started" },
  result: { type: Schema.Types.Mixed },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

ApplicationIdempotencySchema.index({ actorId: 1, workflow: 1, targetId: 1, key: 1 }, { unique: true });
ApplicationIdempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApplicationIdempotency: Model<IApplicationIdempotency> =
  (mongoose.models.ApplicationIdempotency as Model<IApplicationIdempotency> | undefined) ||
  mongoose.model<IApplicationIdempotency>("ApplicationIdempotency", ApplicationIdempotencySchema);
