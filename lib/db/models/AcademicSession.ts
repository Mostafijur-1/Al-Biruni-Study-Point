import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { isValidDateRange, type AcademicLifecycleStatus } from "@/lib/academic-rules";

export interface IAcademicSession extends Document {
  organizationId: Types.ObjectId;
  name: string;
  startsAt: Date;
  endsAt: Date;
  status: AcademicLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicSessionSchema = new Schema<IAcademicSession>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["planned", "active", "closed", "archived"],
      default: "planned",
    },
  },
  { timestamps: true },
);

AcademicSessionSchema.pre("validate", function () {
  if (this.startsAt && this.endsAt && !isValidDateRange(this.startsAt, this.endsAt)) {
    this.invalidate("endsAt", "Academic session end date must be after its start date.");
  }
});

AcademicSessionSchema.index({ organizationId: 1, name: 1 }, { unique: true });
AcademicSessionSchema.index({ organizationId: 1, status: 1, startsAt: -1 });

export const AcademicSession: Model<IAcademicSession> =
  (mongoose.models.AcademicSession as Model<IAcademicSession> | undefined) ||
  mongoose.model<IAcademicSession>("AcademicSession", AcademicSessionSchema);
