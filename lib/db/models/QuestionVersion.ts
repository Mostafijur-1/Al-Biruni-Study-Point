import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { assessmentContentHash } from "../../assessment-kernel.ts";

export interface IQuestionVersion extends Document {
  questionId: Types.ObjectId;
  version: number;
  prompt: string;
  options: Array<{ key: string; text: string }>;
  correctResponse: { mode: "single-option" | "multiple-option" | "text" | "manual"; optionKeys: string[]; acceptedTexts: string[] };
  explanation?: string;
  sourceReference?: { provider: "google-drive"; url: string };
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  language: "bn" | "en" | "mixed";
  status: "draft" | "published";
  contentHash: string;
  createdBy: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema({ key: { type: String, required: true, trim: true, maxlength: 40 }, text: { type: String, required: true, trim: true, maxlength: 2_000 } }, { _id: false });
const CorrectResponseSchema = new Schema({
  mode: { type: String, enum: ["single-option", "multiple-option", "text", "manual"], required: true },
  optionKeys: { type: [String], default: [] }, acceptedTexts: { type: [String], default: [] },
}, { _id: false });

const QuestionVersionSchema = new Schema<IQuestionVersion>({
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true }, version: { type: Number, required: true, min: 1 },
  prompt: { type: String, required: true, trim: true, maxlength: 10_000 }, options: { type: [OptionSchema], default: [] },
  correctResponse: { type: CorrectResponseSchema, required: true }, explanation: { type: String, trim: true, maxlength: 10_000 },
  sourceReference: { provider: { type: String, enum: ["google-drive"] }, url: { type: String, trim: true, maxlength: 2_000 } },
  marks: { type: Number, required: true, min: 0.01, max: 10_000 }, difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  language: { type: String, enum: ["bn", "en", "mixed"], required: true }, status: { type: String, enum: ["draft", "published"], default: "draft" },
  contentHash: { type: String, required: true }, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  publishedBy: { type: Schema.Types.ObjectId, ref: "User" }, publishedAt: Date,
}, { timestamps: true });

QuestionVersionSchema.pre("validate", function () {
  if (this.sourceReference) {
    try {
      const host = new URL(this.sourceReference.url).hostname.toLowerCase();
      if ((host !== "drive.google.com" && host !== "docs.google.com") || this.sourceReference.provider !== "google-drive") this.invalidate("sourceReference", "Question source must use Google Drive.");
    } catch {
      this.invalidate("sourceReference.url", "Question source must be a valid Google Drive URL.");
    }
  }
  this.contentHash = assessmentContentHash({
    prompt: this.prompt,
    options: this.options.map((option) => ({ key: option.key, text: option.text })),
    correctResponse: { mode: this.correctResponse.mode, optionKeys: [...this.correctResponse.optionKeys], acceptedTexts: [...this.correctResponse.acceptedTexts] },
    explanation: this.explanation, sourceReference: this.sourceReference ? { provider: this.sourceReference.provider, url: this.sourceReference.url } : undefined,
    marks: this.marks, difficulty: this.difficulty, language: this.language,
  });
  const keys = this.options.map((option) => option.key);
  if (new Set(keys).size !== keys.length) this.invalidate("options", "Option keys must be unique.");
  if (this.correctResponse.mode.endsWith("option") && this.correctResponse.optionKeys.some((key) => !keys.includes(key))) {
    this.invalidate("correctResponse.optionKeys", "Correct option keys must exist in options.");
  }
  if (this.correctResponse.mode === "single-option" && this.correctResponse.optionKeys.length !== 1) {
    this.invalidate("correctResponse.optionKeys", "Single-option questions require exactly one correct option.");
  }
  if (this.correctResponse.mode === "multiple-option" && this.correctResponse.optionKeys.length < 1) {
    this.invalidate("correctResponse.optionKeys", "Multiple-option questions require at least one correct option.");
  }
  if (this.status === "published" && (!this.publishedBy || !this.publishedAt)) {
    this.invalidate("status", "Published question versions require publication metadata.");
  }
});
QuestionVersionSchema.pre("save", async function () {
  if (this.isNew) return;
  const stored = await this.collection.findOne({ _id: this._id }, { projection: { status: 1 } });
  if (stored?.status === "published" && this.isModified()) throw new Error("Published question versions are immutable.");
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  QuestionVersionSchema.pre(operation, function () { this.where({ status: { $ne: "published" } }); });
}
QuestionVersionSchema.index({ questionId: 1, version: 1 }, { unique: true });
QuestionVersionSchema.index({ questionId: 1, status: 1, publishedAt: -1 });
QuestionVersionSchema.index({ contentHash: 1 });

export const QuestionVersion: Model<IQuestionVersion> = (mongoose.models.QuestionVersion as Model<IQuestionVersion> | undefined) || mongoose.model<IQuestionVersion>("QuestionVersion", QuestionVersionSchema);
