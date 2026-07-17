import mongoose, { Document, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "@/lib/db/ensure-schema-path";
import type { StudentClass } from "@/types";

export interface IVideo extends Document {
  title: string;
  description?: string;
  videoUrl: string;
  targetClasses: StudentClass[];
  teacher: Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
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
VideoSchema.index({ targetClasses: 1, isPublished: 1 });

const VideoModel = mongoose.models.Video || mongoose.model<IVideo>("Video", VideoSchema);

ensureSchemaPaths(VideoModel, VideoSchema);

export const Video = VideoModel;
