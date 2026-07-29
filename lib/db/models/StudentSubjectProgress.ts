import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IStudentSubjectProgress extends Document {
  student: Types.ObjectId;
  subject: string;
  xp: number;
  level: number;
  attempts: number;
  questionsAnswered: number;
  correctAnswers: number;
  bestAccuracy: number;
  lastAccuracy: number;
  personalBestCount: number;
  lastPracticedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSubjectProgressSchema = new Schema<IStudentSubjectProgress>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    attempts: { type: Number, default: 0, min: 0 },
    questionsAnswered: { type: Number, default: 0, min: 0 },
    correctAnswers: { type: Number, default: 0, min: 0 },
    bestAccuracy: { type: Number, default: 0, min: 0, max: 100 },
    lastAccuracy: { type: Number, default: 0, min: 0, max: 100 },
    personalBestCount: { type: Number, default: 0, min: 0 },
    lastPracticedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

StudentSubjectProgressSchema.index({ student: 1, subject: 1 }, { unique: true });
StudentSubjectProgressSchema.index({ student: 1, xp: -1 });

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.StudentSubjectProgress
) {
  mongoose.deleteModel("StudentSubjectProgress");
}

export const StudentSubjectProgress: Model<IStudentSubjectProgress> =
  mongoose.models.StudentSubjectProgress ||
  mongoose.model<IStudentSubjectProgress>(
    "StudentSubjectProgress",
    StudentSubjectProgressSchema,
  );
