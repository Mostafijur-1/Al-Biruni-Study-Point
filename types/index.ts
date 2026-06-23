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
  | "Higher Math 2nd Paper"
  | "পদার্থবিজ্ঞান"
  | "রসায়ন"
  | "সাধারণ গণিত"
  | "উচ্চতর গণিত"
  | "জীববিজ্ঞান"
  | "তথ্য ও যোগাযোগ প্রযুক্তি"
  | "বাংলা ১ম পত্র"
  | "বাংলা ২য় পত্র"
  | "ইংরেজি ১ম পত্র"
  | "ইংরেজি ২য় পত্র"
  | "ইসলাম ও নৈতিক শিক্ষা"
  | "বাংলাদেশ ও বিশ্বপরিচয়"
  | "পদার্থবিজ্ঞান ১ম পত্র"
  | "পদার্থবিজ্ঞান ২য় পত্র"
  | "রসায়ন ১ম পত্র"
  | "রসায়ন ২য় পত্র"
  | "উচ্চতর গণিত ১ম পত্র"
  | "উচ্চতর গণিত ২য় পত্র"
  | "জীববিজ্ঞান ১ম পত্র"
  | "জীববিজ্ঞান ২য় পত্র";

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
