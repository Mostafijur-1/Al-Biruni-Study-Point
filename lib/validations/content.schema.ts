import { z } from "zod";

import { studentClassSchema } from "@/lib/validations/auth.schema";

export const targetClassesSchema = z
  .array(studentClassSchema)
  .min(1, "Select at least one target class.");
