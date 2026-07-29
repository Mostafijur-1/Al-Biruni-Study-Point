import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const STUDENT_EVENT_NAMES = [
  "student_dashboard_viewed",
  "student_dashboard_action_clicked",
  "student_learning_task_clicked",
  "student_mistakes_viewed",
  "student_mistake_answered",
  "student_learning_plan_viewed",
  "student_video_progress_updated",
] as const;

export type StudentEventName = (typeof STUDENT_EVENT_NAMES)[number];

export interface IProductEvent extends Document {
  user: Types.ObjectId;
  name: StudentEventName;
  surface: string;
  properties: Record<string, string | number | boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const ProductEventSchema = new Schema<IProductEvent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      enum: STUDENT_EVENT_NAMES,
      required: true,
      index: true,
    },
    surface: { type: String, required: true, trim: true, maxlength: 60 },
    properties: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ProductEventSchema.index({ user: 1, createdAt: -1 });
ProductEventSchema.index({ name: 1, createdAt: -1 });
ProductEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 180 },
);

if (process.env.NODE_ENV !== "production" && mongoose.models.ProductEvent) {
  mongoose.deleteModel("ProductEvent");
}

export const ProductEvent: Model<IProductEvent> =
  mongoose.models.ProductEvent ||
  mongoose.model<IProductEvent>("ProductEvent", ProductEventSchema);
