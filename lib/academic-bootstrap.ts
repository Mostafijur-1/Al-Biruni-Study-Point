import path from "node:path";

import { z } from "zod";

export const academicBootstrapManifestSchema = z
  .object({
    organization: z.object({
      name: z.string().trim().min(2).max(120),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      timezone: z.string().trim().min(3).max(80).default("Asia/Dhaka"),
    }),
    academicSession: z.object({
      name: z.string().trim().min(2).max(120),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
      status: z.enum(["planned", "active"]).default("planned"),
    }),
    subjects: z
      .array(
        z.object({
          code: z.string().trim().min(2).max(40),
          name: z.string().trim().min(2).max(120),
          nameBn: z.string().trim().min(2).max(120),
          classLevels: z
            .array(z.enum(["class-9", "class-10", "class-11", "class-12"]))
            .min(1),
          aliases: z.array(z.string().trim().min(1).max(120)).default([]),
        }),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    if (JSON.stringify(value).includes("REPLACE")) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Replace every manifest placeholder before running the bootstrap.",
      });
    }
    if (value.academicSession.startsAt >= value.academicSession.endsAt) {
      context.addIssue({
        code: "custom",
        path: ["academicSession", "endsAt"],
        message: "Academic session end date must be after its start date.",
      });
    }
    const codes = value.subjects.map((subject) => subject.code.toUpperCase());
    if (new Set(codes).size !== codes.length) {
      context.addIssue({
        code: "custom",
        path: ["subjects"],
        message: "Subject codes must be unique within the manifest.",
      });
    }
  });

export function resolveWorkspaceManifestPath(workspaceRoot: string, manifestPath: string) {
  const resolvedPath = path.resolve(workspaceRoot, manifestPath);
  const relativePath = path.relative(workspaceRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("The academic bootstrap manifest must be inside the workspace.");
  }
  return { resolvedPath, relativePath };
}
