import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IQuestion extends Document {
  organizationId: Types.ObjectId;
  subjectId: Types.ObjectId;
  chapterId?: Types.ObjectId;
  topicId?: Types.ObjectId;
  kind: "single-choice" | "multiple-choice" | "written";
  language: "bn" | "en" | "mixed";
  status: "draft" | "in-review" | "approved" | "archived";
  ownerId: Types.ObjectId;
  ownerRole: "admin" | "teacher";
  currentDraftVersion?: Types.ObjectId;
  latestPublishedVersion?: Types.ObjectId;
  provenance: { sourceType: "manual" | "import" | "legacy" | "generated"; sourceId?: string; importBatchId?: string; note?: string };
  legacySource?: { collection: string; id: string };
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
  chapterId: { type: Schema.Types.ObjectId, ref: "AcademicChapter" },
  topicId: { type: Schema.Types.ObjectId, ref: "AcademicTopic" },
  kind: { type: String, enum: ["single-choice", "multiple-choice", "written"], required: true },
  language: { type: String, enum: ["bn", "en", "mixed"], required: true },
  status: { type: String, enum: ["draft", "in-review", "approved", "archived"], default: "draft" },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  ownerRole: { type: String, enum: ["admin", "teacher"], required: true },
  currentDraftVersion: { type: Schema.Types.ObjectId, ref: "QuestionVersion" },
  latestPublishedVersion: { type: Schema.Types.ObjectId, ref: "QuestionVersion" },
  provenance: {
    sourceType: { type: String, enum: ["manual", "import", "legacy", "generated"], required: true },
    sourceId: { type: String, trim: true, maxlength: 200 },
    importBatchId: { type: String, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 500 },
  },
  legacySource: { collection: { type: String, trim: true }, id: { type: String, trim: true } },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" }, reviewedAt: Date,
  reviewNote: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

QuestionSchema.index({ organizationId: 1, subjectId: 1, chapterId: 1, topicId: 1, status: 1 });
QuestionSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
QuestionSchema.index({ "legacySource.collection": 1, "legacySource.id": 1 }, { unique: true, partialFilterExpression: { "legacySource.collection": { $type: "string" }, "legacySource.id": { $type: "string" } } });

export const Question: Model<IQuestion> = (mongoose.models.Question as Model<IQuestion> | undefined) || mongoose.model<IQuestion>("Question", QuestionSchema);
