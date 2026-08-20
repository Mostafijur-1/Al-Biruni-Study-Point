import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICoachingBatchSubject extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  batchId: Types.ObjectId;
  subjectId: Types.ObjectId;
  monthlyFeeTk: number;
  status: "active" | "archived";
  sortOrder: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CoachingBatchSubjectSchema = new Schema<ICoachingBatchSubject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    monthlyFeeTk: { type: Number, required: true, min: 0, max: 10_000_000 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    sortOrder: { type: Number, default: 0, min: 0, max: 10_000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

CoachingBatchSubjectSchema.index({ batchId: 1, subjectId: 1 }, { unique: true });
CoachingBatchSubjectSchema.index({ batchId: 1, status: 1, sortOrder: 1 });
CoachingBatchSubjectSchema.index({ organizationId: 1, branchId: 1, status: 1 });

export const CoachingBatchSubject: Model<ICoachingBatchSubject> =
  (mongoose.models.CoachingBatchSubject as Model<ICoachingBatchSubject> | undefined) ||
  mongoose.model<ICoachingBatchSubject>("CoachingBatchSubject", CoachingBatchSubjectSchema);
