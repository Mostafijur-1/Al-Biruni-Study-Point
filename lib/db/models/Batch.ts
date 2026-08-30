import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { isValidDateRange, type AcademicLifecycleStatus } from "../../academic-rules.ts";
import type { StudentClass } from "@/types";
import { BATCH_SCOPE_CODE_INDEX } from "../canonical-index-manifest.ts";
import { requireCanonicalPathsWhenEnabled } from "../canonical-scope-guard.ts";

export interface IBatch extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  code?: string;
  name: string;
  mode: "online" | "offline";
  defaultFeeTk: number;
  studentClass?: StudentClass;
  capacity?: number;
  activeEnrollmentCount: number;
  studentIdGroup?: number;
  startsAt?: Date;
  endsAt?: Date;
  status: AcademicLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    code: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    mode: { type: String, enum: ["online", "offline"], default: "offline" },
    defaultFeeTk: { type: Number, default: 0, min: 0, max: 10_000_000 },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
    },
    capacity: { type: Number, min: 1, max: 500 },
    activeEnrollmentCount: { type: Number, default: 0, min: 0 },
    studentIdGroup: { type: Number, default: 1, min: 1, max: 999, immutable: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    status: {
      type: String,
      enum: ["planned", "active", "closed", "archived"],
      default: "planned",
    },
  },
  { timestamps: true },
);

BatchSchema.pre("validate", function () {
  if (this.startsAt && this.endsAt && !isValidDateRange(this.startsAt, this.endsAt)) {
    this.invalidate("endsAt", "Batch end date must be after its start date.");
  }
});

BatchSchema.index(BATCH_SCOPE_CODE_INDEX.keys, BATCH_SCOPE_CODE_INDEX.options);
BatchSchema.index({ organizationId: 1, branchId: 1, academicSessionId: 1, status: 1 });
BatchSchema.index({ academicSessionId: 1, studentClass: 1, status: 1 });
requireCanonicalPathsWhenEnabled(BatchSchema, ["organizationId", "branchId", "academicSessionId", "code"]);

export const Batch: Model<IBatch> =
  (mongoose.models.Batch as Model<IBatch> | undefined) ||
  mongoose.model<IBatch>("Batch", BatchSchema);
