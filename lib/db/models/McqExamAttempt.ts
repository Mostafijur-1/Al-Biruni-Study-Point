import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IMcqExamAnswer {
  questionId: Types.ObjectId;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export interface IMcqQuestionSnapshot {
  questionId: Types.ObjectId;
  question: string;
  questionBn?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  marks: number;
}

export interface IMcqExamAttempt extends Document {
  attemptSession?: Types.ObjectId;
  student: Types.ObjectId;
  exam: Types.ObjectId;
  answers: IMcqExamAnswer[];
  questionSnapshots: IMcqQuestionSnapshot[];
  examSnapshot?: { title: string; duration: number; totalMarks: number; passMark: number; version: number };
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

const McqExamAnswerSchema = new Schema<IMcqExamAnswer>({
  questionId: { type: Schema.Types.ObjectId, ref: "McqQuestion", required: true },
  selectedIndex: { type: Number, min: 0, max: 3, default: null },
  isCorrect: { type: Boolean, required: true },
}, { _id: false });

const McqQuestionSnapshotSchema = new Schema<IMcqQuestionSnapshot>({
  questionId: { type: Schema.Types.ObjectId, required: true },
  question: { type: String, required: true },
  questionBn: String,
  options: { type: [String], required: true },
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation: String,
  marks: { type: Number, required: true, min: 0.01 },
}, { _id: false });

const McqExamSnapshotSchema = new Schema({
  title: { type: String, required: true }, duration: { type: Number, required: true, min: 1 },
  totalMarks: { type: Number, required: true, min: 1 }, passMark: { type: Number, required: true, min: 0 },
  version: { type: Number, required: true, min: 0 },
}, { _id: false });

const McqExamAttemptSchema = new Schema<IMcqExamAttempt>(
  {
    attemptSession: { type: Schema.Types.ObjectId, ref: "AttemptSession" },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exam: { type: Schema.Types.ObjectId, ref: "McqExam", required: true },
    answers: { type: [McqExamAnswerSchema], default: [] },
    questionSnapshots: { type: [McqQuestionSnapshotSchema], default: [] },
    examSnapshot: { type: McqExamSnapshotSchema },
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
