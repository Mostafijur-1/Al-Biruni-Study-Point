import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";

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
      const practiceQs = await PracticeQuestion.find({
        _id: { $in: questionIds },
        subject: exam.subject,
      }).lean();

      if (practiceQs.length === 0) {
        return fail("No matching questions found in the database.", 404);
      }

      const currentCount = await McqQuestion.countDocuments({ exam: id });
      const docs = practiceQs.map((q: any, idx: number) => ({
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
    let contentType = formData.get("contentType") as string; // "text" | "image" | "file"
    let rawText = "";

    // 1. Parse content based on type (image OCR, pasted text, or txt file upload)
    if (contentType === "image") {
      const imageToTextKey = process.env.ImageToText_API_KEY;
      const imageCompressionKey = process.env.ImageCompression_API_KEY;

      if (!imageToTextKey) {
        return fail("Server Error: ImageToText_API_KEY is not configured in .env.local", 500);
      }
      if (!imageCompressionKey) {
        return fail("Server Error: ImageCompression_API_KEY is not configured in .env.local", 500);
      }

      const file = formData.get("file") as File;
      if (!file) {
        return fail("No image file was uploaded.", 400);
      }

      let ocrBuffer: ArrayBuffer;

      if (file.size > 200 * 1024) {
        console.log(`Image size is ${Math.round(file.size / 1024)}KB (> 200KB). Compressing with CloudConvert...`);
        let base64Data = "";
        const fileText = await file.text().catch(() => "");
        if (fileText.trim().startsWith("data:") && fileText.includes(";base64,")) {
          const commaIndex = fileText.indexOf(",");
          base64Data = fileText.trim().substring(commaIndex + 1);
        } else {
          const buffer = Buffer.from(await file.arrayBuffer());
          base64Data = buffer.toString("base64");
        }

        base64Data = base64Data.replace(/\s+/g, "");

        let ext = "jpg";
        if (file.name) {
          const parts = file.name.split(".");
          if (parts.length > 1) {
            const fileExt = parts.pop()?.toLowerCase();
            if (fileExt === "png" || fileExt === "pdf" || fileExt === "webp") {
              ext = fileExt;
            } else if (fileExt === "jpeg" || fileExt === "jpg") {
              ext = "jpg";
            }
          }
        }

        const ccFilename = `image.${ext}`;

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
                filename: ccFilename,
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
          const errDetails = await jobResponse.text();
          console.error("CloudConvert job creation error details:", errDetails);
          return fail(`CloudConvert Image Compression failed: ${jobResponse.statusText}`, 502);
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
          return fail(`CloudConvert image compression failed with status: ${job.status}`, 502);
        }

        const exportTask = job.tasks.find(
          (t: any) => t.operation === "export/url" && t.status === "finished"
        );
        const compressedUrl = exportTask?.result?.files?.[0]?.url;

        if (!compressedUrl) {
          return fail("CloudConvert compressed file URL not found.", 502);
        }

        const compressedRes = await fetch(compressedUrl);
        if (!compressedRes.ok) {
          return fail(`Failed to download compressed image: ${compressedRes.statusText}`, 502);
        }
        ocrBuffer = await compressedRes.arrayBuffer();
      } else {
        ocrBuffer = await file.arrayBuffer();
      }

      // API Ninjas OCR
      const apiFormData = new FormData();
      const ocrBlob = new Blob([ocrBuffer], { type: "image/jpeg" });
      apiFormData.append("image", ocrBlob, "image.jpg");

      const ocrResponse = await fetch("https://api.api-ninjas.com/v1/imagetotext", {
        method: "POST",
        headers: { "X-Api-Key": imageToTextKey },
        body: apiFormData,
      });

      if (!ocrResponse.ok) {
        return fail(`OCR Service error: ${ocrResponse.statusText}`, 502);
      }

      const ocrData = await ocrResponse.json();
      if (!Array.isArray(ocrData)) {
        return fail("OCR conversion failed: Invalid response format.", 422);
      }

      rawText = ocrData.map((item: any) => item.text).join("\n");
      if (!rawText.trim()) {
        return fail("OCR completed but no text could be extracted.", 422);
      }
      contentType = "text";
    } else if (contentType === "text") {
      const text = formData.get("text") as string;
      if (!text || text.trim() === "") {
        return fail("Pasted text is empty.", 400);
      }
      rawText = text;
    } else if (contentType === "file") {
      const file = formData.get("file") as File;
      if (!file) {
        return fail("No file was uploaded.", 400);
      }
      const textContent = await file.text();
      if (!textContent || textContent.trim() === "") {
        return fail("Uploaded text file is empty.", 400);
      }
      rawText = textContent;
    } else {
      return fail("Invalid content type.", 400);
    }

    // 2. Format with Gemini
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
5. Do NOT use raw LaTeX math formatting or symbols such as '$', '^', '\\times', '\\cdot', etc. If any input MCQ contains these, correct them to clean text/string formats:
   - Never use '$' as math delimiters; instead write clean plain text (e.g. '$25$' becomes '২৫').
   - For powers/exponents, use actual Unicode superscript characters (e.g., ², ³, ⁴, ⁿ, ˣ, ʸ) instead of '^' or '^{...}'. For example, write 'x²' instead of 'x^2' or 'x^{2}', and '10⁵' instead of '10^5'.
   - For multiplication, use the standard multiplication symbol '×' instead of '\\times', '*' or 'times'.
   - For permutation/combination notation (like ^4P_4 or ^4C_4), format them cleanly using Unicode superscripts and subscripts (e.g., ⁴P₄ or ⁴C₄) or write them in standard plain text.
   - Convert all raw math markup signs/code into clean, readable Bengali text or standard Unicode mathematical representation without raw LaTeX tags or symbols.
`;

    const parts = [
      { text: promptInstruction },
      { text: `Raw Text:\n${rawText}` }
    ];

    const apiKeysEnv = process.env.GEMINI_API_KEYS;
    const apiKeys = apiKeysEnv ? apiKeysEnv.split(',').map(k => k.trim()).filter(k => !!k) : [];
    if (apiKeys.length === 0) {
      return fail("Server Error: GEMINI_API_KEYS is not configured in .env.local", 500);
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    let geminiResponse: Response | null = null;
    for (const key of apiKeys) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const requestBody = {
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" },
      };
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
      return fail("All Gemini API keys exhausted or quota reached", 500);
    }

    const responseData = await geminiResponse.json();
    const candidate = responseData?.candidates?.[0];
    const outputText = candidate?.content?.parts?.[0]?.text;

    if (!outputText) {
      return fail("Gemini returned empty content.", 502);
    }

    let newQuestions: any[] = [];
    try {
      let cleanedText = outputText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      }
      newQuestions = JSON.parse(cleanedText);
    } catch (e: any) {
      console.error("Failed to parse Gemini output as JSON. Output was:", outputText);
      return fail("Failed to parse questions. Please ensure formatting is clear.", 422);
    }

    if (!Array.isArray(newQuestions)) {
      return fail("Gemini did not return an array of questions.", 422);
    }

    // 3. Save directly to DB as McqQuestion under this exam
    const currentCount = await McqQuestion.countDocuments({ exam: id });
    const docs = newQuestions.map((q: any, idx: number) => ({
      exam: id,
      question: q.question || "Untitled Question",
      options:
        Array.isArray(q.options) && q.options.length === 4
          ? q.options
          : ["Option A", "Option B", "Option C", "Option D"],
      correctIndex:
        typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3
          ? q.correctIndex
          : 0,
      explanation: q.explanation || "",
      marks: 1,
      difficulty: "medium",
      order: currentCount + idx,
    }));

    if (docs.length === 0) {
      return fail("No questions could be extracted/added.", 422);
    }

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
