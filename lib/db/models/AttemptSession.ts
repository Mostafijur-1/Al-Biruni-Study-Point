import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AttemptKind = "practice" | "exam";
export type AttemptSessionStatus = "ready" | "started" | "submitted" | "expired";

export interface IAttemptSession extends Document {
  organizationId?: Types.ObjectId;
  assessmentId?: Types.ObjectId;
  assessmentVersionId?: Types.ObjectId;
  student: Types.ObjectId;
  kind: AttemptKind;
  exam?: Types.ObjectId;
  subject?: string;
  questionIds: Types.ObjectId[];
  questionVersionIds: Types.ObjectId[];
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
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    assessmentId: { type: Schema.Types.ObjectId, ref: "Assessment" },
    assessmentVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentVersion" },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["practice", "exam"], required: true },
    exam: { type: Schema.Types.ObjectId, ref: "McqExam" },
    subject: { type: String, trim: true },
    questionIds: [{ type: Schema.Types.ObjectId, required: true }],
    questionVersionIds: [{ type: Schema.Types.ObjectId }],
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
