import { NextRequest } from "next/server";

import { connectDB } from "@/lib/db/connect";
import { SyncedChapter } from "@/lib/db/models/SyncedChapter";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate that user is Admin
    await requireAuth(request, ["admin"]);
    await connectDB();

    const { level, subject, chapter, mark } = await request.json();

    if (!level || !subject || !chapter || typeof mark !== "boolean") {
      return fail("Level, Subject, Chapter, and Mark (boolean) are required.", 400);
    }

    if (mark) {
      // Mark as synced (upsert)
      await SyncedChapter.findOneAndUpdate(
        { level, subject, chapter },
        { level, subject, chapter },
        { upsert: true, new: true }
      );
    } else {
      // Unmark (delete)
      await SyncedChapter.deleteOne({ level, subject, chapter });
    }

    return success({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
