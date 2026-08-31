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
  assessmentAttemptId?: Types.ObjectId;
  student: Types.ObjectId;
  subject: string;
  answers: IPracticeAnswer[];
  assessmentSnapshot?: { subject: string; totalQuestions: number; passMarkPercent: number; mode: "general" | "teacher" };
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
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAnswerSchema = new Schema<IPracticeAnswer>({
  questionId: { type: Schema.Types.ObjectId, required: true },
  question: { type: String, required: true },
  options: { type: [String], required: true },
  selectedIndex: { type: Number, min: 0, max: 3, default: null },
  isCorrect: { type: Boolean, required: true },
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation: String,
  imageUrl: String,
}, { _id: false });

const PracticeAssessmentSnapshotSchema = new Schema({
  subject: { type: String, required: true }, totalQuestions: { type: Number, required: true, min: 1 },
  passMarkPercent: { type: Number, required: true, min: 1, max: 100 },
  mode: { type: String, enum: ["general", "teacher"], required: true },
}, { _id: false });

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    attemptSession: { type: Schema.Types.ObjectId, ref: "AttemptSession" },
    assessmentAttemptId: { type: Schema.Types.ObjectId, ref: "AssessmentAttempt" },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    answers: { type: [PracticeAnswerSchema], default: [] },
    assessmentSnapshot: { type: PracticeAssessmentSnapshotSchema },
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
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PracticeAttemptSchema.index({ student: 1, subject: 1, createdAt: -1 });
PracticeAttemptSchema.index({ attemptSession: 1 }, { unique: true, sparse: true });
PracticeAttemptSchema.index({ assessmentAttemptId: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.PracticeAttempt) {
  mongoose.deleteModel("PracticeAttempt");
}

export const PracticeAttempt: Model<IPracticeAttempt> =
  mongoose.models.PracticeAttempt ||
  mongoose.model<IPracticeAttempt>("PracticeAttempt", PracticeAttemptSchema);
