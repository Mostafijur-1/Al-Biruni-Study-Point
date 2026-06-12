import { NextRequest } from "next/server";
import fs from "fs/promises";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { SYLLABUS } from "@/lib/content/syllabus";
import { getChapterFilePath } from "@/lib/mcq/practice-service";
import { connectDB } from "@/lib/db/connect";
import { SyncedChapter } from "@/lib/db/models/SyncedChapter";
import type { CourseSubject } from "@/types";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate that user is Admin
    await requireAuth(request, ["admin"]);
    await connectDB();

    // Fetch all synced chapters from DB
    const syncedList = await SyncedChapter.find({}).lean();
    const syncedSet = new Set(
      syncedList.map((sc) => `${sc.level}_${sc.subject}_${sc.chapter}`)
    );

    const filesList: Array<{
      level: "ssc" | "hsc";
      subject: string;
      chapter: string;
      questionCount: number;
      isSynced: boolean;
    }> = [];

    const levels: Array<"ssc" | "hsc"> = ["ssc", "hsc"];

    for (const level of levels) {
      const subjects = Object.keys(SYLLABUS[level]) as CourseSubject[];
      for (const subject of subjects) {
        const chapters = SYLLABUS[level][subject] || [];
        for (const chapter of chapters) {
          const filePath = getChapterFilePath(level, subject, chapter);
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const questions = JSON.parse(content);
            if (Array.isArray(questions) && questions.length > 0) {
              const key = `${level}_${subject}_${chapter}`;
              filesList.push({
                level,
                subject,
                chapter,
                questionCount: questions.length,
                isSynced: syncedSet.has(key),
              });
            }
          } catch {
            // File does not exist or is empty/invalid JSON, skip it
          }
        }
      }
    }

    return success(filesList);
  } catch (error) {
    return handleApiError(error);
  }
}
