export type UserRole = "admin" | "teacher" | "student";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type StudentClass = "class-9" | "class-10" | "class-11" | "class-12";

export type SessionUser = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  studentClass?: StudentClass;
  schoolCollege?: string;
  reference?: string;
  teacherUsage?: {
    imageQuestionUploadMonth: string;
    imageQuestionUploadCount: number;
    monthlyChargeTk: number;
    chargeCycleStartedAt?: string;
    chargeDueAt?: string;
    lastChargeRefreshedAt?: string;
    isChargeExpired?: boolean;
  };
};

export type CourseLevel = "SSC" | "HSC";

export type CourseSubject =
  | "Physics"
  | "Chemistry"
  | "Math"
  | "Higher Math"
  | "ICT"
  | "Physics 1st Paper"
  | "Physics 2nd Paper"
  | "Chemistry 1st Paper"
  | "Chemistry 2nd Paper"
  | "Higher Math 1st Paper"
  | "Higher Math 2nd Paper";

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
