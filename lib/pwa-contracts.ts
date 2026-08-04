import { createHmac } from "node:crypto";
import { z } from "zod";

const deviceIdSchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Device ID contains unsupported characters.");

export const pwaSubscriptionSchema = z.object({
  deviceId: deviceIdSchema,
  isInstalledApp: z.boolean().default(false),
  subscription: z.object({
    endpoint: z.string().url().max(2048).refine(
      (value) => value.startsWith("https://"),
      "Push endpoint must use HTTPS.",
    ),
    expirationTime: z.number().nonnegative().nullable().default(null),
    keys: z.object({
      p256dh: z.string().trim().min(16).max(512),
      auth: z.string().trim().min(8).max(256),
    }),
  }),
});

export const pwaTrackSchema = z.object({
  deviceId: deviceIdSchema,
  type: z.enum(["install", "launch"]),
});

export function getPwaEventKey(
  type: "install" | "launch",
  now = new Date(),
): string {
  return type === "install" ? "install" : `launch:${now.toISOString().slice(0, 10)}`;
}

export function getTelemetryExpiry(now = new Date(), retentionDays = 90): Date {
  return new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export function hashNetworkIdentifier(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function truncateUserAgent(value: string | null, maxLength = 300): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

