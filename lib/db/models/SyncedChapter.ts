import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISyncedChapter extends Document {
  level: "ssc" | "hsc";
  subject: string;
  chapter: string;
  createdAt: Date;
  updatedAt: Date;
}

const SyncedChapterSchema = new Schema<ISyncedChapter>(
  {
    level: { type: String, enum: ["ssc", "hsc"], required: true },
    subject: { type: String, required: true },
    chapter: { type: String, required: true },
  },
  { timestamps: true }
);

SyncedChapterSchema.index({ level: 1, subject: 1, chapter: 1 }, { unique: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.SyncedChapter) {
  mongoose.deleteModel("SyncedChapter");
}

export const SyncedChapter: Model<ISyncedChapter> =
  mongoose.models.SyncedChapter ||
  mongoose.model<ISyncedChapter>("SyncedChapter", SyncedChapterSchema);
