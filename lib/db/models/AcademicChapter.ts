import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAcademicChapter extends Document {
  organizationId: Types.ObjectId;
  subjectId: Types.ObjectId;
  code: string;
  name: string;
  nameBn: string;
  order: number;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const AcademicChapterSchema = new Schema<IAcademicChapter>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    nameBn: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

AcademicChapterSchema.index({ subjectId: 1, code: 1 }, { unique: true });
AcademicChapterSchema.index({ organizationId: 1, subjectId: 1, status: 1, order: 1 });

export const AcademicChapter: Model<IAcademicChapter> =
  (mongoose.models.AcademicChapter as Model<IAcademicChapter> | undefined) ||
  mongoose.model<IAcademicChapter>("AcademicChapter", AcademicChapterSchema);
