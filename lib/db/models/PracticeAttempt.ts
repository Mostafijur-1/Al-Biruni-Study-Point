import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPracticeAnswer {
  questionId: Types.ObjectId; // reference to the MCQ question ID (stored as string in DB)
  question: string;
  options: string[];
  selectedIndex: number | null; // 0-3, null when unanswered
  isCorrect: boolean;
  correctIndex: number;
  explanation?: string;
}

export interface IPracticeAttempt extends Document {
  student: Types.ObjectId;
  subject: string;
  answers: IPracticeAnswer[];
  totalQuestions: number;
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number; // seconds
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    answers: { type: [Object], default: [] },
    totalQuestions: { type: Number, required: true },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    isPassed: { type: Boolean, required: true },
    timeTaken: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

PracticeAttemptSchema.index({ student: 1, subject: 1, createdAt: -1 });

export const PracticeAttempt: Model<IPracticeAttempt> =
  mongoose.models.PracticeAttempt ||
  mongoose.model<IPracticeAttempt>("PracticeAttempt", PracticeAttemptSchema);
