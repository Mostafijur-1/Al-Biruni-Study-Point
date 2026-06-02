import type { SessionUser } from "@/types";
import { AuthError } from "@/lib/auth/session";

export function requireStudentClass(user: SessionUser) {
  if (user.role !== "student") {
    throw new AuthError("Forbidden.", 403);
  }

  if (!user.studentClass) {
    throw new AuthError("Your class is not set on your profile. Contact support.", 403);
  }

  return user.studentClass;
}
