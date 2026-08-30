import mongoose, { Document, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "@/lib/db/ensure-schema-path";
import { requireCanonicalPathsWhenEnabled } from "@/lib/db/canonical-scope-guard";
import type { StudentClass } from "@/types";

export interface IVideo extends Document {
  organizationId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  chapterId?: Types.ObjectId;
  topicId?: Types.ObjectId;
  title: string;
  description?: string;
  subject?: string;
  videoUrl: string;
  targetClasses: StudentClass[];
  teacher: Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject" },
    chapterId: { type: Schema.Types.ObjectId, ref: "AcademicChapter" },
    topicId: { type: Schema.Types.ObjectId, ref: "AcademicTopic" },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    subject: { type: String, trim: true },
    videoUrl: { type: String, required: true, trim: true },
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
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

VideoSchema.index({ teacher: 1, createdAt: -1 });
VideoSchema.index({ subject: 1, targetClasses: 1, isPublished: 1 });
VideoSchema.index({ targetClasses: 1, isPublished: 1 });
VideoSchema.index({ organizationId: 1, subjectId: 1, chapterId: 1, isPublished: 1 });
requireCanonicalPathsWhenEnabled(VideoSchema, ["organizationId", "subjectId"]);

const VideoModel = mongoose.models.Video || mongoose.model<IVideo>("Video", VideoSchema);

ensureSchemaPaths(VideoModel, VideoSchema);

export const Video = VideoModel;
