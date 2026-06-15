import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPushSubscription extends Document {
  userId?: Types.ObjectId;
  deviceId: string;
  isInstalledApp: boolean;
  subscription: {
    endpoint: string;
    expirationTime: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    deviceId: { type: String, required: true },
    isInstalledApp: { type: Boolean, default: false },
    subscription: {
      endpoint: { type: String, required: true },
      expirationTime: { type: Number, default: null },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
    },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ deviceId: 1 });
PushSubscriptionSchema.index({ userId: 1 });
PushSubscriptionSchema.index({ isInstalledApp: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.PushSubscription) {
  mongoose.deleteModel("PushSubscription");
}

export const PushSubscription: Model<IPushSubscription> =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
