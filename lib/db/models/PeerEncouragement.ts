import mongoose, { Document, Model, Schema, Types } from "mongoose";

import type { EncouragementKind } from "@/lib/community/rules";
import type { StudentClass } from "@/types";

export interface IPeerEncouragement extends Document {
  fromStudent: Types.ObjectId;
  toStudent: Types.ObjectId;
  studentClass: StudentClass;
  periodKey: string;
  kind: EncouragementKind;
  createdAt: Date;
  updatedAt: Date;
}

const PeerEncouragementSchema = new Schema<IPeerEncouragement>(
  {
    fromStudent: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toStudent: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentClass: {
      type: String,
      enum: ["class-9", "class-10", "class-11", "class-12"],
      required: true,
    },
    periodKey: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["high_five", "keep_going", "great_progress"],
      required: true,
    },
  },
  { timestamps: true },
);

PeerEncouragementSchema.index(
  { fromStudent: 1, toStudent: 1, periodKey: 1 },
  { unique: true },
);
PeerEncouragementSchema.index({
  toStudent: 1,
  periodKey: 1,
  createdAt: -1,
});
PeerEncouragementSchema.index({
  studentClass: 1,
  periodKey: 1,
  createdAt: -1,
});

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.PeerEncouragement
) {
  mongoose.deleteModel("PeerEncouragement");
}

export const PeerEncouragement: Model<IPeerEncouragement> =
  mongoose.models.PeerEncouragement ||
  mongoose.model<IPeerEncouragement>(
    "PeerEncouragement",
    PeerEncouragementSchema,
  );
