import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { StudentClass } from "@/types";

export interface IDailyChallenge extends Document {
  dateKey: string;
  studentClass: StudentClass;
  questionIds: Types.ObjectId[];
  subjects: string[];
  durationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyChallengeSchema = new Schema<IDailyChallenge>(
  {
    dateKey: { type: String, required: true, trim: true },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
    },
    questionIds: [{
      type: Schema.Types.ObjectId,
      ref: "PracticeQuestion",
      required: true,
    }],
    subjects: [{ type: String, required: true, trim: true }],
    durationSeconds: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

DailyChallengeSchema.index(
  { dateKey: 1, studentClass: 1 },
  { unique: true },
);

if (process.env.NODE_ENV !== "production" && mongoose.models.DailyChallenge) {
  mongoose.deleteModel("DailyChallenge");
}

export const DailyChallenge: Model<IDailyChallenge> =
  mongoose.models.DailyChallenge ||
  mongoose.model<IDailyChallenge>("DailyChallenge", DailyChallengeSchema);
