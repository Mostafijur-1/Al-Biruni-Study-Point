import mongoose from "mongoose";
import { getIntegerEnv, getRequiredEnv } from "@/lib/env";

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
    globalCache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        dbName: "absp",
        minPoolSize: 0,
        maxPoolSize: getIntegerEnv("MONGODB_MAX_POOL_SIZE", 10, {
          min: 1,
          max: 100,
        }),
        maxIdleTimeMS: getIntegerEnv("MONGODB_MAX_IDLE_TIME_MS", 30_000, {
          min: 1_000,
          max: 300_000,
        }),
        serverSelectionTimeoutMS: getIntegerEnv(
          "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
          5_000,
          { min: 1_000, max: 60_000 },
        ),
        waitQueueTimeoutMS: getIntegerEnv(
          "MONGODB_WAIT_QUEUE_TIMEOUT_MS",
          10_000,
          { min: 1_000, max: 60_000 },
        ),
      })
      .catch((error: unknown) => {
        // Let a warm serverless instance retry after a transient cold-start failure.
        globalCache.promise = null;
        throw error;
      });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
