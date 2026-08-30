import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IWrittenExam extends Document {
  batchId: Types.ObjectId;
  subjectId: Types.ObjectId;
  title: string;
  examDate: Date;
  totalMarks: number;
  questionFile?: { data: Buffer; contentType: string; fileName: string };
  instructions?: string;
  createdBy: Types.ObjectId;
  creatorRole: "admin" | "teacher";
  isPublished: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WrittenExamSchema = new Schema<IWrittenExam>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    examDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, min: 1, max: 10_000 },
    questionFile: {
      data: { type: Buffer, select: false },
      contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
      fileName: { type: String, trim: true, maxlength: 180 },
    },
    instructions: { type: String, trim: true, maxlength: 1_000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    creatorRole: { type: String, enum: ["admin", "teacher"], required: true },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

WrittenExamSchema.index({ batchId: 1, examDate: -1 });
WrittenExamSchema.index({ createdBy: 1, examDate: -1 });
WrittenExamSchema.index({ isPublished: 1, examDate: -1 });

export const WrittenExam: Model<IWrittenExam> =
  (mongoose.models.WrittenExam as Model<IWrittenExam> | undefined) ||
  mongoose.model<IWrittenExam>("WrittenExam", WrittenExamSchema);
