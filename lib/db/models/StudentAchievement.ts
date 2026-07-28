import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IStudentAchievement extends Document {
  student: Types.ObjectId;
  code: string;
  sourceAttempt?: Types.ObjectId;
  unlockedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentAchievementSchema = new Schema<IStudentAchievement>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true, trim: true },
    sourceAttempt: { type: Schema.Types.ObjectId, ref: "PracticeAttempt" },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

StudentAchievementSchema.index({ student: 1, code: 1 }, { unique: true });
StudentAchievementSchema.index({ student: 1, unlockedAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.StudentAchievement) {
  mongoose.deleteModel("StudentAchievement");
}

export const StudentAchievement: Model<IStudentAchievement> =
  mongoose.models.StudentAchievement ||
  mongoose.model<IStudentAchievement>("StudentAchievement", StudentAchievementSchema);
