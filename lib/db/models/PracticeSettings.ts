import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPracticeSettings extends Document {
  maxQuestionsPerTest: number;
  secondsPerQuestion: number;
  passMarkPercent: number;
}

const PracticeSettingsSchema = new Schema<IPracticeSettings>(
  {
    maxQuestionsPerTest: { type: Number, default: 25, min: 1, max: 100 },
    secondsPerQuestion: { type: Number, default: 45, min: 10, max: 300 },
    passMarkPercent: { type: Number, default: 60, min: 1, max: 100 },
  },
  { timestamps: true }
);

export const PracticeSettings: Model<IPracticeSettings> =
  mongoose.models.PracticeSettings ||
  mongoose.model<IPracticeSettings>("PracticeSettings", PracticeSettingsSchema);

/** Fetch the singleton settings document, creating defaults if it doesn't exist. */
export async function getPracticeSettings(): Promise<IPracticeSettings> {
  let settings = await PracticeSettings.findOne().lean<IPracticeSettings>();
  if (!settings) {
    settings = await PracticeSettings.create({
      maxQuestionsPerTest: 25,
      secondsPerQuestion: 45,
      passMarkPercent: 60,
    });
  }
  return settings;
}
