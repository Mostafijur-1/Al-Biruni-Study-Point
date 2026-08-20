import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IRoutineReminder extends Document {
  routineSlotId: Types.ObjectId;
  userId: Types.ObjectId;
  occurrenceDate: string;
  kind: "previous-night" | "two-hours-before";
  sentAt: Date;
}

const RoutineReminderSchema = new Schema<IRoutineReminder>(
  {
    routineSlotId: { type: Schema.Types.ObjectId, ref: "RoutineSlot", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    occurrenceDate: { type: String, required: true },
    kind: { type: String, enum: ["previous-night", "two-hours-before"], required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

RoutineReminderSchema.index(
  { routineSlotId: 1, userId: 1, occurrenceDate: 1, kind: 1 },
  { unique: true },
);
RoutineReminderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 120 });

export const RoutineReminder: Model<IRoutineReminder> =
  (mongoose.models.RoutineReminder as Model<IRoutineReminder> | undefined) ||
  mongoose.model<IRoutineReminder>("RoutineReminder", RoutineReminderSchema);
