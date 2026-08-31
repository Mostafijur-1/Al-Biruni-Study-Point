import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { requireCanonicalPathsWhenEnabled } from "../canonical-scope-guard.ts";

export type McqDifficulty = "easy" | "medium" | "hard";

export interface IMcqQuestion extends Document {
  organizationId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  chapterId?: Types.ObjectId;
  topicId?: Types.ObjectId;
  questionId?: Types.ObjectId;
  questionVersionId?: Types.ObjectId;
  exam: Types.ObjectId;
  question: string;
  questionBn?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  marks: number;
  difficulty: McqDifficulty;
  topic?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const McqQuestionSchema = new Schema<IMcqQuestion>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject" },
    chapterId: { type: Schema.Types.ObjectId, ref: "AcademicChapter" },
    topicId: { type: Schema.Types.ObjectId, ref: "AcademicTopic" },
    questionId: { type: Schema.Types.ObjectId, ref: "Question" },
    questionVersionId: { type: Schema.Types.ObjectId, ref: "QuestionVersion" },
    exam: { type: Schema.Types.ObjectId, ref: "McqExam", required: true },
    question: { type: String, required: true, trim: true },
    questionBn: { type: String, trim: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (options: string[]) => options.length === 4,
        message: "Each MCQ question must have exactly four options.",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String },
    marks: { type: Number, default: 1, min: 0 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    topic: { type: String, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

McqQuestionSchema.index({ exam: 1, order: 1 });
McqQuestionSchema.index({ exam: 1, topic: 1 });
McqQuestionSchema.index({ organizationId: 1, subjectId: 1, chapterId: 1, topicId: 1 });
requireCanonicalPathsWhenEnabled(McqQuestionSchema, ["organizationId", "subjectId"]);

export const McqQuestion: Model<IMcqQuestion> =
  mongoose.models.McqQuestion ||
  mongoose.model<IMcqQuestion>("McqQuestion", McqQuestionSchema);
