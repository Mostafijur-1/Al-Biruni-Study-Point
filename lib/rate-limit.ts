import { createHash } from "crypto";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/response";
import { RateLimitBucket } from "@/lib/db/models/RateLimitBucket";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function consumeRateLimit(
  scope: string,
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucket = Math.floor(now / options.windowMs);
  const resetAt = (bucket + 1) * options.windowMs;
  const digest = createHash("sha256").update(identifier).digest("hex");
  const key = `${scope}:${digest}:${bucket}`;
  const expiresAt = new Date(resetAt + options.windowMs);

  let record;
  try {
    record = await RateLimitBucket.findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { upsert: true, new: true },
    ).lean();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    record = await RateLimitBucket.findOneAndUpdate(
      { _id: key },
      { $inc: { count: 1 } },
      { new: true },
    ).lean();
  }

  const count = record?.count ?? options.limit + 1;
  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  const response = fail("Too many requests. Please try again later.", 429, {
    retryAfterSeconds: result.retryAfterSeconds,
  });
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
