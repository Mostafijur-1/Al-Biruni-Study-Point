import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IStudentQuestClaim extends Document {
  student: Types.ObjectId;
  questCode: string;
  periodKey: string;
  xp: number;
  streakFreezes: number;
  claimedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentQuestClaimSchema = new Schema<IStudentQuestClaim>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questCode: { type: String, required: true, trim: true },
    periodKey: { type: String, required: true, trim: true },
    xp: { type: Number, required: true, min: 0 },
    streakFreezes: { type: Number, default: 0, min: 0 },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

StudentQuestClaimSchema.index(
  { student: 1, questCode: 1, periodKey: 1 },
  { unique: true },
);
StudentQuestClaimSchema.index({ student: 1, claimedAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.StudentQuestClaim) {
  mongoose.deleteModel("StudentQuestClaim");
}

export const StudentQuestClaim: Model<IStudentQuestClaim> =
  mongoose.models.StudentQuestClaim ||
  mongoose.model<IStudentQuestClaim>("StudentQuestClaim", StudentQuestClaimSchema);
