import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IWrittenExamResult extends Document {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  marks: number;
  comment?: string;
  enteredBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WrittenExamResultSchema = new Schema<IWrittenExamResult>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "WrittenExam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "BatchEnrollment", required: true },
    marks: { type: Number, required: true, min: 0 },
    comment: { type: String, trim: true, maxlength: 500 },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

WrittenExamResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
WrittenExamResultSchema.index({ studentId: 1, updatedAt: -1 });

export const WrittenExamResult: Model<IWrittenExamResult> =
  (mongoose.models.WrittenExamResult as Model<IWrittenExamResult> | undefined) ||
  mongoose.model<IWrittenExamResult>("WrittenExamResult", WrittenExamResultSchema);
