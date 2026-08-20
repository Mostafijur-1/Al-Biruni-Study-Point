import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICoachingEnrollmentSubject extends Document {
  organizationId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  batchId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  subjectId: Types.ObjectId;
  status: "active" | "dropped";
  effectiveFrom: Date;
  effectiveTo?: Date;
  endReason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CoachingEnrollmentSubjectSchema = new Schema<ICoachingEnrollmentSubject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "BatchEnrollment", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "AcademicSubject", required: true },
    status: { type: String, enum: ["active", "dropped"], default: "active" },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date },
    endReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

CoachingEnrollmentSubjectSchema.index(
  { enrollmentId: 1, subjectId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
CoachingEnrollmentSubjectSchema.index({ batchId: 1, subjectId: 1, status: 1, studentId: 1 });
CoachingEnrollmentSubjectSchema.index({ enrollmentId: 1, status: 1, effectiveFrom: 1 });
CoachingEnrollmentSubjectSchema.index({ studentId: 1, status: 1, subjectId: 1 });

export const CoachingEnrollmentSubject: Model<ICoachingEnrollmentSubject> =
  (mongoose.models.CoachingEnrollmentSubject as Model<ICoachingEnrollmentSubject> | undefined) ||
  mongoose.model<ICoachingEnrollmentSubject>(
    "CoachingEnrollmentSubject",
    CoachingEnrollmentSubjectSchema,
  );
