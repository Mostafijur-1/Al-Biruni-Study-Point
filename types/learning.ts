export type LearningPlanTask = {
  id: string;
  type: "mistake_review" | "chapter_practice" | "video";
  title: string;
  description: string;
  href: string;
  estimatedMinutes: number;
  progressPercent?: number;
};

export type LearningPlanData = {
  tasks: LearningPlanTask[];
  dueMistakes: number;
  recommendation?: {
    subject: string;
    chapter: string;
    score: number;
    status: "not_started" | "weak" | "improving" | "strong";
  };
  generatedAt: string;
};

export type ChapterMasteryData = {
  subject: string;
  chapter: string;
  score: number;
  status: "not_started" | "weak" | "improving" | "strong";
  attempts: number;
  correctAnswers: number;
  accuracy: number;
  availableQuestions: number;
  lastPracticedAt?: string;
};

export type MasteryData = {
  chapters: ChapterMasteryData[];
  subjects: Array<{
    subject: string;
    score: number;
    completedChapters: number;
    totalChapters: number;
  }>;
  recommendation?: ChapterMasteryData;
};
