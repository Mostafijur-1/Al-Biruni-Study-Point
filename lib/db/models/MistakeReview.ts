import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type MistakeStatus = "active" | "mastered";

export interface IMistakeReview extends Document {
  student: Types.ObjectId;
  question: Types.ObjectId;
  subject: string;
  chapter: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
  wrongCount: number;
  reviewCount: number;
  correctStreak: number;
  status: MistakeStatus;
  nextReviewAt: Date;
  lastWrongAt: Date;
  lastReviewedAt: Date;
  masteredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MistakeReviewSchema = new Schema<IMistakeReview>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    question: {
      type: Schema.Types.ObjectId,
      ref: "PracticeQuestion",
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    chapter: { type: String, required: true, trim: true },
    questionText: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (options: string[]) => options.length === 4,
        message: "A mistake review requires four options.",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    wrongCount: { type: Number, default: 1, min: 1 },
    reviewCount: { type: Number, default: 0, min: 0 },
    correctStreak: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "mastered"],
      default: "active",
    },
    nextReviewAt: { type: Date, required: true },
    lastWrongAt: { type: Date, required: true },
    lastReviewedAt: { type: Date, required: true },
    masteredAt: { type: Date },
  },
  { timestamps: true },
);

MistakeReviewSchema.index({ student: 1, question: 1 }, { unique: true });
MistakeReviewSchema.index({ student: 1, status: 1, nextReviewAt: 1 });
MistakeReviewSchema.index({ student: 1, subject: 1, chapter: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.MistakeReview) {
  mongoose.deleteModel("MistakeReview");
}

export const MistakeReview: Model<IMistakeReview> =
  mongoose.models.MistakeReview ||
  mongoose.model<IMistakeReview>("MistakeReview", MistakeReviewSchema);
