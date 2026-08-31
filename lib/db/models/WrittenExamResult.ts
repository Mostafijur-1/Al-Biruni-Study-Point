import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { WrittenExamResultPublication } from "./WrittenExamResultPublication.ts";

export interface IWrittenExamResult extends Document {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  marks: number;
  comment?: string;
  enteredBy: Types.ObjectId;
  assessmentAttemptId?: Types.ObjectId;
  publicationId?: Types.ObjectId;
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
    assessmentAttemptId: { type: Schema.Types.ObjectId, ref: "AssessmentAttempt" },
    publicationId: { type: Schema.Types.ObjectId, ref: "WrittenExamResultPublication" },
  },
  { timestamps: true },
);

WrittenExamResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
WrittenExamResultSchema.index({ studentId: 1, updatedAt: -1 });

WrittenExamResultSchema.pre("save", async function () {
  if (this.isNew || !this.isModified()) return;
  if (await WrittenExamResultPublication.exists({ examId: this.examId })) throw new Error("Published written results are immutable; append a correction instead.");
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  WrittenExamResultSchema.pre(operation, async function () {
    const rows = await this.model.find(this.getFilter()).select("examId").lean();
    if (rows.length && await WrittenExamResultPublication.exists({ examId: { $in: rows.map((row) => row.examId) } })) throw new Error("Published written results are immutable; append a correction instead.");
  });
}

export const WrittenExamResult: Model<IWrittenExamResult> =
  (mongoose.models.WrittenExamResult as Model<IWrittenExamResult> | undefined) ||
  mongoose.model<IWrittenExamResult>("WrittenExamResult", WrittenExamResultSchema);
