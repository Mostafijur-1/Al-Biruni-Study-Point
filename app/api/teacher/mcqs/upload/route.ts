import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { getChapterFromSlug } from "@/lib/mcq/practice-service";
import {
  MAX_IMAGE_UPLOADS,
  parseMcqsFromImages,
  parseMcqsFromText,
  readImageFilesFromFormData,
} from "@/lib/mcq/upload-parser";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";
import { incrementTeacherImageQuestionUpload } from "@/lib/teacher-charges";
import { COURSE_TO_MCQ_SUBJECT_MAP } from "@/lib/content/syllabus";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth(request, ["teacher"]);
    await connectDB();

    const rateLimit = await consumeRateLimit("teacher:mcq-ingest", sessionUser.id, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const contentTypeHeader = request.headers.get("content-type") || "";
    if (!contentTypeHeader.includes("multipart/form-data")) {
      return fail("Invalid content type. Must be multipart/form-data.", 400);
    }

    const formData = await request.formData();
    const level = formData.get("level") as "ssc" | "hsc";
    const subject = formData.get("subject") as string;
    const chapterParam = formData.get("chapter") as string | null;
    const uploadContentType = (formData.get("contentType") as string) || "json";

    if (!level || !subject) {
      return fail("Level and Subject are required.", 400);
    }

    if (level !== "ssc" && level !== "hsc") {
      return fail("Invalid level. Must be ssc or hsc.", 400);
    }

    const domain = user.teacherDomain;
    let allowed = false;

    if (domain?.isAll) {
      allowed = true;
    } else {
      const allowedLevels: string[] = [];
      if (domain?.classes?.some((c) => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some((c) => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

      const levelAllowed = allowedLevels.includes(level);

      let subjectAllowed = false;
      if (domain?.subjects && domain.subjects.length > 0) {
        const mapping = COURSE_TO_MCQ_SUBJECT_MAP[level as "ssc" | "hsc"] || {};
        subjectAllowed = domain.subjects.some((engSub) => {
          const bengaliNames = mapping[engSub];
          return Array.isArray(bengaliNames) && bengaliNames.includes(subject);
        });
        if (!subjectAllowed) {
          subjectAllowed = domain.subjects.includes(subject);
        }
      }

      if (levelAllowed && subjectAllowed) {
        allowed = true;
      }
    }

    if (!allowed) {
      return fail("Access denied. You do not have domain access to this subject/level.", 403);
    }

    if (uploadContentType === "json") {
      const uploadedFiles = formData.getAll("files") as File[];
      if (uploadedFiles.length === 0) {
        return fail("JSON files are required.", 400);
      }

      let totalAdded = 0;
      const skippedFiles: string[] = [];

      for (const file of uploadedFiles) {
        const filename = file.name;
        let chapter = chapterParam;
        if (!chapter) {
          const slug = filename.replace(/\.json$/i, "");
          chapter = getChapterFromSlug(level, subject, slug);
        }

        if (!chapter) {
          skippedFiles.push(filename);
          continue;
        }

        try {
          const text = await file.text();
          const questions = JSON.parse(text);

          if (Array.isArray(questions)) {
            const docs = questions.map((q: { question: string; options: string[]; correctIndex: number; explanation?: string }) => ({
              level,
              subject,
              chapter,
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation || "",
              isTeacherSet: true,
              createdBy: user._id,
              approvedByAdmin: false,
            }));

            if (docs.length > 0) {
              await PracticeQuestion.insertMany(docs);
              totalAdded += docs.length;
            }
          }
        } catch (err) {
          console.error(`Error uploading local JSON file ${filename}:`, err);
          skippedFiles.push(filename);
        }
      }

      if (totalAdded === 0) {
        return fail("No questions were added.", 400, { skippedFiles });
      }

      return success({
        addedCount: totalAdded,
        skippedCount: skippedFiles.length,
        skippedFiles,
      });
    }

    if (!chapterParam) {
      return fail("Chapter selection is required for this upload mode.", 400);
    }

    let parseResult;

    if (uploadContentType === "image") {
      const files = await readImageFilesFromFormData(formData);
      if (files.length === 0) {
        return fail("No image file was uploaded.", 400);
      }
      if (files.length > MAX_IMAGE_UPLOADS) {
        return fail(`You can upload only ${MAX_IMAGE_UPLOADS} image at a time.`, 400);
      }
      parseResult = await parseMcqsFromImages(files);
    } else if (uploadContentType === "text" || uploadContentType === "file") {
      let rawText = "";
      if (uploadContentType === "text") {
        const text = formData.get("text") as string;
        if (!text || text.trim() === "") {
          return fail("Text content is empty.", 400);
        }
        rawText = text;
      } else {
        const file = formData.get("file") as File;
        if (!file) {
          return fail("No file was uploaded.", 400);
        }
        rawText = await file.text();
        if (!rawText.trim()) {
          return fail("Text file is empty.", 400);
        }
      }
      parseResult = await parseMcqsFromText(rawText);
    } else {
      return fail("Unsupported upload content type.", 400);
    }

    if (!parseResult.ok) {
      return fail(parseResult.error, parseResult.status);
    }

    const docs = parseResult.questions.map((q) => ({
      level,
      subject,
      chapter: chapterParam,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      isTeacherSet: true,
      createdBy: user._id,
      approvedByAdmin: false,
    }));

    const saved = await PracticeQuestion.insertMany(docs);
    if (uploadContentType === "image") {
      try {
        await incrementTeacherImageQuestionUpload(sessionUser.id);
      } catch (error) {
        // The questions are already saved. A nonessential usage metric must not
        // report the upload as failed and encourage a duplicate retry.
        console.error("Failed to increment teacher image upload usage:", error);
      }
    }

    return success({
      addedCount: saved.length,
      questions: saved,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
