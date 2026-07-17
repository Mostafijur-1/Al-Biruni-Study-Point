import { create } from "zustand";
import type { StudentClass } from "@/types";

export type CachedPracticeStatus = {
  subject: string;
  chapters: Array<{ name: string; hasMcqs: boolean }>;
  lastResult: {
    score: number;
    totalQuestions: number;
    percentage: number;
    isPassed: boolean;
    timeTaken: number;
    submittedAt: string;
  } | null;
  teacherName?: string | null;
};

type PracticeStatusCacheValue =
  | CachedPracticeStatus[]
  | {
      status: CachedPracticeStatus[];
      settings?: { secondsPerQuestion: number; passMarkPercent: number };
    };

type CachedCourse = {
  _id: string;
  title: string;
  titleBn?: string;
  subject: string;
  level: string;
  targetClasses: StudentClass[];
};

type CachedVideo = {
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;
  targetClasses: StudentClass[];
};

type CachedStudentExam = {
  _id: string;
  title: string;
  subject: string;
  duration: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
  hasSubmitted: boolean;
  teacherName: string;
  resultsPublished: boolean;
  createdAt: string;
};

interface AppState {
  // Practice Status Cache
  practiceStatusCache: Record<string, PracticeStatusCacheValue>;
  setPracticeStatusCache: (key: string, data: PracticeStatusCacheValue) => void;

  // Classroom Courses & Videos Cache
  coursesCache: Record<string, CachedCourse[]>;
  videosCache: Record<string, CachedVideo[]>;
  setCoursesCache: (key: string, data: CachedCourse[]) => void;
  setVideosCache: (key: string, data: CachedVideo[]) => void;

  // Classroom Exams Cache
  examsCache: CachedStudentExam[] | null;
  setExamsCache: (data: CachedStudentExam[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  practiceStatusCache: {},
  setPracticeStatusCache: (key, data) =>
    set((state) => ({
      practiceStatusCache: { ...state.practiceStatusCache, [key]: data },
    })),

  coursesCache: {},
  videosCache: {},
  setCoursesCache: (key, data) =>
    set((state) => ({
      coursesCache: { ...state.coursesCache, [key]: data },
    })),
  setVideosCache: (key, data) =>
    set((state) => ({
      videosCache: { ...state.videosCache, [key]: data },
    })),

  examsCache: null,
  setExamsCache: (data) => set({ examsCache: data }),
}));
