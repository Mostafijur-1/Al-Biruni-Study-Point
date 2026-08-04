import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAcademicTopic extends Document {
  organizationId: Types.ObjectId;
  subjectId: Types.ObjectId;
  chapterId: Types.ObjectId;
  code: string;
  name: string;
  nameBn: string;
  order: number;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const AcademicTopicSchema = new Schema<IAcademicTopic>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    chapterId: { type: Schema.Types.ObjectId, ref: "AcademicChapter", required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    nameBn: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

AcademicTopicSchema.index({ chapterId: 1, code: 1 }, { unique: true });
AcademicTopicSchema.index({ organizationId: 1, chapterId: 1, status: 1, order: 1 });

export const AcademicTopic: Model<IAcademicTopic> =
  (mongoose.models.AcademicTopic as Model<IAcademicTopic> | undefined) ||
  mongoose.model<IAcademicTopic>("AcademicTopic", AcademicTopicSchema);
