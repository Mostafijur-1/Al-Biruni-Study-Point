import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { UserRole } from "../../../types";

export interface IAuditLog extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  actor: Types.ObjectId;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  requestId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: {
      type: String,
      enum: ["admin", "teacher", "student"],
      required: true,
    },
    action: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    requestId: { type: String, required: true, trim: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
AuditLogSchema.index({ organizationId: 1, resourceType: 1, createdAt: -1 });
AuditLogSchema.index({ branchId: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
