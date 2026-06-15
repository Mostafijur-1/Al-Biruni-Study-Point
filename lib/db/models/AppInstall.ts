import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAppInstall extends Document {
  deviceId: string;
  userId?: Types.ObjectId;
  type: "install" | "launch";
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppInstallSchema = new Schema<IAppInstall>(
  {
    deviceId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["install", "launch"], required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

// Indexing deviceId and type to facilitate counting unique devices
AppInstallSchema.index({ deviceId: 1, type: 1 });
AppInstallSchema.index({ createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.AppInstall) {
  mongoose.deleteModel("AppInstall");
}

export const AppInstall: Model<IAppInstall> =
  mongoose.models.AppInstall ||
  mongoose.model<IAppInstall>("AppInstall", AppInstallSchema);
