import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { StudentClass } from "@/types";

export interface IAcademicSubject extends Document {
  organizationId?: Types.ObjectId;
  code: string;
  name: string;
  nameBn: string;
  classLevels: StudentClass[];
  aliases: string[];
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const AcademicSubjectSchema = new Schema<IAcademicSubject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    nameBn: { type: String, required: true, trim: true },
    classLevels: {
      type: [String],
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
      validate: {
        validator: (value: string[]) => value.length > 0,
        message: "At least one class level is required.",
      },
    },
    aliases: { type: [String], default: [] },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

AcademicSubjectSchema.index({ organizationId: 1, code: 1 }, { unique: true });
AcademicSubjectSchema.index({ organizationId: 1, classLevels: 1, status: 1 });

export const AcademicSubject: Model<IAcademicSubject> =
  (mongoose.models.AcademicSubject as Model<IAcademicSubject> | undefined) ||
  mongoose.model<IAcademicSubject>("AcademicSubject", AcademicSubjectSchema);
