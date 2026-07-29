import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { StudentClass } from "@/types";

export interface IClassMissionClaim extends Document {
  student: Types.ObjectId;
  studentClass: StudentClass;
  missionCode: string;
  periodKey: string;
  xp: number;
  claimedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClassMissionClaimSchema = new Schema<IClassMissionClaim>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
    },
    missionCode: { type: String, required: true, trim: true },
    periodKey: { type: String, required: true, trim: true },
    xp: { type: Number, required: true, min: 0 },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ClassMissionClaimSchema.index(
  { student: 1, missionCode: 1, periodKey: 1 },
  { unique: true },
);
ClassMissionClaimSchema.index({
  studentClass: 1,
  periodKey: 1,
  claimedAt: -1,
});

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.ClassMissionClaim
) {
  mongoose.deleteModel("ClassMissionClaim");
}

export const ClassMissionClaim: Model<IClassMissionClaim> =
  mongoose.models.ClassMissionClaim ||
  mongoose.model<IClassMissionClaim>(
    "ClassMissionClaim",
    ClassMissionClaimSchema,
  );
