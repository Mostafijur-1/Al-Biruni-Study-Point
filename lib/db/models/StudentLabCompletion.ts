import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { ScienceLabId } from "@/lib/labs/rules";

export interface IStudentLabCompletion extends Document {
  student: Types.ObjectId;
  labId: ScienceLabId;
  result: number;
  xpEarned: number;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentLabCompletionSchema = new Schema<IStudentLabCompletion>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    labId: {
      type: String,
      enum: ["motion", "circuit", "mole"],
      required: true,
    },
    result: { type: Number, required: true, min: 0 },
    xpEarned: { type: Number, required: true, min: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

StudentLabCompletionSchema.index(
  { student: 1, labId: 1 },
  { unique: true },
);
StudentLabCompletionSchema.index({ student: 1, completedAt: -1 });

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.StudentLabCompletion
) {
  mongoose.deleteModel("StudentLabCompletion");
}

export const StudentLabCompletion: Model<IStudentLabCompletion> =
  mongoose.models.StudentLabCompletion ||
  mongoose.model<IStudentLabCompletion>(
    "StudentLabCompletion",
    StudentLabCompletionSchema,
  );
