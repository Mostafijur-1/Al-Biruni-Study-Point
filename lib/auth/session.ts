import type { UserRole } from "@/types";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
};
