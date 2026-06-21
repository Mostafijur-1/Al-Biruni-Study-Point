import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { getChapterFromSlug } from "@/lib/mcq/practice-service";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";
import { incrementTeacherImageQuestionUpload } from "@/lib/teacher-charges";

const MAX_IMAGE_UPLOADS = 3;

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
    let outputText = "";

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
6. Handle Multi-Statement / Roman-Numeral Questions (উদ্দীপক/বহুপদী সমাপ্তিসূচক প্রশ্ন) Properly:
   - For questions that rely on a set of statements, facts, or roman numerals (e.g. "I. BeCl₂", "II. PCl₅", "III. BF₃" or "১. HCl", "২. H₂O", "৩. NH₃") and then ask a query based on them (e.g. "কোনটি সঠিক?" or "কোন যৌগগুলোর ক্ষেত্রে অষ্টক নিয়ম কার্যকর নয়?"), you MUST include the list of statements (with their roman numerals/numbers) and their introductory text directly inside the \`question\` field.
   - For example, if the input is:
     "নিচের যৌগগুলো লক্ষ্য কর:
      I. BeCl₂
      II. PCl₅
      III. BF₃
      অষ্টক নিয়ম কার্যকর নয় কোন যৌগগুলোর ক্ষেত্রে?"
     The extracted \`question\` field MUST be:
     "নিচের যৌগগুলো লক্ষ্য কর:\nI. BeCl₂\nII. PCl₅\nIII. BF₃\nঅষ্টক নিয়ম কার্যকর নয় কোন যৌগগুলোর ক্ষেত্রে?"
   - Never omit the list of statements (I, II, III / ১, ২, ৩) from the \`question\` field.
7. Handle Common Stimulus/Passage/Stem (উদ্দীপক) for Multiple Questions:
   - In Bangladesh curriculum exams, a single passage, diagram description, text, or table (referred to as "উদ্দীপক") is often followed by multiple questions (e.g., "উদ্দীপকের আলোকে নিচের ১ ও ২ নং প্রশ্নের উত্তর দাও").
   - If there is a common stimulus/passage/stem (উদ্দীপক) in the input, you MUST prepend/duplicate the full text/description of that stimulus/passage/stem to the \`question\` field of EACH individual MCQ question that refers to it.
   - The helper line such as "উদ্দীপকের আলোকে ১৬ ও ১৭ নং প্রশ্নের উত্তর দাও:" is NOT the stimulus. Remove that helper line, then copy the actual stimulus text that appears before/around it (e.g., "P, Q, R [P,Q,R প্রতীকী অর্থে]") into every linked question.
   - If a question clearly depends on an উদ্দীপক but the actual stimulus text/diagram/table cannot be extracted accurately because of OCR noise, missing text, cropping, or ambiguity, you MUST skip/ignore all dependent questions. Never save a contextless question that only says something like "Q মৌলটি কোন গ্রুপের?" without its required উদ্দীপক.
   - For example, if the input is:
     "উদ্দীপক: A ও B মৌলের পারমাণবিক সংখ্যা যথাক্রমে ৭ ও ১৫।
      ১. A মৌলটি কোন গ্রুপে অবস্থিত?
      ২. B মৌলের অক্সাইডের অম্লধর্মিতা কেমন?"
     The extracted MCQ list should have:
     - Question 1: "উদ্দীপক: A ও B মৌলের পারমাণবিক সংখ্যা যথাক্রমে ৭ ও ১৫।\nA মৌলটি কোন গ্রুপে অবস্থিত?"
     - Question 2: "উদ্দীপক: A ও B মৌলের পারমাণবিক সংখ্যা যথাক্রমে ৭ ও ১৫।\nB মৌলের অক্সাইডের অম্লধর্মিতা কেমন?"
   - CRITICAL: Both questions must contain the common stimulus (উদ্দীপক) separately inside their \`question\` fields. Never only include the stimulus in the first question and leave the second question without it. Each question in our database is stored separately, so they must be completely self-contained with their context.
   - STRIP QUESTION NUMBER REFERENCES: You MUST strip/exclude meta-instruction helper sentences that reference specific question numbers (e.g., "উদ্দীপকের আলোকে ১৪ ও ১৫ নং প্রশ্নের উত্তর দাও:" or "উদ্দীপকের আলোকে নিচের ১৪ ও ১৫ নং প্রশ্নের উত্তর দাও:"). Do NOT write this part in front of the extracted questions, as it is only an instruction linking the shared stimulus to those question numbers.
8. Strip Exam Board / Year References:
   - Remove source citation fragments from the question text, especially parenthesized board/year references such as "(দা. বো. '১৩, সি. বো. '১০)", "(ঢা. বো. ২০১৯)", "(Rajshahi Board 2020)", or similar exam board abbreviations and years.
   - These citations are metadata, not part of the actual MCQ. Do NOT include them in the \`question\`, \`options\`, or \`explanation\` fields.
   - Example: "K₂O₂ যৌগে অক্সিজেনের জারণ সংখ্যা কত? (দা. বো. '১৩, সি. বো. '১০)" must become "K₂O₂ যৌগে অক্সিজেনের জারণ সংখ্যা কত?"
9. Handle Questions with Diagrams/Figures/Tables/Charts:
   - Some input questions from images or text may refer to a diagram, circuit, graph, chart, table, or molecular structure.
   - If a question relies on a diagram, graph, chart, table, or figure:
     1. If the diagram, table, or chart can be clearly and accurately described/represented in text (such as a table formatted as a markdown table or text grid, simple chemical reactions, a simple flowchart, a list of values, or a straightforward logic gate representation), represent/express it in Bengali text and prepend it to the \`question\` field of EACH related question.
     2. If the diagram, table, graph, or chart is complex and CANNOT be clearly or fully represented in words/text (such as a complex physics circuit diagram, an intricate geometry figure, a complex chart, or a detailed organic reaction mechanism tree), you MUST skip/ignore all questions referring to this diagram/table/chart entirely. Do not include them in the parsed JSON array.

10. Keep Explanations Concise and Actionable (explanation):
   - Keep the extracted \`explanation\` short and straight to the point (no unnecessary fluff or long paragraphs).
   - If a mathematical, logical, or scientific shortcut/tip/trick is possible to solve the question quickly in exams, prioritize providing that shortcut as the explanation (e.g., "শর্টকাট: সূত্র...").
   - If no shortcut exists, provide a simple, brief general explanation.
   - The explanation MUST be in Bengali (Bangla).





`;

    const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!openrouterKey) {
      return fail("Server Error: OPENROUTER_API_KEY is not configured in .env.local", 500);
    }
    const openrouterModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

    if (uploadContentType === "image") {
      const files = formData
        .getAll("files")
        .filter((item): item is File => item instanceof File && item.size > 0);
      const legacyFile = formData.get("file");
      if (legacyFile instanceof File && legacyFile.size > 0 && files.length === 0) {
        files.push(legacyFile);
      }
      if (files.length === 0) {
        return fail("No image files were uploaded.", 400);
      }
      if (files.length > MAX_IMAGE_UPLOADS) {
        return fail(`You can upload a maximum of ${MAX_IMAGE_UPLOADS} images at a time.`, 400);
      }
      try {
        const imageParts = await Promise.all(
          files.map(async (file) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64Data = buffer.toString("base64");
            const mimeType = file.type || "image/jpeg";
            return {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            };
          }),
        );

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/Mostafijur-1/Al-Biruni-Study-Point",
            "X-OpenRouter-Title": "Al-Biruni Study Point",
          },
          body: JSON.stringify({
            model: openrouterModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptInstruction },
                  { type: "text", text: `Parse all ${files.length} uploaded image(s) together in order.` },
                  ...imageParts,
                ]
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("OpenRouter Vision API error:", errText);
          return fail(`OpenRouter Vision API failed: ${response.statusText}`, 502);
        }

        const data = await response.json();
        outputText = data?.choices?.[0]?.message?.content || "";
        if (!outputText) {
          return fail("OpenRouter returned empty response.", 502);
        }
      } catch (err: any) {
        console.error("OpenRouter Vision API exception:", err);
        return fail(`OpenRouter Vision API error: ${err.message || err}`, 502);
      }
    } else if (uploadContentType === "text" || uploadContentType === "file") {
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

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/Mostafijur-1/Al-Biruni-Study-Point",
            "X-OpenRouter-Title": "Al-Biruni Study Point",
          },
          body: JSON.stringify({
            model: openrouterModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptInstruction },
                  { type: "text", text: `Raw Text:\n${rawText}` }
                ]
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("OpenRouter API error:", errText);
          return fail(`OpenRouter API failed: ${response.statusText}`, 502);
        }

        const data = await response.json();
        outputText = data?.choices?.[0]?.message?.content || "";
        if (!outputText) {
          return fail("OpenRouter returned empty response.", 502);
        }
      } catch (err: any) {
        console.error("OpenRouter API exception:", err);
        return fail(`OpenRouter API error: ${err.message || err}`, 502);
      }
    } else {
      return fail("Unsupported upload content type.", 400);
    }

    let parsedQuestions: any[] = [];
    let cleanedText = outputText.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }
    try {
      const parsedJson = JSON.parse(cleanedText);
      if (Array.isArray(parsedJson)) {
        parsedQuestions = parsedJson;
      } else if (parsedJson && typeof parsedJson === "object") {
        if ("question" in parsedJson && "options" in parsedJson) {
          parsedQuestions = [parsedJson];
        } else {
          const arrayProp = Object.values(parsedJson).find(
            (val) => Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null && ("question" in val[0] || "options" in val[0])
          );
          if (arrayProp) {
            parsedQuestions = arrayProp as any[];
          } else {
            parsedQuestions = [parsedJson];
          }
        }
      }
    } catch {
      // Fallback: Use stack-based scanner to extract successfully parsed question objects from partial/truncated JSON
      parsedQuestions = extractQuestionObjects(cleanedText);
      if (parsedQuestions.length === 0) {
        return fail("JSON parsing of output failed.", 422);
      }
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
    if (uploadContentType === "image") {
      await incrementTeacherImageQuestionUpload(sessionUser.id);
    }

    return success({
      addedCount: saved.length,
      questions: saved,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function extractQuestionObjects(jsonStr: string): any[] {
  const objects: any[] = [];
  let inString = false;
  let escape = false;
  const stack: number[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        stack.push(i);
      } else if (char === '}') {
        const start = stack.pop();
        if (start !== undefined) {
          const objStr = jsonStr.substring(start, i + 1);
          try {
            const obj = JSON.parse(objStr);
            if (obj && typeof obj === "object" && "question" in obj && "options" in obj) {
              objects.push(obj);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    }
  }
  return objects;
}
