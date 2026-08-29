import mongoose, { Document, Model, Schema } from "mongoose";

export interface IStudentCodeCounter extends Document {
  prefix: string;
  sequence: number;
}

const StudentCodeCounterSchema = new Schema<IStudentCodeCounter>(
  {
    prefix: { type: String, required: true, unique: true, trim: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const StudentCodeCounter: Model<IStudentCodeCounter> =
  (mongoose.models.StudentCodeCounter as Model<IStudentCodeCounter> | undefined) ||
  mongoose.model<IStudentCodeCounter>("StudentCodeCounter", StudentCodeCounterSchema);
