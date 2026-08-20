import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { isValidDateRange, type AcademicLifecycleStatus } from "../../academic-rules.ts";
import type { StudentClass } from "@/types";

export interface IBatch extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  code?: string;
  name: string;
  studentClass?: StudentClass;
  capacity?: number;
  activeEnrollmentCount: number;
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
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
    },
    capacity: { type: Number, min: 1, max: 500 },
    activeEnrollmentCount: { type: Number, default: 0, min: 0 },
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

BatchSchema.index({ branchId: 1, academicSessionId: 1, code: 1 }, { unique: true });
BatchSchema.index({ organizationId: 1, branchId: 1, academicSessionId: 1, status: 1 });
BatchSchema.index({ academicSessionId: 1, studentClass: 1, status: 1 });

export const Batch: Model<IBatch> =
  (mongoose.models.Batch as Model<IBatch> | undefined) ||
  mongoose.model<IBatch>("Batch", BatchSchema);
