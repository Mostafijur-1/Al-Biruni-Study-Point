import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type DailyChallengeAttemptStatus =
  | "started"
  | "submitted"
  | "expired";

export interface IDailyChallengeAnswer {
  questionId: Types.ObjectId;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export interface IDailyChallengeAttempt extends Document {
  challenge: Types.ObjectId;
  student: Types.ObjectId;
  dateKey: string;
  status: DailyChallengeAttemptStatus;
  answers: IDailyChallengeAnswer[];
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds: number;
  xpEarned: number;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyChallengeAttemptSchema = new Schema<IDailyChallengeAttempt>(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: "DailyChallenge",
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateKey: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["started", "submitted", "expired"],
      default: "started",
    },
    answers: {
      type: [{
        questionId: {
          type: Schema.Types.ObjectId,
          ref: "PracticeQuestion",
          required: true,
        },
        selectedIndex: { type: Number, min: 0, max: 3, default: null },
        isCorrect: { type: Boolean, required: true },
      }],
      default: [],
    },
    score: { type: Number, default: 0, min: 0 },
    totalQuestions: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    timeTakenSeconds: { type: Number, default: 0, min: 0 },
    xpEarned: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

DailyChallengeAttemptSchema.index(
  { challenge: 1, student: 1 },
  { unique: true },
);
DailyChallengeAttemptSchema.index({
  student: 1,
  status: 1,
  dateKey: -1,
});
DailyChallengeAttemptSchema.index({
  challenge: 1,
  status: 1,
  submittedAt: -1,
});

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.DailyChallengeAttempt
) {
  mongoose.deleteModel("DailyChallengeAttempt");
}

export const DailyChallengeAttempt: Model<IDailyChallengeAttempt> =
  mongoose.models.DailyChallengeAttempt ||
  mongoose.model<IDailyChallengeAttempt>(
    "DailyChallengeAttempt",
    DailyChallengeAttemptSchema,
  );
