export type UserRole = "admin" | "teacher" | "student";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CourseLevel = "SSC" | "HSC";

export type CourseSubject =
  | "Physics"
  | "Chemistry"
  | "Math"
  | "Higher Math"
  | "ICT";

export type RouteAccess = "public" | "guest" | "protected";

export type Permission =
  | "course:view"
  | "course:enroll"
  | "video:watch"
  | "mcq:take"
  | "cq:submit"
  | "mcq:create"
  | "video:upload"
  | "cq:review"
  | "student:manage"
  | "teacher:approve"
  | "course:manage"
  | "analytics:view"
  | "notes:upload";
