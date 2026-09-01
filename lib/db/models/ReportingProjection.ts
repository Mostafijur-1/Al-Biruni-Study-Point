import mongoose, { type Document, type Model, Schema, Types } from "mongoose";

export type ReportingProjectionType = "student-today" | "teacher-today" | "attendance-daily" | "assessment-trend" | "finance-monthly";
export interface IReportingProjection extends Document {
  organizationId: Types.ObjectId; branchId: Types.ObjectId; projectionType: ReportingProjectionType; subjectKey: string; periodKey: string;
  schemaVersion: number; sourceHash: string; metrics: Record<string, unknown>; rebuiltAt: Date; createdAt: Date; updatedAt: Date;
}
const ReportingProjectionSchema = new Schema<IReportingProjection>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true }, branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  projectionType: { type: String, enum: ["student-today", "teacher-today", "attendance-daily", "assessment-trend", "finance-monthly"], required: true },
  subjectKey: { type: String, required: true, trim: true, maxlength: 80 }, periodKey: { type: String, required: true, trim: true, maxlength: 20 },
  schemaVersion: { type: Number, required: true, min: 1 }, sourceHash: { type: String, required: true, match: /^[a-f\d]{64}$/ }, metrics: { type: Schema.Types.Mixed, required: true }, rebuiltAt: { type: Date, required: true },
}, { timestamps: true });
ReportingProjectionSchema.index({ organizationId: 1, branchId: 1, projectionType: 1, subjectKey: 1, periodKey: 1 }, { unique: true });
ReportingProjectionSchema.index({ organizationId: 1, branchId: 1, projectionType: 1, periodKey: -1, _id: -1 });
ReportingProjectionSchema.index({ rebuiltAt: 1 });
export const ReportingProjection: Model<IReportingProjection> = (mongoose.models.ReportingProjection as Model<IReportingProjection> | undefined) || mongoose.model<IReportingProjection>("ReportingProjection", ReportingProjectionSchema);
