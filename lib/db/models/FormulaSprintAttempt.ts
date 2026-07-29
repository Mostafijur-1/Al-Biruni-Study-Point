import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type {
  FormulaConfidence,
} from "@/lib/formulas/rules";
import type { FormulaLevel } from "@/lib/formulas/cards";
import type { StudentClass } from "@/types";

export type FormulaSprintStatus = "started" | "completed";

export interface IFormulaSprintAnswer {
  cardId: string;
  confidence: FormulaConfidence;
}

export interface IFormulaSprintAttempt extends Document {
  student: Types.ObjectId;
  studentClass: StudentClass;
  level: FormulaLevel;
  dateKey: string;
  cardIds: string[];
  answers: IFormulaSprintAnswer[];
  status: FormulaSprintStatus;
  xpEarned: number;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FormulaSprintAttemptSchema = new Schema<IFormulaSprintAttempt>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
    },
    level: { type: String, enum: ["SSC", "HSC"], required: true },
    dateKey: { type: String, required: true, trim: true },
    cardIds: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => value.length === 5,
        message: "A formula sprint requires five cards.",
      },
    },
    answers: {
      type: [
        {
          cardId: { type: String, required: true, trim: true },
          confidence: {
            type: String,
            enum: ["again", "good", "easy"],
            required: true,
          },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["started", "completed"],
      default: "started",
    },
    xpEarned: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

FormulaSprintAttemptSchema.index(
  { student: 1, dateKey: 1 },
  { unique: true },
);
FormulaSprintAttemptSchema.index({
  student: 1,
  status: 1,
  dateKey: -1,
});

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.FormulaSprintAttempt
) {
  mongoose.deleteModel("FormulaSprintAttempt");
}

export const FormulaSprintAttempt: Model<IFormulaSprintAttempt> =
  mongoose.models.FormulaSprintAttempt ||
  mongoose.model<IFormulaSprintAttempt>(
    "FormulaSprintAttempt",
    FormulaSprintAttemptSchema,
  );
