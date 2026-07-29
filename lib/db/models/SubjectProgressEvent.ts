import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISubjectProgressEvent extends Document {
  student: Types.ObjectId;
  subject: string;
  sourceAttempt: Types.ObjectId;
  xp: number;
  percentage: number;
  previousBest: number;
  personalBest: boolean;
  improvement: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectProgressEventSchema = new Schema<ISubjectProgressEvent>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true },
    sourceAttempt: {
      type: Schema.Types.ObjectId,
      ref: "PracticeAttempt",
      required: true,
      unique: true,
    },
    xp: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    previousBest: { type: Number, required: true, min: 0, max: 100 },
    personalBest: { type: Boolean, required: true },
    improvement: { type: Number, required: true },
  },
  { timestamps: true },
);

SubjectProgressEventSchema.index({ student: 1, createdAt: -1 });

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.SubjectProgressEvent
) {
  mongoose.deleteModel("SubjectProgressEvent");
}

export const SubjectProgressEvent: Model<ISubjectProgressEvent> =
  mongoose.models.SubjectProgressEvent ||
  mongoose.model<ISubjectProgressEvent>(
    "SubjectProgressEvent",
    SubjectProgressEventSchema,
  );
