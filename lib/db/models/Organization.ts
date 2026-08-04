import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  slug: string;
  timezone: string;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    timezone: { type: String, default: "Asia/Dhaka", trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ status: 1 });

export const Organization: Model<IOrganization> =
  (mongoose.models.Organization as Model<IOrganization> | undefined) ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);
