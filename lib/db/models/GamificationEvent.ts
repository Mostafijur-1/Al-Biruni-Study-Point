import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IGamificationEvent extends Document {
  student: Types.ObjectId;
  sourceAttempt: Types.ObjectId;
  kind: "practice_reward";
  xp: number;
  dateKey: string;
  breakdown: {
    correctAnswers: number;
    completion: number;
    accuracy: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const GamificationEventSchema = new Schema<IGamificationEvent>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceAttempt: {
      type: Schema.Types.ObjectId,
      ref: "PracticeAttempt",
      required: true,
    },
    kind: { type: String, enum: ["practice_reward"], required: true },
    xp: { type: Number, required: true, min: 0 },
    dateKey: { type: String, required: true },
    breakdown: {
      correctAnswers: { type: Number, default: 0, min: 0 },
      completion: { type: Number, default: 0, min: 0 },
      accuracy: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true },
);

GamificationEventSchema.index({ sourceAttempt: 1, kind: 1 }, { unique: true });
GamificationEventSchema.index({ student: 1, dateKey: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.GamificationEvent) {
  mongoose.deleteModel("GamificationEvent");
}

export const GamificationEvent: Model<IGamificationEvent> =
  mongoose.models.GamificationEvent ||
  mongoose.model<IGamificationEvent>("GamificationEvent", GamificationEventSchema);
