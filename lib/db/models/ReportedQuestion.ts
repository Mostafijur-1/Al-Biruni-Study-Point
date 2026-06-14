import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IReportedQuestion extends Document {
  questionId: Types.ObjectId;
  studentId: Types.ObjectId;
  comment: string;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReportedQuestionSchema = new Schema<IReportedQuestion>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "PracticeQuestion", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String, required: true, trim: true },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
ReportedQuestionSchema.index({ resolved: 1 });
ReportedQuestionSchema.index({ questionId: 1 });
ReportedQuestionSchema.index({ studentId: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.ReportedQuestion) {
  mongoose.deleteModel("ReportedQuestion");
}

export const ReportedQuestion: Model<IReportedQuestion> =
  mongoose.models.ReportedQuestion ||
  mongoose.model<IReportedQuestion>("ReportedQuestion", ReportedQuestionSchema);
