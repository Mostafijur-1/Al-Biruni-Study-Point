import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IStudentGameProfile extends Document {
  student: Types.ObjectId;
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastQualifiedDate?: string;
  dailyProgressDate?: string;
  dailyProgress: number;
  dailyGoalTarget: number;
  testsCompleted: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  streakFreezes: number;
  streakFreezesUsed: number;
  selectedFrame: string;
  selectedTheme: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentGameProfileSchema = new Schema<IStudentGameProfile>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    totalXp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastQualifiedDate: { type: String },
    dailyProgressDate: { type: String },
    dailyProgress: { type: Number, default: 0, min: 0 },
    dailyGoalTarget: { type: Number, default: 10, min: 1 },
    testsCompleted: { type: Number, default: 0, min: 0 },
    totalQuestionsAnswered: { type: Number, default: 0, min: 0 },
    totalCorrect: { type: Number, default: 0, min: 0 },
    streakFreezes: { type: Number, default: 0, min: 0 },
    streakFreezesUsed: { type: Number, default: 0, min: 0 },
    selectedFrame: { type: String, default: "classic", trim: true },
    selectedTheme: { type: String, default: "classic", trim: true },
  },
  { timestamps: true },
);

if (process.env.NODE_ENV !== "production" && mongoose.models.StudentGameProfile) {
  mongoose.deleteModel("StudentGameProfile");
}

export const StudentGameProfile: Model<IStudentGameProfile> =
  mongoose.models.StudentGameProfile ||
  mongoose.model<IStudentGameProfile>("StudentGameProfile", StudentGameProfileSchema);
