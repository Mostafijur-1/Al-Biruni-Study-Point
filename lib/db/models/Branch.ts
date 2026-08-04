import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { ensureSchemaPaths } from "../ensure-schema-path.ts";

export interface IBranch extends Document {
  organizationId: Types.ObjectId;
  name: string;
  code: string;
  address?: string;
  scheduleVersion: number;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true },
    scheduleVersion: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

BranchSchema.index({ organizationId: 1, code: 1 }, { unique: true });
BranchSchema.index({ organizationId: 1, status: 1 });

const BranchModel: Model<IBranch> =
  (mongoose.models.Branch as Model<IBranch> | undefined) ||
  mongoose.model<IBranch>("Branch", BranchSchema);

ensureSchemaPaths(BranchModel, BranchSchema);

export const Branch = BranchModel;
