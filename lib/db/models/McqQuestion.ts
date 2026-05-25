import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type McqDifficulty = "easy" | "medium" | "hard";

export interface IMcqQuestion extends Document {
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
    correctIndex: { type: Number, required: true, min: 0, max: 3, select: false },
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

export const McqQuestion: Model<IMcqQuestion> =
  mongoose.models.McqQuestion ||
  mongoose.model<IMcqQuestion>("McqQuestion", McqQuestionSchema);
