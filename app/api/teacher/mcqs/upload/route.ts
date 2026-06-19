import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { getChapterFromSlug } from "@/lib/mcq/practice-service";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate as Teacher
    const sessionUser = await requireAuth(request, ["teacher"]);
    await connectDB();

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

    // 2. Verify Teacher Domain Permission
    const domain = user.teacherDomain;
    let allowed = false;

    if (domain?.isAll) {
      allowed = true;
    } else {
      const allowedLevels: string[] = [];
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

      const levelAllowed = allowedLevels.includes(level);
      const subjectAllowed = domain?.subjects?.includes(subject);
      if (levelAllowed && subjectAllowed) {
        allowed = true;
      }
    }

    if (!allowed) {
      return fail("Access denied. You do not have domain access to this subject/level.", 403);
    }

    // 3. Process Upload based on Type
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
            const docs = questions.map((q: any) => ({
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

    // For Text, TXT file, and Image OCR uploads
    if (!chapterParam) {
      return fail("Chapter selection is required for this upload mode.", 400);
    }

    let rawText = "";

    if (uploadContentType === "image") {
      const imageToTextKey = process.env.ImageToText_API_KEY;
      const imageCompressionKey = process.env.ImageCompression_API_KEY;

      if (!imageToTextKey) {
        return fail("Server Error: ImageToText_API_KEY is not configured.", 500);
      }
      if (!imageCompressionKey) {
        return fail("Server Error: ImageCompression_API_KEY is not configured.", 500);
      }

      const file = formData.get("file") as File;
      if (!file) {
        return fail("No image file was uploaded.", 400);
      }

      let ocrBuffer: ArrayBuffer;

      // Handle compression for large images
      if (file.size > 200 * 1024) {
        console.log(`Compresing image using CloudConvert...`);
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString("base64").replace(/\s+/g, "");

        let ext = "jpg";
        if (file.name) {
          const fileExt = file.name.split(".").pop()?.toLowerCase();
          if (fileExt === "png" || fileExt === "pdf" || fileExt === "webp") {
            ext = fileExt;
          }
        }

        const jobResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${imageCompressionKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tasks: {
              "import-file": {
                operation: "import/base64",
                file: base64Data,
                filename: `image.${ext}`,
              },
              "optimize-file": {
                operation: "optimize",
                input: "import-file",
                input_format: ext,
                quality: 60,
              },
              "export-file": {
                operation: "export/url",
                input: "optimize-file",
              },
            },
          }),
        });

        if (!jobResponse.ok) {
          return fail("Image compression service initialization failed.", 502);
        }

        const jobData = await jobResponse.json();
        let job = jobData.data;
        const jobId = job.id;

        let pollAttempts = 0;
        const maxAttempts = 30;
        while (job.status !== "finished" && job.status !== "failed" && pollAttempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const pollResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
            headers: { "Authorization": `Bearer ${imageCompressionKey}` },
          });
          if (pollResponse.ok) {
            const pollData = await pollResponse.json();
            job = pollData.data;
          }
          pollAttempts++;
        }

        if (job.status !== "finished") {
          return fail("Image compression failed.", 502);
        }

        const exportTask = job.tasks.find((t: any) => t.operation === "export/url" && t.status === "finished");
        const compressedUrl = exportTask?.result?.files?.[0]?.url;

        if (!compressedUrl) {
          return fail("Compressed image link not found.", 502);
        }

        const compressedRes = await fetch(compressedUrl);
        ocrBuffer = await compressedRes.arrayBuffer();
      } else {
        ocrBuffer = await file.arrayBuffer();
      }

      // Run API Ninjas OCR
      const apiFormData = new FormData();
      apiFormData.append("image", new Blob([ocrBuffer], { type: "image/jpeg" }), "image.jpg");

      const ocrResponse = await fetch("https://api.api-ninjas.com/v1/imagetotext", {
        method: "POST",
        headers: { "X-Api-Key": imageToTextKey },
        body: apiFormData,
      });

      if (!ocrResponse.ok) {
        return fail("OCR text extraction failed.", 502);
      }

      const ocrData = await ocrResponse.json();
      rawText = ocrData.map((item: any) => item.text).join("\n");
      if (!rawText.trim()) {
        return fail("No text detected in the image.", 422);
      }
    } else if (uploadContentType === "text") {
      rawText = (formData.get("text") as string) || "";
      if (!rawText.trim()) {
        return fail("Text content is empty.", 400);
      }
    } else if (uploadContentType === "file") {
      const file = formData.get("file") as File;
      if (!file) {
        return fail("No file was uploaded.", 400);
      }
      rawText = await file.text();
      if (!rawText.trim()) {
        return fail("Text file is empty.", 400);
      }
    } else {
      return fail("Unsupported upload content type.", 400);
    }

    // 4. Call Gemini to Parse and Translate MCQs
    const promptInstruction = `
You are an expert educational content parser. Extract multiple-choice questions (MCQs) from the provided input and translate them to Bengali (Bangla) if they are in English.
Convert them into a valid JSON array of objects representing MCQ questions.

Each MCQ question object must EXACTLY match this TypeScript schema:
{
  "question": string,       // The question text. MUST be in Bengali (Bangla).
  "options": string[],      // Array of exactly 4 option choices. MUST be in Bengali (Bangla).
  "correctIndex": number,   // 0-based index of the correct answer (0, 1, 2, or 3).
  "explanation": string     // (Optional) A brief explanation of the correct answer. MUST be in Bengali (Bangla).
}

Crucial Rules:
1. All output text (question, options, and explanation) MUST be in Bengali (Bangla), even if the input source is in English. Translate any English parts accurately to Bengali.
2. Ensure the correct option is correctly determined based on standard physics/chemistry/math/ICT knowledge.
3. The options array must contain exactly 4 options. If the source material has fewer, generate plausible options to make it 4. If more, select the 4 most relevant.
4. Return ONLY a valid JSON array. Do not include markdown wraps like \`\`\`json. Do not include any introductory or concluding text.
`;

    const parts = [
      { text: promptInstruction },
      { text: `Raw Text:\n${rawText}` }
    ];

    const apiKeysEnv = process.env.GEMINI_API_KEYS;
    const apiKeys = apiKeysEnv ? apiKeysEnv.split(',').map(k => k.trim()).filter(k => !!k) : [];
    if (apiKeys.length === 0) {
      return fail("Server Error: Gemini key not configured.", 500);
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    let geminiResponse: Response | null = null;
    for (const key of apiKeys) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (response.ok) {
        geminiResponse = response;
        break;
      }
      if (response.status !== 429) {
        break;
      }
    }

    if (!geminiResponse) {
      return fail("Gemini parsing failed.", 500);
    }

    const responseData = await geminiResponse.json();
    const candidate = responseData?.candidates?.[0];
    const outputText = candidate?.content?.parts?.[0]?.text;

    if (!outputText) {
      return fail("Gemini parser returned empty results.", 502);
    }

    let parsedQuestions: any[] = [];
    try {
      let cleanedText = outputText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      }
      parsedQuestions = JSON.parse(cleanedText);
    } catch {
      return fail("JSON parsing of Gemini output failed.", 422);
    }

    if (!Array.isArray(parsedQuestions)) {
      return fail("Invalid parse shape. Must be an array of MCQs.", 422);
    }

    const docs = parsedQuestions.map((q: any) => ({
      level,
      subject,
      chapter: chapterParam,
      question: q.question || "Untitled Question",
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : 0,
      explanation: q.explanation || "",
      isTeacherSet: true,
      createdBy: user._id,
      approvedByAdmin: false,
    }));

    if (docs.length === 0) {
      return fail("No questions could be extracted.", 422);
    }

    const saved = await PracticeQuestion.insertMany(docs);

    return success({
      addedCount: saved.length,
      questions: saved,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
