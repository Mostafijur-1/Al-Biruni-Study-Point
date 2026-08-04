import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPracticeAnswer {
  questionId: Types.ObjectId | string;
  question: string;
  options: string[];
  selectedIndex: number | null; // 0-3, null when unanswered
  isCorrect: boolean;
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
}

export interface IPracticeAttempt extends Document {
  attemptSession?: Types.ObjectId;
  student: Types.ObjectId;
  subject: string;
  answers: IPracticeAnswer[];
  totalQuestions: number;
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number; // seconds
  teacherComment?: string;
  commentedBy?: Types.ObjectId;
  deletedByTeacher?: boolean;
  isTeacherSet?: boolean;
  teacherId?: Types.ObjectId;
  isCancelled?: boolean;
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  voidReason?: string;
  passMarkPercent?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    attemptSession: { type: Schema.Types.ObjectId, ref: "AttemptSession" },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    answers: { type: [Object], default: [] },
    totalQuestions: { type: Number, required: true },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    isPassed: { type: Boolean, required: true },
    timeTaken: { type: Number, required: true, min: 0 },
    teacherComment: { type: String, default: "" },
    commentedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedByTeacher: { type: Boolean, default: false },
    isTeacherSet: { type: Boolean, default: false },
    teacherId: { type: Schema.Types.ObjectId, ref: "User" },
    isCancelled: { type: Boolean, default: false },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String, trim: true },
    passMarkPercent: { type: Number, min: 1, max: 100 },
  },
  { timestamps: true }
);

PracticeAttemptSchema.index({ student: 1, subject: 1, createdAt: -1 });
PracticeAttemptSchema.index({ attemptSession: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.PracticeAttempt) {
  mongoose.deleteModel("PracticeAttempt");
}

export const PracticeAttempt: Model<IPracticeAttempt> =
  mongoose.models.PracticeAttempt ||
  mongoose.model<IPracticeAttempt>("PracticeAttempt", PracticeAttemptSchema);
