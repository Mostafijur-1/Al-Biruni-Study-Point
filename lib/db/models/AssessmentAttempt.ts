import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAssessmentAttemptResponse {
  questionId: Types.ObjectId;
  questionVersionId: Types.ObjectId;
  selectedOptionKeys: string[];
  textResponse?: string;
  awardedMarks: number;
  isCorrect?: boolean;
}

export interface IAssessmentAttempt extends Document {
  organizationId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  assessmentVersionId: Types.ObjectId;
  studentId: Types.ObjectId;
  attemptNo: number;
  status: "submitted" | "voided";
  assessmentSnapshot: {
    title: string;
    kind: "practice" | "mcq-exam" | "written-exam";
    durationSeconds?: number;
    passRule: { mode: "points" | "percent" | "manual"; threshold?: number };
    scoringRules: { unansweredMarks: number; incorrectMarks: number; rounding: "none" | "integer" | "two-decimal" };
    contentHash: string;
  };
  questionSnapshots: Array<{
    questionId: Types.ObjectId;
    questionVersionId: Types.ObjectId;
    contentHash: string;
    prompt: string;
    options: Array<{ key: string; text: string }>;
    correctResponse: { mode: "single-option" | "multiple-option" | "text" | "manual"; optionKeys: string[]; acceptedTexts: string[] };
    explanation?: string;
    marks: number;
  }>;
  responses: IAssessmentAttemptResponse[];
  score: number;
  totalMarks: number;
  percentage?: number;
  passed?: boolean;
  startedAt?: Date;
  submittedAt: Date;
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  voidReason?: string;
  legacySource?: { collection: string; id: string };
  createdAt: Date;
  updatedAt: Date;
}

const OptionSnapshotSchema = new Schema({ key: { type: String, required: true }, text: { type: String, required: true } }, { _id: false });
const CorrectResponseSnapshotSchema = new Schema({ mode: { type: String, enum: ["single-option", "multiple-option", "text", "manual"], required: true }, optionKeys: { type: [String], default: [] }, acceptedTexts: { type: [String], default: [] } }, { _id: false });
const PassRuleSnapshotSchema = new Schema({ mode: { type: String, enum: ["points", "percent", "manual"], required: true }, threshold: Number }, { _id: false });
const ScoringSnapshotSchema = new Schema({ unansweredMarks: { type: Number, required: true }, incorrectMarks: { type: Number, required: true }, rounding: { type: String, enum: ["none", "integer", "two-decimal"], required: true } }, { _id: false });
const AssessmentSnapshotSchema = new Schema({
  title: { type: String, required: true }, kind: { type: String, enum: ["practice", "mcq-exam", "written-exam"], required: true }, durationSeconds: Number,
  passRule: { type: PassRuleSnapshotSchema, required: true }, scoringRules: { type: ScoringSnapshotSchema, required: true }, contentHash: { type: String, required: true },
}, { _id: false });
const QuestionSnapshotSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true }, questionVersionId: { type: Schema.Types.ObjectId, ref: "QuestionVersion", required: true }, contentHash: { type: String, required: true },
  prompt: { type: String, required: true }, options: { type: [OptionSnapshotSchema], default: [] }, correctResponse: { type: CorrectResponseSnapshotSchema, required: true },
  explanation: String, marks: { type: Number, required: true, min: 0.01 },
}, { _id: false });
const AttemptResponseSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true }, questionVersionId: { type: Schema.Types.ObjectId, ref: "QuestionVersion", required: true },
  selectedOptionKeys: { type: [String], default: [] }, textResponse: String, awardedMarks: { type: Number, required: true }, isCorrect: Boolean,
}, { _id: false });

const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true }, assessmentId: { type: Schema.Types.ObjectId, ref: "Assessment", required: true },
  assessmentVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentVersion", required: true }, studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  attemptNo: { type: Number, required: true, min: 1 }, status: { type: String, enum: ["submitted", "voided"], default: "submitted" },
  assessmentSnapshot: { type: AssessmentSnapshotSchema, required: true }, questionSnapshots: { type: [QuestionSnapshotSchema], required: true }, responses: { type: [AttemptResponseSchema], required: true },
  score: { type: Number, required: true }, totalMarks: { type: Number, required: true, min: 0 }, percentage: { type: Number, min: 0, max: 100 }, passed: Boolean,
  startedAt: Date, submittedAt: { type: Date, required: true, default: Date.now }, voidedAt: Date, voidedBy: { type: Schema.Types.ObjectId, ref: "User" }, voidReason: { type: String, trim: true, maxlength: 500 },
  legacySource: { collection: { type: String, trim: true }, id: { type: String, trim: true } },
}, { timestamps: true });

AssessmentAttemptSchema.pre("validate", function () {
  const questionVersionIds = this.questionSnapshots.map((row) => String(row.questionVersionId));
  const responseIds = this.responses.map((row) => String(row.questionVersionId));
  if (new Set(questionVersionIds).size !== questionVersionIds.length) this.invalidate("questionSnapshots", "Question snapshots must be unique.");
  if (new Set(responseIds).size !== responseIds.length) this.invalidate("responses", "Responses must be unique per question version.");
  if (responseIds.some((id) => !questionVersionIds.includes(id))) this.invalidate("responses", "Responses must belong to the assessment snapshot.");
});
AssessmentAttemptSchema.index({ studentId: 1, assessmentVersionId: 1, attemptNo: 1 }, { unique: true });
AssessmentAttemptSchema.index({ organizationId: 1, assessmentId: 1, submittedAt: -1 });
AssessmentAttemptSchema.index({ "legacySource.collection": 1, "legacySource.id": 1 }, { unique: true, partialFilterExpression: { "legacySource.collection": { $type: "string" }, "legacySource.id": { $type: "string" } } });

export const AssessmentAttempt: Model<IAssessmentAttempt> = (mongoose.models.AssessmentAttempt as Model<IAssessmentAttempt> | undefined) || mongoose.model<IAssessmentAttempt>("AssessmentAttempt", AssessmentAttemptSchema);
