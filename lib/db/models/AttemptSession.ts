import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AttemptKind = "practice" | "exam";
export type AttemptSessionStatus = "ready" | "started" | "submitted" | "expired";

export interface IAttemptSession extends Document {
  student: Types.ObjectId;
  kind: AttemptKind;
  exam?: Types.ObjectId;
  subject?: string;
  questionIds: Types.ObjectId[];
  durationSeconds: number;
  status: AttemptSessionStatus;
  startedAt?: Date;
  expiresAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttemptSessionSchema = new Schema<IAttemptSession>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["practice", "exam"], required: true },
    exam: { type: Schema.Types.ObjectId, ref: "McqExam" },
    subject: { type: String, trim: true },
    questionIds: [{ type: Schema.Types.ObjectId, required: true }],
    durationSeconds: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["ready", "started", "submitted", "expired"],
      default: "ready",
    },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

AttemptSessionSchema.index({ student: 1, kind: 1, status: 1, createdAt: -1 });
AttemptSessionSchema.index({ student: 1, exam: 1, status: 1 });
AttemptSessionSchema.index({ expiresAt: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.AttemptSession) {
  mongoose.deleteModel("AttemptSession");
}

export const AttemptSession: Model<IAttemptSession> =
  mongoose.models.AttemptSession ||
  mongoose.model<IAttemptSession>("AttemptSession", AttemptSessionSchema);
