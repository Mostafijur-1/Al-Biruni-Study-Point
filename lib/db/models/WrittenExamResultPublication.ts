import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IWrittenExamResultPublication extends Document {
  organizationId?: Types.ObjectId;
  examId: Types.ObjectId;
  assessmentVersionId?: Types.ObjectId;
  version: number;
  resultCount: number;
  resultsHash: string;
  results: Array<{ resultId: Types.ObjectId; studentId: Types.ObjectId; enrollmentId: Types.ObjectId; marks: number; comment?: string }>;
  publishedBy: Types.ObjectId;
  publishedAt: Date;
  createdAt: Date;
}

const FrozenResultSchema = new Schema({
  resultId: { type: Schema.Types.ObjectId, ref: "WrittenExamResult", required: true }, studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  enrollmentId: { type: Schema.Types.ObjectId, ref: "BatchEnrollment", required: true }, marks: { type: Number, required: true, min: 0 }, comment: { type: String, trim: true, maxlength: 500 },
}, { _id: false });
const WrittenExamResultPublicationSchema = new Schema<IWrittenExamResultPublication>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization" }, examId: { type: Schema.Types.ObjectId, ref: "WrittenExam", required: true },
  assessmentVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentVersion" }, version: { type: Number, required: true, min: 1 },
  resultCount: { type: Number, required: true, min: 1 }, resultsHash: { type: String, required: true, match: /^[a-f\d]{64}$/ },
  results: { type: [FrozenResultSchema], required: true }, publishedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, publishedAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
WrittenExamResultPublicationSchema.index({ examId: 1 }, { unique: true });
WrittenExamResultPublicationSchema.index({ organizationId: 1, publishedAt: -1 });
WrittenExamResultPublicationSchema.pre("save", function () { if (!this.isNew && this.isModified()) throw new Error("Written result publications are immutable."); });
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  WrittenExamResultPublicationSchema.pre(operation, async function () { if (await this.model.exists(this.getFilter())) throw new Error("Written result publications are immutable."); });
}

export const WrittenExamResultPublication: Model<IWrittenExamResultPublication> = (mongoose.models.WrittenExamResultPublication as Model<IWrittenExamResultPublication> | undefined) || mongoose.model<IWrittenExamResultPublication>("WrittenExamResultPublication", WrittenExamResultPublicationSchema);
