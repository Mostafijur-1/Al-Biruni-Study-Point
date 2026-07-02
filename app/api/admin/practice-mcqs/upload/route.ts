import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { getSyllabusChapters, type SchoolLevel } from "@/lib/content/syllabus";
import type { CourseSubject } from "@/types";
import { connectDB } from "@/lib/db/connect";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import {
  MAX_IMAGE_UPLOADS,
  parseMcqsFromImages,
  parseMcqsFromText,
  readImageFilesFromFormData,
} from "@/lib/mcq/upload-parser";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth(request, ["admin"]);

    const formData = await request.formData();
    const targetSubject = formData.get("subject") as CourseSubject;
    const targetLevel = formData.get("level") as SchoolLevel;
    const targetChapter = formData.get("chapter") as string;
    const contentType = formData.get("contentType") as string;

    if (!targetSubject || !targetLevel || !targetChapter) {
      return fail("Subject, Level, and Chapter are required.", 400);
    }

    const validChapters = getSyllabusChapters(targetLevel, targetSubject);
    if (validChapters.length > 0 && !validChapters.includes(targetChapter)) {
      return fail("Invalid chapter selection for this subject and level.", 400);
    }

    let parseResult;

    if (contentType === "image") {
      const files = await readImageFilesFromFormData(formData);
      if (files.length === 0) {
        return fail("No image file was uploaded.", 400);
      }
      if (files.length > MAX_IMAGE_UPLOADS) {
        return fail(`You can upload only ${MAX_IMAGE_UPLOADS} image at a time.`, 400);
      }
      parseResult = await parseMcqsFromImages(files);
    } else if (contentType === "text" || contentType === "file") {
      let rawText = "";
      if (contentType === "text") {
        const text = formData.get("text") as string;
        if (!text || text.trim() === "") {
          return fail("Pasted text is empty.", 400);
        }
        rawText = text;
      } else {
        const file = formData.get("file") as File;
        if (!file) {
          return fail("No file was uploaded.", 400);
        }
        const textContent = await file.text();
        if (!textContent || textContent.trim() === "") {
          return fail("Uploaded text file is empty.", 400);
        }
        rawText = textContent;
      }
      parseResult = await parseMcqsFromText(rawText);
    } else {
      return fail("Invalid content type.", 400);
    }

    if (!parseResult.ok) {
      return fail(parseResult.error, parseResult.status);
    }

    await connectDB();
    const docs = parseResult.questions.map((q) => ({
      level: targetLevel,
      subject: targetSubject,
      chapter: targetChapter,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      isTeacherSet: true,
      createdBy: sessionUser.id,
      approvedByAdmin: false,
    }));

    const createdQuestions = await PracticeQuestion.insertMany(docs);

    const returnedQuestions = createdQuestions.map((q) => ({
      id: String(q._id),
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
    }));

    return success({
      addedCount: returnedQuestions.length,
      questions: returnedQuestions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
