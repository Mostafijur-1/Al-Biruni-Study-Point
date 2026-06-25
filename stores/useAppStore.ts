import { create } from "zustand";

interface AppState {
  // Practice Status Cache
  practiceStatusCache: Record<string, any>;
  setPracticeStatusCache: (key: string, data: any) => void;

  // Classroom Courses & Videos Cache
  coursesCache: Record<string, any>;
  videosCache: Record<string, any>;
  setCoursesCache: (key: string, data: any) => void;
  setVideosCache: (key: string, data: any) => void;

  // Classroom Exams Cache
  examsCache: any;
  setExamsCache: (data: any) => void;
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
