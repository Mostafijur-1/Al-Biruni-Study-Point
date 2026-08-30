import mongoose, { Document, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "@/lib/db/ensure-schema-path";
import { requireCanonicalPathsWhenEnabled } from "@/lib/db/canonical-scope-guard";
import type { CourseLevel, CourseSubject, StudentClass } from "@/types";

export type CourseStatus = "draft" | "published" | "archived";

export interface ICourse extends Document {
  organizationId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  title: string;
  titleBn: string;
  slug: string;
  description?: string;
  level: CourseLevel;
  subject: CourseSubject;
  targetClasses: StudentClass[];
  teacher: Types.ObjectId;
  thumbnail?: string;
  price: number;
  isFree: boolean;
  status: CourseStatus;
  tags: string[];
  totalVideos: number;
  totalExams: number;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject" },
    title: { type: String, required: true, trim: true },
    titleBn: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    level: { type: String, enum: ["SSC", "HSC"], required: true },
    subject: {
      type: String,
      enum: ["Physics", "Chemistry", "Math", "Higher Math", "ICT"],
      required: true,
    },
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
    thumbnail: { type: String },
    price: { type: Number, default: 0, min: 0 },
    isFree: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    tags: [{ type: String }],
    totalVideos: { type: Number, default: 0 },
    totalExams: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CourseSchema.index({ level: 1, subject: 1 });
CourseSchema.index({ status: 1 });
CourseSchema.index({ targetClasses: 1, status: 1 });
CourseSchema.index({ slug: 1 }, { unique: true });
CourseSchema.index({ organizationId: 1, subjectId: 1, status: 1 });

requireCanonicalPathsWhenEnabled(CourseSchema, ["organizationId", "subjectId"]);

const CourseModel =
  mongoose.models.Course || mongoose.model<ICourse>("Course", CourseSchema);

ensureSchemaPaths(CourseModel, CourseSchema);

export const Course = CourseModel;
