import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPracticeResult extends Document {
  attemptSession?: Types.ObjectId;
  student: Types.ObjectId;
  subject: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number; // in seconds
  teacherComment?: string;
  commentedBy?: Types.ObjectId;
  submittedAt: Date;
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

const PracticeResultSchema = new Schema<IPracticeResult>(
  {
    attemptSession: { type: Schema.Types.ObjectId, ref: "AttemptSession" },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    isPassed: { type: Boolean, required: true },
    timeTaken: { type: Number, required: true, min: 0 },
    teacherComment: { type: String, default: "" },
    commentedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, default: Date.now },
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

// Index for quick queries of student practice history
PracticeResultSchema.index({ student: 1, subject: 1 });
PracticeResultSchema.index({ attemptSession: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.PracticeResult) {
  mongoose.deleteModel("PracticeResult");
}

export const PracticeResult: Model<IPracticeResult> =
  mongoose.models.PracticeResult ||
  mongoose.model<IPracticeResult>("PracticeResult", PracticeResultSchema);
