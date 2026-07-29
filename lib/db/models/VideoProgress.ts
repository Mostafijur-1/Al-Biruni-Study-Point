import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type VideoProgressStatus = "started" | "completed";

export interface IVideoProgress extends Document {
  student: Types.ObjectId;
  video: Types.ObjectId;
  status: VideoProgressStatus;
  watchedSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  startedAt: Date;
  lastWatchedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VideoProgressSchema = new Schema<IVideoProgress>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    status: {
      type: String,
      enum: ["started", "completed"],
      default: "started",
    },
    watchedSeconds: { type: Number, default: 0, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    startedAt: { type: Date, default: Date.now },
    lastWatchedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

VideoProgressSchema.index({ student: 1, video: 1 }, { unique: true });
VideoProgressSchema.index({ student: 1, status: 1, lastWatchedAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.VideoProgress) {
  mongoose.deleteModel("VideoProgress");
}

export const VideoProgress: Model<IVideoProgress> =
  mongoose.models.VideoProgress ||
  mongoose.model<IVideoProgress>("VideoProgress", VideoProgressSchema);
