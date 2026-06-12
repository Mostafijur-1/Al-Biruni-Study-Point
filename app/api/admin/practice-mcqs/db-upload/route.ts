import { NextRequest } from "next/server";
import fs from "fs/promises";

import { connectDB } from "@/lib/db/connect";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { SyncedChapter } from "@/lib/db/models/SyncedChapter";
import { getChapterFilePath, getChapterFromSlug } from "@/lib/mcq/practice-service";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate that user is Admin
    await requireAuth(request, ["admin"]);
    await connectDB();

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Server Sync Mode
      const { files } = await request.json();
      if (!Array.isArray(files) || files.length === 0) {
        return fail("No files selected for sync.", 400);
      }

      let totalAdded = 0;

      for (const item of files) {
        const { level, subject, chapter } = item;
        if (!level || !subject || !chapter) continue;

        const filePath = getChapterFilePath(level, subject, chapter);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const questions = JSON.parse(content);
          if (Array.isArray(questions)) {
            // Map questions without the original id field
            const docs = questions.map((q: any) => ({
              level,
              subject,
              chapter,
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation || "",
            }));

            if (docs.length > 0) {
              await PracticeQuestion.insertMany(docs);
              totalAdded += docs.length;

              // Automatically mark as synced/added
              await SyncedChapter.findOneAndUpdate(
                { level, subject, chapter },
                { level, subject, chapter },
                { upsert: true }
              );
            }
          }
        } catch (err) {
          console.error(`Error syncing chapter ${chapter}:`, err);
        }
      }

      if (totalAdded === 0) {
        return fail("No questions were added. The selected files might be empty or invalid.", 400);
      }

      return success({ addedCount: totalAdded });
    } else if (contentType.includes("multipart/form-data")) {
      // Local Upload Mode
      const formData = await request.formData();
      const level = formData.get("level") as "ssc" | "hsc";
      const subject = formData.get("subject") as string;
      const uploadedFiles = formData.getAll("files") as File[];

      if (!level || !subject || uploadedFiles.length === 0) {
        return fail("Level, Subject, and JSON files are required.", 400);
      }

      let totalAdded = 0;
      const skippedFiles: string[] = [];

      for (const file of uploadedFiles) {
        const filename = file.name;
        // strip extension to get slug
        const slug = filename.replace(/\.json$/i, "");
        const chapter = getChapterFromSlug(level, subject, slug);

        if (!chapter) {
          skippedFiles.push(filename);
          continue;
        }

        try {
          const text = await file.text();
          const questions = JSON.parse(text);

          if (Array.isArray(questions)) {
            // Map questions without the original id field
            const docs = questions.map((q: any) => ({
              level,
              subject,
              chapter,
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation || "",
            }));

            if (docs.length > 0) {
              await PracticeQuestion.insertMany(docs);
              totalAdded += docs.length;

              // Automatically mark as synced/added
              await SyncedChapter.findOneAndUpdate(
                { level, subject, chapter },
                { level, subject, chapter },
                { upsert: true }
              );
            }
          }
        } catch (err) {
          console.error(`Error uploading local JSON file ${filename}:`, err);
          skippedFiles.push(filename);
        }
      }

      if (totalAdded === 0) {
        return fail("No questions were added. The uploaded files might be empty, invalid, or did not match any chapter.", 400, { skippedFiles });
      }

      return success({
        addedCount: totalAdded,
        skippedCount: skippedFiles.length,
        skippedFiles,
      });
    }

    return fail("Invalid content type.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
