import mongoose, { Document, Model, Schema } from "mongoose";

export interface IMigrationRecord extends Document {
  migrationId: string;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  summary?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const MigrationRecordSchema = new Schema<IMigrationRecord>(
  {
    migrationId: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    error: { type: String },
    summary: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const MigrationRecord: Model<IMigrationRecord> =
  mongoose.models.MigrationRecord ||
  mongoose.model<IMigrationRecord>("MigrationRecord", MigrationRecordSchema);

