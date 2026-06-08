import mongoose, { Document, Model, Schema } from "mongoose";

import type { ApprovalStatus, StudentClass, UserRole } from "@/types";

export interface IUser extends Document {
  name: string;
  phone?: string;
  email?: string;
  password: string;
  role: UserRole;
  studentClass?: StudentClass;
  avatar?: string;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  teacherDomain?: {
    isAll: boolean;
    classes: StudentClass[];
    subjects: string[];
  };
  refreshTokenHash?: string;
  aiProfile?: {
    learningStyle?: string;
    weakTopics?: string[];
    recommendations?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "student",
    },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
    },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    teacherDomain: {
      isAll: { type: Boolean, default: false },
      classes: [{ type: String, enum: ["class-9", "class-10", "class-11", "class-12"] }],
      subjects: [{ type: String }],
    },
    refreshTokenHash: { type: String, select: false },
    aiProfile: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ role: 1, studentClass: 1 });
UserSchema.index({ approvalStatus: 1 });

const ExistingUserModel = mongoose.models.User as Model<IUser> | undefined;

if (
  process.env.NODE_ENV !== "production" &&
  ExistingUserModel &&
  (!ExistingUserModel.schema.path("studentClass") ||
    !ExistingUserModel.schema.path("teacherDomain") ||
    ExistingUserModel.schema.path("phone")?.options.required)
) {
  mongoose.deleteModel("User");
}

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser> | undefined) ||
  mongoose.model<IUser>("User", UserSchema);
