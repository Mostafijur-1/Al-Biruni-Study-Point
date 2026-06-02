import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "@/lib/db/ensure-schema-path";
import type { StudentClass } from "@/types";

export interface ICqAssignment extends Document {
  title: string;
  description?: string;
  targetClasses: StudentClass[];
  teacher: Types.ObjectId;
  totalMarks: number;
  dueDate?: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CqAssignmentSchema = new Schema<ICqAssignment>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    targetClasses: {
      type: [String],
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
      validate: {
        validator: (value: string[]) => value.length > 0,
        message: "At least one target class is required.",
      },
    },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalMarks: { type: Number, required: true, min: 1 },
    dueDate: { type: Date },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CqAssignmentSchema.index({ teacher: 1, createdAt: -1 });
CqAssignmentSchema.index({ targetClasses: 1, isPublished: 1 });

const CqAssignmentModel =
  mongoose.models.CqAssignment ||
  mongoose.model<ICqAssignment>("CqAssignment", CqAssignmentSchema);

ensureSchemaPaths(CqAssignmentModel, CqAssignmentSchema);

export const CqAssignment = CqAssignmentModel;
