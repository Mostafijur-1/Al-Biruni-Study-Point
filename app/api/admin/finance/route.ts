import { NextRequest } from "next/server";

import { getFinanceLedger, mutateFinance } from "@/lib/application/finance-service";
import { createRequestContext } from "@/lib/application/request-context";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { financeListSchema, financeMutationSchema } from "@/lib/validations/finance.schema";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const input = financeListSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const context = createRequestContext(request, actor, { organizationId: input.organizationId });
    return success(await getFinanceLedger(context, input));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const input = financeMutationSchema.parse(await request.json());
    const context = createRequestContext(request, actor, { organizationId: input.organizationId });
    return success(await mutateFinance(context, input));
  } catch (error) {
    return handleApiError(error);
  }
}
