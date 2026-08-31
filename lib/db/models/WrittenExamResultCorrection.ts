import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { assessmentContentHash } from "../../assessment-kernel.ts";

export interface IWrittenExamResultCorrection extends Document {
  organizationId?: Types.ObjectId; examId: Types.ObjectId; publicationId: Types.ObjectId; resultId: Types.ObjectId; studentId: Types.ObjectId;
  sequence: number; before: { marks: number; comment?: string }; after: { marks: number; comment?: string };
  reason: string; correctedBy: Types.ObjectId; correctedAt: Date; contentHash: string; createdAt: Date;
}
const ResultStateSchema = new Schema({ marks: { type: Number, required: true, min: 0 }, comment: { type: String, trim: true, maxlength: 500 } }, { _id: false });
const WrittenExamResultCorrectionSchema = new Schema<IWrittenExamResultCorrection>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization" }, examId: { type: Schema.Types.ObjectId, ref: "WrittenExam", required: true },
  publicationId: { type: Schema.Types.ObjectId, ref: "WrittenExamResultPublication", required: true }, resultId: { type: Schema.Types.ObjectId, ref: "WrittenExamResult", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "User", required: true }, sequence: { type: Number, required: true, min: 1 },
  before: { type: ResultStateSchema, required: true }, after: { type: ResultStateSchema, required: true }, reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  correctedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, correctedAt: { type: Date, required: true, default: Date.now }, contentHash: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
WrittenExamResultCorrectionSchema.pre("validate", function () { this.contentHash = assessmentContentHash({ resultId: String(this.resultId), sequence: this.sequence, before: { marks: this.before.marks, comment: this.before.comment }, after: { marks: this.after.marks, comment: this.after.comment }, reason: this.reason, correctedBy: String(this.correctedBy), correctedAt: this.correctedAt }); });
WrittenExamResultCorrectionSchema.index({ resultId: 1, sequence: 1 }, { unique: true });
WrittenExamResultCorrectionSchema.index({ examId: 1, correctedAt: -1 });
WrittenExamResultCorrectionSchema.pre("save", function () { if (!this.isNew && this.isModified()) throw new Error("Written result corrections are append-only."); });
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  WrittenExamResultCorrectionSchema.pre(operation, async function () { if (await this.model.exists(this.getFilter())) throw new Error("Written result corrections are append-only."); });
}

export const WrittenExamResultCorrection: Model<IWrittenExamResultCorrection> = (mongoose.models.WrittenExamResultCorrection as Model<IWrittenExamResultCorrection> | undefined) || mongoose.model<IWrittenExamResultCorrection>("WrittenExamResultCorrection", WrittenExamResultCorrectionSchema);
