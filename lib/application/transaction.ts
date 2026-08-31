import type { ClientSession } from "mongoose";

import { connectDB } from "@/lib/db/connect";

export async function withMongoTransaction<T>(work: (session: ClientSession) => Promise<T>) {
  const connection = await connectDB();
  const session = await connection.startSession();
  let result: T | undefined;
  let completed = false;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
      completed = true;
    });
    if (!completed) throw new Error("Transaction callback did not complete.");
    return result as T;
  } finally {
    await session.endSession();
  }
}
