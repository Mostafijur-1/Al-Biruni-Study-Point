import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IResultAnswer {
  questionId: Types.ObjectId;
  selectedIndex: number;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface IResult extends Document {
  student: Types.ObjectId;
  exam: Types.ObjectId;
  answers: IResultAnswer[];
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number;
  attemptNo: number;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResultAnswerSchema = new Schema<IResultAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "McqQuestion", required: true },
    selectedIndex: { type: Number, required: true, min: 0, max: 3 },
    isCorrect: { type: Boolean, required: true },
    marksAwarded: { type: Number, required: true },
  },
  { _id: false },
);

const ResultSchema = new Schema<IResult>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exam: { type: Schema.Types.ObjectId, ref: "McqExam", required: true },
    answers: { type: [ResultAnswerSchema], default: [] },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    isPassed: { type: Boolean, required: true },
    timeTaken: { type: Number, required: true, min: 0 },
    attemptNo: { type: Number, required: true, min: 1 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ResultSchema.index({ student: 1, exam: 1, attemptNo: 1 }, { unique: true });
ResultSchema.index({ exam: 1, score: -1 });
ResultSchema.index({ student: 1, submittedAt: -1 });

export const Result: Model<IResult> =
  mongoose.models.Result || mongoose.model<IResult>("Result", ResultSchema);
