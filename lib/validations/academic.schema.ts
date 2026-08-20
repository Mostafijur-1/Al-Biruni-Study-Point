import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier.");
const studentClassSchema = z.enum(["class-9", "class-10", "class-11", "class-12"]);
const mutationReasonSchema = z.string().trim().min(4).max(500);

export const batchListQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  academicSessionId: objectIdSchema.optional(),
  studentClass: studentClassSchema.optional(),
  status: z.enum(["planned", "active", "closed", "archived"]).default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const batchCreateSchema = z
  .object({
    organizationId: objectIdSchema,
    branchId: objectIdSchema,
    academicSessionId: objectIdSchema,
    code: z.string().trim().min(2).max(30),
    name: z.string().trim().min(2).max(120),
    studentClass: studentClassSchema,
    capacity: z.coerce.number().int().min(1).max(500),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: mutationReasonSchema,
  })
  .refine((value) => value.startsAt < value.endsAt, {
    path: ["endsAt"],
    message: "Batch end date must be after its start date.",
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

export const enrollmentMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("enroll"),
    batchId: objectIdSchema,
    studentId: objectIdSchema,
    subjectIds: z.array(objectIdSchema).min(1).max(30).optional(),
    effectiveFrom: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
  z.object({
    action: z.literal("transfer"),
    enrollmentId: objectIdSchema,
    targetBatchId: objectIdSchema,
    subjectIds: z.array(objectIdSchema).min(1).max(30).optional(),
    effectiveAt: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
  z.object({
    action: z.literal("update-subjects"),
    enrollmentId: objectIdSchema,
    subjectIds: z.array(objectIdSchema).min(1).max(30),
    effectiveAt: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
  z.object({
    action: z.literal("withdraw"),
    enrollmentId: objectIdSchema,
    effectiveAt: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
]);

export const teacherAssignmentListQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  academicSessionId: objectIdSchema.optional(),
  batchId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  status: z.enum(["active", "ended", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const teacherAssignmentMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    batchId: objectIdSchema,
    teacherId: objectIdSchema,
    subjectId: objectIdSchema,
    effectiveFrom: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
  z.object({
    action: z.literal("end"),
    assignmentId: objectIdSchema,
    effectiveAt: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
]);

export const routineListQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  academicSessionId: objectIdSchema.optional(),
  batchId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  status: z.enum(["active", "ended"]).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const routineMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      assignmentId: objectIdSchema,
      teacherId: objectIdSchema.optional(),
      subject: z.string().trim().min(1).max(100).optional(),
      weekday: z.coerce.number().int().min(0).max(6),
      startMinute: z.coerce.number().int().min(0).max(1439),
      endMinute: z.coerce.number().int().min(1).max(1440),
      room: z.string().trim().min(1).max(80).optional(),
      effectiveFrom: z.coerce.date().optional(),
      effectiveTo: z.coerce.date().optional(),
      reason: mutationReasonSchema,
    })
    .refine((value) => value.startMinute < value.endMinute, {
      path: ["endMinute"],
      message: "Routine end time must be after its start time.",
    })
    .refine((value) => !value.effectiveTo || !value.effectiveFrom || value.effectiveFrom <= value.effectiveTo, {
      path: ["effectiveTo"],
      message: "Routine end date cannot precede its start date.",
    }),
  z
    .object({
      action: z.literal("update"),
      routineSlotId: objectIdSchema,
      assignmentId: objectIdSchema,
      teacherId: objectIdSchema.optional(),
      subject: z.string().trim().min(1).max(100).optional(),
      weekday: z.coerce.number().int().min(0).max(6),
      startMinute: z.coerce.number().int().min(0).max(1439),
      endMinute: z.coerce.number().int().min(1).max(1440),
      room: z.string().trim().min(1).max(80).optional(),
      effectiveFrom: z.coerce.date().optional(),
      effectiveTo: z.coerce.date().optional(),
      reason: mutationReasonSchema,
    })
    .refine((value) => value.startMinute < value.endMinute, { path: ["endMinute"], message: "Routine end time must be after its start time." })
    .refine((value) => !value.effectiveTo || !value.effectiveFrom || value.effectiveFrom <= value.effectiveTo, { path: ["effectiveTo"], message: "Routine end date cannot precede its start date." }),
  z.object({
    action: z.literal("end"),
    routineSlotId: objectIdSchema,
    effectiveAt: z.coerce.date().optional(),
    reason: mutationReasonSchema,
  }),
]);

export const classSessionListQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  academicSessionId: objectIdSchema.optional(),
  batchId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const classSessionMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      assignmentId: objectIdSchema,
      routineSlotId: objectIdSchema.optional(),
      scheduledStart: z.coerce.date(),
      scheduledEnd: z.coerce.date(),
      reason: mutationReasonSchema,
    })
    .refine((value) => value.scheduledStart < value.scheduledEnd, {
      path: ["scheduledEnd"],
      message: "Class session end time must be after its start time.",
    }),
  z.object({
    action: z.enum(["complete", "cancel"]),
    classSessionId: objectIdSchema,
    reason: mutationReasonSchema,
  }),
]);
