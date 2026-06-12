import { NextRequest } from "next/server";
import fs from "fs/promises";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { SYLLABUS } from "@/lib/content/syllabus";
import { getChapterFilePath } from "@/lib/mcq/practice-service";
import type { CourseSubject } from "@/types";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate that user is Admin
    await requireAuth(request, ["admin"]);

    const filesList: Array<{
      level: "ssc" | "hsc";
      subject: string;
      chapter: string;
      questionCount: number;
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
              filesList.push({
                level,
                subject,
                chapter,
                questionCount: questions.length,
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
