import mongoose from "mongoose";
import { getRequiredEnv } from "@/lib/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const globalCache = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis.mongooseCache = globalCache;

export async function connectDB() {
  if (globalCache.conn) {
    return globalCache.conn;
  }

  const uri = getRequiredEnv("MONGODB_URI");

  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      dbName: "absp",
    });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
