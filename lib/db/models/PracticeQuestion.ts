import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPracticeQuestion extends Document {
  level: "ssc" | "hsc";
  subject: string;
  chapter: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeQuestionSchema = new Schema<IPracticeQuestion>(
  {
    level: { type: String, enum: ["ssc", "hsc"], required: true },
    subject: { type: String, required: true },
    chapter: { type: String, required: true },
    question: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (options: string[]) => options.length === 4,
        message: "Each question must have exactly four options.",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

// Indexes for fast lookup
PracticeQuestionSchema.index({ level: 1, subject: 1, chapter: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.PracticeQuestion) {
  mongoose.deleteModel("PracticeQuestion");
}

export const PracticeQuestion: Model<IPracticeQuestion> =
  mongoose.models.PracticeQuestion ||
  mongoose.model<IPracticeQuestion>("PracticeQuestion", PracticeQuestionSchema);
