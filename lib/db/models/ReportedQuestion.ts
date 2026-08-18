import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IReportedQuestion extends Document {
  questionId: Types.ObjectId;
  studentId: Types.ObjectId;
  comment: string;
  sourceType: "practice" | "exam";
  sourceOwnerId?: Types.ObjectId;
  sourceTitle?: string;
  questionSnapshot?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  };
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReportedQuestionSchema = new Schema<IReportedQuestion>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "PracticeQuestion", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String, required: true, trim: true },
    sourceType: {
      type: String,
      enum: ["practice", "exam"],
      default: "practice",
    },
    sourceOwnerId: { type: Schema.Types.ObjectId, ref: "User" },
    sourceTitle: { type: String, trim: true, maxlength: 200 },
    questionSnapshot: {
      question: { type: String, trim: true },
      options: { type: [String], default: undefined },
      correctIndex: { type: Number, min: 0, max: 3 },
      explanation: { type: String, trim: true },
    },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
ReportedQuestionSchema.index({ resolved: 1 });
ReportedQuestionSchema.index({ questionId: 1 });
ReportedQuestionSchema.index({ studentId: 1 });
ReportedQuestionSchema.index({ sourceOwnerId: 1, sourceType: 1, resolved: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.ReportedQuestion) {
  mongoose.deleteModel("ReportedQuestion");
}

export const ReportedQuestion: Model<IReportedQuestion> =
  mongoose.models.ReportedQuestion ||
  mongoose.model<IReportedQuestion>("ReportedQuestion", ReportedQuestionSchema);
