import mongoose, { Model, Schema } from "mongoose";

export interface IRateLimitBucket {
  _id: string;
  count: number;
  expiresAt: Date;
}

const RateLimitBucketSchema = new Schema<IRateLimitBucket>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitBucket: Model<IRateLimitBucket> =
  mongoose.models.RateLimitBucket ||
  mongoose.model<IRateLimitBucket>("RateLimitBucket", RateLimitBucketSchema);
