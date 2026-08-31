import { NextRequest } from "next/server";

import { listEnrollments, mutateEnrollment } from "@/lib/application/enrollment-service";
import { createRequestContext } from "@/lib/application/request-context";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { enrollmentListQuerySchema, enrollmentMutationSchema } from "@/lib/validations/academic.schema";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const input = enrollmentListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const context = createRequestContext(request, actor, {
      organizationId: input.organizationId,
      branchId: input.branchId,
      academicSessionId: input.academicSessionId,
    });
    return success(await listEnrollments(context, input));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const input = enrollmentMutationSchema.parse(await request.json());
    const result = await mutateEnrollment(createRequestContext(request, actor), input);
    return success(result.data, result.status === 201 ? { status: 201 } : undefined);
  } catch (error) {
    return handleApiError(error);
  }
}
