import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IStudentLearningProfile extends Document {
  student: Types.ObjectId;
  mistakesBackfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentLearningProfileSchema = new Schema<IStudentLearningProfile>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    mistakesBackfilledAt: { type: Date },
  },
  { timestamps: true },
);

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.StudentLearningProfile
) {
  mongoose.deleteModel("StudentLearningProfile");
}

export const StudentLearningProfile: Model<IStudentLearningProfile> =
  mongoose.models.StudentLearningProfile ||
  mongoose.model<IStudentLearningProfile>(
    "StudentLearningProfile",
    StudentLearningProfileSchema,
  );
