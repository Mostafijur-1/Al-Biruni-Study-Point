import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { AssessmentVersion } from "./AssessmentVersion.ts";

export interface IAssessmentQuestion extends Document {
  assessmentVersionId: Types.ObjectId;
  questionVersionId: Types.ObjectId;
  order: number;
  marks: number;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentQuestionSchema = new Schema<IAssessmentQuestion>({
  assessmentVersionId: {
    type: Schema.Types.ObjectId, ref: "AssessmentVersion", required: true,
    validate: {
      validator: async (id: Types.ObjectId) => (await AssessmentVersion.exists({ _id: id, status: { $ne: "published" } })) !== null,
      message: "Published assessment question sets are immutable.",
    },
  },
  questionVersionId: { type: Schema.Types.ObjectId, ref: "QuestionVersion", required: true },
  order: { type: Number, required: true, min: 0 }, marks: { type: Number, required: true, min: 0.01, max: 10_000 }, required: { type: Boolean, default: true },
}, { timestamps: true });

AssessmentQuestionSchema.index({ assessmentVersionId: 1, order: 1 }, { unique: true });
AssessmentQuestionSchema.index({ assessmentVersionId: 1, questionVersionId: 1 }, { unique: true });
AssessmentQuestionSchema.index({ questionVersionId: 1 });

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  AssessmentQuestionSchema.pre(operation, async function () {
    const matchingLinks = await this.model.find(this.getFilter()).select("assessmentVersionId").lean();
    const versionIds = matchingLinks.map((link) => link.assessmentVersionId);
    if (versionIds.length && await AssessmentVersion.exists({ _id: { $in: versionIds }, status: "published" })) {
      throw new Error("Published assessment question sets are immutable.");
    }
  });
}

export const AssessmentQuestion: Model<IAssessmentQuestion> = (mongoose.models.AssessmentQuestion as Model<IAssessmentQuestion> | undefined) || mongoose.model<IAssessmentQuestion>("AssessmentQuestion", AssessmentQuestionSchema);
