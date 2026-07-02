import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { incrementTeacherImageQuestionUpload } from "@/lib/teacher-charges";
import {
  MAX_IMAGE_UPLOADS,
  parseMcqsFromImages,
  parseMcqsFromText,
  readImageFilesFromFormData,
} from "@/lib/mcq/upload-parser";

export const maxDuration = 60;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const exam = await McqExam.findOne({ _id: id, teacher: user.id });
    if (!exam) {
      return fail("Exam not found or you do not have permission to manage questions for it.", 404);
    }

    const contentTypeHeader = request.headers.get("content-type") || "";

    if (contentTypeHeader.includes("application/json")) {
      const body = await request.json();
      const questionIds = body.questionIds;
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return fail("questionIds array is required.", 400);
      }

      const { PracticeQuestion } = await import("@/lib/db/models/PracticeQuestion");
      const { BENGALI_TO_ENGLISH_SUBJECT_MAP } = await import("@/lib/content/syllabus");
      const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[exam.subject] || exam.subject;

      const practiceQs = await PracticeQuestion.find({
        _id: { $in: questionIds },
        subject: { $in: [exam.subject, englishSubject] },
      }).lean();

      if (practiceQs.length === 0) {
        return fail("No matching questions found in the database.", 404);
      }

      const currentCount = await McqQuestion.countDocuments({ exam: id });
      const docs = practiceQs.map((q, idx) => ({
        exam: id,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "",
        marks: 1,
        difficulty: "medium",
        order: currentCount + idx,
      }));

      const savedQuestions = await McqQuestion.insertMany(docs);

      return success({
        addedCount: savedQuestions.length,
        questions: savedQuestions.map((sq) => ({
          id: sq._id.toString(),
          question: sq.question,
          options: sq.options,
          correctIndex: sq.correctIndex,
          explanation: sq.explanation,
        })),
      });
    }

    if (!contentTypeHeader.includes("multipart/form-data")) {
      return fail("Invalid content type. Must be multipart/form-data or application/json.", 400);
    }

    const formData = await request.formData();
    const contentType = formData.get("contentType") as string;

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

    const currentCount = await McqQuestion.countDocuments({ exam: id });
    const docs = parseResult.questions.map((q, idx) => ({
      exam: id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      marks: 1,
      difficulty: "medium",
      order: currentCount + idx,
    }));

    const savedQuestions = await McqQuestion.insertMany(docs);
    if (contentType === "image") {
      await incrementTeacherImageQuestionUpload(user.id);
    }

    return success({
      addedCount: savedQuestions.length,
      questions: savedQuestions.map((sq) => ({
        id: sq._id.toString(),
        question: sq.question,
        options: sq.options,
        correctIndex: sq.correctIndex,
        explanation: sq.explanation,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const exam = await McqExam.findOne({ _id: id, teacher: user.id });
    if (!exam) {
      return fail("Exam not found or you do not have permission.", 404);
    }

    const { searchParams } = request.nextUrl;
    const questionId = searchParams.get("questionId");
    if (!questionId) {
      return fail("questionId parameter is required.", 400);
    }

    const result = await McqQuestion.findOneAndDelete({ _id: questionId, exam: id });
    if (!result) {
      return fail("Question not found in this exam.", 404);
    }

    return success({ message: "Question deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
