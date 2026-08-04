import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { isValidDateRange } from "@/lib/academic-rules";

export interface IClassSession extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  batchId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  routineSlotId?: Types.ObjectId;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: "scheduled" | "completed" | "cancelled";
  cancellationReason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSessionSchema = new Schema<IClassSession>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    routineSlotId: { type: Schema.Types.ObjectId, ref: "RoutineSlot" },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    cancellationReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

ClassSessionSchema.pre("validate", function () {
  if (
    this.scheduledStart &&
    this.scheduledEnd &&
    !isValidDateRange(this.scheduledStart, this.scheduledEnd)
  ) {
    this.invalidate("scheduledEnd", "Class session end time must be after its start time.");
  }
});

ClassSessionSchema.index({ batchId: 1, scheduledStart: 1 });
ClassSessionSchema.index({ teacherId: 1, scheduledStart: 1 });
ClassSessionSchema.index({ branchId: 1, status: 1, scheduledStart: 1 });
ClassSessionSchema.index(
  { routineSlotId: 1, scheduledStart: 1 },
  { unique: true, sparse: true },
);

export const ClassSession: Model<IClassSession> =
  (mongoose.models.ClassSession as Model<IClassSession> | undefined) ||
  mongoose.model<IClassSession>("ClassSession", ClassSessionSchema);
