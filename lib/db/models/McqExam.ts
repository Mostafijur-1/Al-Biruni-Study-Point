import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "@/lib/db/ensure-schema-path";
import type { StudentClass } from "@/types";

export interface IMcqExam extends Document {
  title: string;
  targetClasses: StudentClass[];
  course?: Types.ObjectId;
  teacher: Types.ObjectId;
  duration: number;
  totalMarks: number;
  passMark: number;
  negativeMarking: number;
  isRandomized: boolean;
  isPublished: boolean;
  startTime?: Date;
  endTime?: Date;
  attempts: number;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const McqExamSchema = new Schema<IMcqExam>(
  {
    title: { type: String, required: true, trim: true },
    targetClasses: {
      type: [String],
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
      validate: {
        validator: (value: string[]) => value.length > 0,
        message: "At least one target class is required.",
      },
    },
    course: { type: Schema.Types.ObjectId, ref: "Course" },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    duration: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 1 },
    passMark: { type: Number, required: true, min: 0 },
    negativeMarking: { type: Number, default: 0, min: 0 },
    isRandomized: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    startTime: { type: Date },
    endTime: { type: Date },
    attempts: { type: Number, default: 1, min: 1 },
    questionCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

McqExamSchema.index({ course: 1, isPublished: 1 });
McqExamSchema.index({ teacher: 1, createdAt: -1 });
McqExamSchema.index({ isPublished: 1, startTime: 1, endTime: 1 });
McqExamSchema.index({ targetClasses: 1, isPublished: 1 });

const McqExamModel =
  mongoose.models.McqExam || mongoose.model<IMcqExam>("McqExam", McqExamSchema);

ensureSchemaPaths(McqExamModel, McqExamSchema);

export const McqExam = McqExamModel;
