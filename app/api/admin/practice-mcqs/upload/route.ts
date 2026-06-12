import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { getChapterFilePath } from "@/lib/mcq/practice-service";
import { SYLLABUS, type SchoolLevel } from "@/lib/content/syllabus";
import type { CourseSubject } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate that user is Admin
    await requireAuth(request, ["admin"]);

    // 2. Parse form data
    const formData = await request.formData();
    const targetSubject = formData.get("subject") as CourseSubject;
    const targetLevel = formData.get("level") as SchoolLevel;
    const targetChapter = formData.get("chapter") as string;
    let contentType = formData.get("contentType") as string; // "text" | "image" | "file"

    if (!targetSubject || !targetLevel || !targetChapter) {
      return fail("Subject, Level, and Chapter are required.", 400);
    }

    // Validate that the chapter matches the syllabus configuration
    const validChapters = SYLLABUS[targetLevel]?.[targetSubject];
    if (!validChapters || !validChapters.includes(targetChapter)) {
      return fail("Invalid chapter selection for this subject and level.", 400);
    }

    let rawText = "";

    // 3. Image OCR Pipeline using API Ninjas Image to Text API after CloudConvert Image Compression
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
        // A. Extract and clean Base64 data for CloudConvert
        let base64Data = "";
        const fileText = await file.text().catch(() => "");
        if (fileText.trim().startsWith("data:") && fileText.includes(";base64,")) {
          const commaIndex = fileText.indexOf(",");
          base64Data = fileText.trim().substring(commaIndex + 1);
        } else {
          const buffer = Buffer.from(await file.arrayBuffer());
          base64Data = buffer.toString("base64");
        }

        // Clean all spaces, newlines, and carriage returns from base64 string
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

        // B. Create CloudConvert job to compress the image
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
          let errMsg = `CloudConvert Image Compression job creation failed: ${jobResponse.statusText}`;
          try {
            const parsedErr = JSON.parse(errDetails);
            if (parsedErr.code === "FORBIDDEN" || parsedErr.message?.includes("scope")) {
              errMsg = "CloudConvert API Key lacks the required permissions. Please go to your CloudConvert dashboard (https://cloudconvert.com/dashboard/api/v2/keys), edit this API key, and check/enable the 'task.write' and 'task.read' scopes.";
            } else if (parsedErr.message) {
              errMsg = `CloudConvert error: ${parsedErr.message}`;
            }
          } catch (e) {}
          return fail(errMsg, 502);
        }

        const jobData = await jobResponse.json();
        let job = jobData.data;
        const jobId = job.id;

        // C. Poll job status
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait time
        while (job.status !== "finished" && job.status !== "failed" && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const pollResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
            headers: {
              "Authorization": `Bearer ${imageCompressionKey}`,
            },
          });
          if (pollResponse.ok) {
            const pollData = await pollResponse.json();
            job = pollData.data;
          }
          attempts++;
        }

        if (job.status !== "finished") {
          return fail(`CloudConvert image compression failed with status: ${job.status}`, 502);
        }

        // D. Find the exported download URL
        const exportTask = job.tasks.find(
          (t: any) => t.operation === "export/url" && t.status === "finished"
        );
        const compressedUrl = exportTask?.result?.files?.[0]?.url;

        if (!compressedUrl) {
          return fail("CloudConvert completed but exported compressed file URL was not found.", 502);
        }

        console.log("Image compressed successfully using CloudConvert. URL:", compressedUrl);

        // E. Fetch the compressed image buffer
        const compressedRes = await fetch(compressedUrl);
        if (!compressedRes.ok) {
          return fail(`Failed to download compressed image from CloudConvert: ${compressedRes.statusText}`, 502);
        }
        ocrBuffer = await compressedRes.arrayBuffer();
      } else {
        console.log(`Image size is ${Math.round(file.size / 1024)}KB (<= 200KB). Skipping CloudConvert compression.`);
        ocrBuffer = await file.arrayBuffer();
      }

      // F. Send file to API Ninjas OCR
      const apiFormData = new FormData();
      const ocrBlob = new Blob([ocrBuffer], { type: "image/jpeg" });
      apiFormData.append("image", ocrBlob, "image.jpg");

      const ocrResponse = await fetch("https://api.api-ninjas.com/v1/imagetotext", {
        method: "POST",
        headers: {
          "X-Api-Key": imageToTextKey,
        },
        body: apiFormData,
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        console.error("API Ninjas Image to Text error details:", errorText);
        return fail(`OCR Service returned error: ${ocrResponse.statusText}`, 502);
      }

      const ocrData = await ocrResponse.json();
      if (!Array.isArray(ocrData)) {
        console.error("API Ninjas unexpected response format:", ocrData);
        const ocrErr = ocrData as any;
        return fail(`OCR conversion failed: ${ocrErr?.error || "Unexpected response format"}`, 422);
      }

      // Join the detected text segments with a newline
      rawText = ocrData.map((item: any) => item.text).join("\n");

      if (!rawText.trim()) {
        return fail("OCR completed but no text could be extracted from this image.", 422);
      }

      contentType = "text";
      console.log("Extracted text from image successfully using API Ninjas after CloudConvert compression.");
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

    // 4. Gemini Formatting Prompt
    let promptInstruction = `
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

    let parts = [
      { text: promptInstruction },
      { text: `Raw Text:\n${rawText}` }
    ];

    // 5. Call Gemini API with fallback keys
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
      // If rate‑limited (429), try next key; otherwise break
      if (response.status !== 429) {
        break;
      }
    }
    if (!geminiResponse) {
      return fail("All Gemini API keys exhausted or quota reached", 500);
    }

    const responseData = await geminiResponse.json();
    const candidate = responseData?.candidates?.[0];

    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      return fail(`Gemini generation finished early: ${candidate.finishReason}`, 502);
    }

    const outputText = candidate?.content?.parts?.[0]?.text;
    if (!outputText) {
      return fail("Gemini returned empty content.", 502);
    }

    // 6. Parse JSON questions
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

    // Assign unique IDs to the questions
    const formattedQuestions = newQuestions.map((q: any, idx: number) => {
      const rand = Math.random().toString(36).substring(2, 8);
      const prefix = targetSubject.toLowerCase().substring(0, 3).replace(/\s+/g, "");
      const id = `${prefix}_${targetLevel}_${rand}_${idx}`;

      return {
        id,
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
      };
    });

    if (formattedQuestions.length === 0) {
      return fail("No questions could be extracted/added.", 422);
    }

    // 7. Update JSON Store file
    const dataFilePath = getChapterFilePath(targetLevel, targetSubject, targetChapter);
    
    // Ensure parent directories exist
    await fs.mkdir(path.dirname(dataFilePath), { recursive: true });

    let currentQuestions: any[] = [];

    try {
      const fileContent = await fs.readFile(dataFilePath, "utf-8");
      currentQuestions = JSON.parse(fileContent);
    } catch (err) {
      currentQuestions = [];
    }

    currentQuestions.push(...formattedQuestions);

    await fs.writeFile(dataFilePath, JSON.stringify(currentQuestions, null, 2), "utf-8");

    return success({
      addedCount: formattedQuestions.length,
      questions: formattedQuestions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
