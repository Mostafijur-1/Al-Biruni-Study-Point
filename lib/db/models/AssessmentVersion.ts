import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { assessmentContentHash } from "../../assessment-kernel.ts";

export interface IAssessmentVersion extends Document {
  assessmentId: Types.ObjectId;
  version: number;
  title: string;
  instructions?: string;
  durationSeconds?: number;
  passRule: { mode: "points" | "percent" | "manual"; threshold?: number };
  scoringRules: { unansweredMarks: number; incorrectMarks: number; rounding: "none" | "integer" | "two-decimal" };
  status: "draft" | "published";
  questionCount: number;
  totalMarks: number;
  questionSetHash: string;
  contentHash: string;
  createdBy: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PassRuleSchema = new Schema({ mode: { type: String, enum: ["points", "percent", "manual"], required: true }, threshold: { type: Number, min: 0, max: 100_000 } }, { _id: false });
const ScoringRulesSchema = new Schema({ unansweredMarks: { type: Number, default: 0 }, incorrectMarks: { type: Number, default: 0 }, rounding: { type: String, enum: ["none", "integer", "two-decimal"], default: "two-decimal" } }, { _id: false });
const AssessmentVersionSchema = new Schema<IAssessmentVersion>({
  assessmentId: { type: Schema.Types.ObjectId, ref: "Assessment", required: true }, version: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true, maxlength: 300 }, instructions: { type: String, trim: true, maxlength: 5_000 }, durationSeconds: { type: Number, min: 1, max: 86_400 },
  passRule: { type: PassRuleSchema, required: true }, scoringRules: { type: ScoringRulesSchema, required: true },
  status: { type: String, enum: ["draft", "published"], default: "draft" }, questionCount: { type: Number, default: 0, min: 0 }, totalMarks: { type: Number, default: 0, min: 0 },
  questionSetHash: { type: String, required: true, default: "pending" },
  contentHash: { type: String, required: true }, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  publishedBy: { type: Schema.Types.ObjectId, ref: "User" }, publishedAt: Date,
}, { timestamps: true });

AssessmentVersionSchema.pre("validate", function () {
  this.contentHash = assessmentContentHash({
    title: this.title, instructions: this.instructions, durationSeconds: this.durationSeconds,
    passRule: { mode: this.passRule.mode, threshold: this.passRule.threshold },
    scoringRules: { unansweredMarks: this.scoringRules.unansweredMarks, incorrectMarks: this.scoringRules.incorrectMarks, rounding: this.scoringRules.rounding },
    questionCount: this.questionCount, totalMarks: this.totalMarks, questionSetHash: this.questionSetHash,
  });
  if (this.passRule.mode !== "manual" && this.passRule.threshold === undefined) this.invalidate("passRule.threshold", "A pass threshold is required.");
  if (this.passRule.mode === "percent" && (this.passRule.threshold ?? 0) > 100) this.invalidate("passRule.threshold", "Percent thresholds cannot exceed 100.");
  if (this.status === "published" && (!this.publishedBy || !this.publishedAt)) this.invalidate("status", "Published assessment versions require publication metadata.");
});
AssessmentVersionSchema.pre("save", async function () {
  if (this.isNew) return;
  const stored = await this.collection.findOne({ _id: this._id }, { projection: { status: 1 } });
  if (stored?.status === "published" && this.isModified()) throw new Error("Published assessment versions are immutable.");
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  AssessmentVersionSchema.pre(operation, function () { this.where({ status: { $ne: "published" } }); });
}
AssessmentVersionSchema.index({ assessmentId: 1, version: 1 }, { unique: true });
AssessmentVersionSchema.index({ assessmentId: 1, status: 1, publishedAt: -1 });
AssessmentVersionSchema.index({ contentHash: 1 });

export const AssessmentVersion: Model<IAssessmentVersion> = (mongoose.models.AssessmentVersion as Model<IAssessmentVersion> | undefined) || mongoose.model<IAssessmentVersion>("AssessmentVersion", AssessmentVersionSchema);
