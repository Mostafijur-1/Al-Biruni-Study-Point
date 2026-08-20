import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier.");
const reasonSchema = z.string().trim().min(4).max(500);
const privateNoteSchema = z.string().trim().max(500).optional();
const attendanceStatusSchema = z.enum(["present", "absent", "late", "excused"]);

const markSchema = z
  .object({
    enrollmentId: objectIdSchema,
    status: attendanceStatusSchema,
    minutesLate: z.coerce.number().int().min(1).max(720).optional(),
    privateNote: privateNoteSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "late" && value.minutesLate === undefined) {
      context.addIssue({
        code: "custom",
        path: ["minutesLate"],
        message: "Late attendance requires minutes late.",
      });
    }
    if (value.status !== "late" && value.minutesLate !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["minutesLate"],
        message: "Minutes late is allowed only for late attendance.",
      });
    }
  });

export const attendanceSheetListQuerySchema = z.object({
  classSessionId: objectIdSchema.optional(),
  batchId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  status: z.enum(["draft", "submitted", "all"]).default("all"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const openAttendanceSheetSchema = z.object({
  classSessionId: objectIdSchema,
  reason: reasonSchema,
});

export const markAttendanceSchema = z.object({
  version: z.coerce.number().int().min(1),
  entries: z.array(markSchema).min(1).max(500),
  reason: reasonSchema,
}).superRefine((value, context) => {
  const enrollmentIds = value.entries.map((entry) => entry.enrollmentId);
  if (new Set(enrollmentIds).size !== enrollmentIds.length) {
    context.addIssue({
      code: "custom",
      path: ["entries"],
      message: "Each enrollment may be marked only once per request.",
    });
  }
});

export const submitAttendanceSchema = z.object({
  version: z.coerce.number().int().min(1),
  reason: reasonSchema,
});

export const requestAttendanceCorrectionSchema = z
  .object({
    recordId: objectIdSchema,
    status: attendanceStatusSchema,
    minutesLate: z.coerce.number().int().min(1).max(720).optional(),
    privateNote: privateNoteSchema,
    reason: reasonSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "late" && value.minutesLate === undefined) {
      context.addIssue({
        code: "custom",
        path: ["minutesLate"],
        message: "Late attendance requires minutes late.",
      });
    }
    if (value.status !== "late" && value.minutesLate !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["minutesLate"],
        message: "Minutes late is allowed only for late attendance.",
      });
    }
  });

export const reviewAttendanceCorrectionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: reasonSchema,
});

export const studentAttendanceQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const attendanceObjectIdSchema = objectIdSchema;
