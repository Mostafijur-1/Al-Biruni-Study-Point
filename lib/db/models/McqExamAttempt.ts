import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IMcqExamAnswer {
  questionId: Types.ObjectId;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export interface IMcqExamAttempt extends Document {
  attemptSession?: Types.ObjectId;
  student: Types.ObjectId;
  exam: Types.ObjectId;
  answers: IMcqExamAnswer[];
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number; // in seconds
  attemptNo: number;
  teacherComment?: string;
  commentedBy?: Types.ObjectId;
  isCancelled?: boolean;
  totalMarksSnapshot?: number;
  passMarkSnapshot?: number;
  examVersion?: number;
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  voidReason?: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const McqExamAttemptSchema = new Schema<IMcqExamAttempt>(
  {
    attemptSession: { type: Schema.Types.ObjectId, ref: "AttemptSession" },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exam: { type: Schema.Types.ObjectId, ref: "McqExam", required: true },
    answers: { type: [Object], default: [] },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    isPassed: { type: Boolean, required: true },
    timeTaken: { type: Number, required: true, min: 0 }, // seconds
    attemptNo: { type: Number, default: 1 },
    teacherComment: { type: String, default: "" },
    commentedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isCancelled: { type: Boolean, default: false },
    totalMarksSnapshot: { type: Number, min: 1 },
    passMarkSnapshot: { type: Number, min: 1 },
    examVersion: { type: Number, min: 0 },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per student, exam, and attempt number
McqExamAttemptSchema.index({ student: 1, exam: 1, attemptNo: 1 }, { unique: true });
McqExamAttemptSchema.index({ attemptSession: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.McqExamAttempt) {
  mongoose.deleteModel("McqExamAttempt");
}

export const McqExamAttempt: Model<IMcqExamAttempt> =
  mongoose.models.McqExamAttempt ||
  mongoose.model<IMcqExamAttempt>("McqExamAttempt", McqExamAttemptSchema);
