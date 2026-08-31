import { DomainError } from "@/lib/application/domain-error";
import { idempotencyPayloadHash } from "@/lib/application/idempotency-key";
import type { RequestContext } from "@/lib/application/request-context";
import { ApplicationIdempotency } from "@/lib/db/models/ApplicationIdempotency";

export async function runIdempotentMutation<T>(context: RequestContext, input: { workflow: string; targetId: string; payload: unknown }, operation: () => Promise<T>): Promise<T> {
  const key = context.request.headers.get("idempotency-key")?.trim();
  if (!key) return operation();
  if (key.length > 200) throw new DomainError("Idempotency key is too long.", 400, "VALIDATION_ERROR");
  const payloadHash = idempotencyPayloadHash(input.payload);
  const identity = { actorId: context.actor.id, workflow: input.workflow, targetId: input.targetId, key };
  const existing = await ApplicationIdempotency.findOne(identity).lean();
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new DomainError("Idempotency key was reused with a different payload.", 409, "IDEMPOTENCY_KEY_REUSED");
    if (existing.status === "completed") return existing.result as T;
    throw new DomainError("An identical request is already in progress.", 409, "CONFLICT");
  }
  try {
    await ApplicationIdempotency.create({ ...identity, payloadHash, status: "started", expiresAt: new Date(Date.now() + 86_400_000) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new DomainError("An identical request is already in progress.", 409, "CONFLICT");
    }
    throw error;
  }
  let result: T;
  try {
    result = await operation();
  } catch (error) {
    await ApplicationIdempotency.deleteOne({ ...identity, status: "started" });
    throw error;
  }
  // If storing the replay result fails after the business write commits, keep
  // the started record. A fail-closed retry is safer than duplicating the write.
  await ApplicationIdempotency.updateOne(identity, { $set: { status: "completed", result } });
  return result;
}
