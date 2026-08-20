import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { isValidRoutineWindow } from "../../academic-rules.ts";

export interface IRoutineSlot extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  batchId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  teacherAssignmentId: Types.ObjectId;
  studentIds: Types.ObjectId[];
  weekday: number;
  startMinute: number;
  endMinute: number;
  room?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  status: "active" | "ended";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RoutineSlotSchema = new Schema<IRoutineSlot>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacherAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "TeacherAssignment",
      required: true,
    },
    studentIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    weekday: { type: Number, required: true, min: 0, max: 6 },
    startMinute: { type: Number, required: true, min: 0, max: 1439 },
    endMinute: { type: Number, required: true, min: 1, max: 1440 },
    room: { type: String, trim: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

RoutineSlotSchema.pre("validate", function () {
  if (!isValidRoutineWindow(this.startMinute, this.endMinute)) {
    this.invalidate("endMinute", "Routine end time must be after its start time.");
  }
});

RoutineSlotSchema.index({ batchId: 1, weekday: 1, startMinute: 1, status: 1 });
RoutineSlotSchema.index({ teacherId: 1, weekday: 1, startMinute: 1, status: 1 });
RoutineSlotSchema.index({ studentIds: 1, weekday: 1, status: 1 });
RoutineSlotSchema.index({ branchId: 1, academicSessionId: 1, status: 1 });

export const RoutineSlot: Model<IRoutineSlot> =
  (mongoose.models.RoutineSlot as Model<IRoutineSlot> | undefined) ||
  mongoose.model<IRoutineSlot>("RoutineSlot", RoutineSlotSchema);
