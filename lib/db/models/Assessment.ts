import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAssessment extends Document {
  organizationId: Types.ObjectId;
  branchId?: Types.ObjectId;
  academicSessionId?: Types.ObjectId;
  subjectId: Types.ObjectId;
  batchIds: Types.ObjectId[];
  kind: "practice" | "mcq-exam" | "written-exam";
  status: "draft" | "published" | "archived";
  ownerId: Types.ObjectId;
  ownerRole: "admin" | "teacher";
  currentDraftVersion?: Types.ObjectId;
  latestPublishedVersion?: Types.ObjectId;
  legacySource?: { collection: string; id: string };
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch" }, academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
  subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true }, batchIds: [{ type: Schema.Types.ObjectId, ref: "Batch" }],
  kind: { type: String, enum: ["practice", "mcq-exam", "written-exam"], required: true }, status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true }, ownerRole: { type: String, enum: ["admin", "teacher"], required: true },
  currentDraftVersion: { type: Schema.Types.ObjectId, ref: "AssessmentVersion" }, latestPublishedVersion: { type: Schema.Types.ObjectId, ref: "AssessmentVersion" },
  legacySource: { collection: { type: String, trim: true }, id: { type: String, trim: true } },
}, { timestamps: true });

AssessmentSchema.index({ organizationId: 1, subjectId: 1, kind: 1, status: 1, updatedAt: -1 });
AssessmentSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
AssessmentSchema.index({ "legacySource.collection": 1, "legacySource.id": 1 }, { unique: true, partialFilterExpression: { "legacySource.collection": { $type: "string" }, "legacySource.id": { $type: "string" } } });

export const Assessment: Model<IAssessment> = (mongoose.models.Assessment as Model<IAssessment> | undefined) || mongoose.model<IAssessment>("Assessment", AssessmentSchema);
