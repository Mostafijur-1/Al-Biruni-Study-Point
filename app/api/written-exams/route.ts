import { NextRequest } from "next/server";

import { createRequestContext } from "@/lib/application/request-context";
import { getWrittenExamData, mutateWrittenExam, uploadWrittenExamQuestion } from "@/lib/application/written-exam-service";
import { DomainError } from "@/lib/application/domain-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writtenExamMutationSchema } from "@/lib/validations/written-exam.schema";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const result = await getWrittenExamData(createRequestContext(request, actor), {
      examId: request.nextUrl.searchParams.get("examId") ?? undefined,
      question: request.nextUrl.searchParams.get("question") === "true",
    });
    if (result.kind === "file") {
      return new Response(result.bytes, { headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `inline; filename="${result.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      } });
    }
    if (result.kind === "external-link") {
      return new Response(null, { status: 307, headers: { Location: result.url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
    return success(result.data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    const context = createRequestContext(request, actor);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new DomainError("A valid exam and question file are required.", 400, "VALIDATION_ERROR");
      return success(await uploadWrittenExamQuestion(context, { examId: String(form.get("examId") ?? ""), file }));
    }
    const input = writtenExamMutationSchema.parse(await request.json());
    return success(await mutateWrittenExam(context, input), input.action === "create" ? { status: 201 } : undefined);
  } catch (error) {
    return handleApiError(error);
  }
}
