import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier.");
const studentClassSchema = z.enum(["class-9", "class-10", "class-11", "class-12"]);

export const batchListQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  academicSessionId: objectIdSchema.optional(),
  studentClass: studentClassSchema.optional(),
  status: z.enum(["planned", "active", "closed", "archived"]).default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const enrollmentListQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  academicSessionId: objectIdSchema.optional(),
  batchId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  status: z.enum(["active", "completed", "withdrawn", "transferred"]).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
