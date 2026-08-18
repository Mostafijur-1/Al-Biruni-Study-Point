"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Clock3,
  NotebookPen,
  PlayCircle,
  Sparkles,
} from "lucide-react";

import { apiFetch, isApiSuccess } from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";
import type { LearningPlanData, LearningPlanTask } from "@/types/learning";

const taskTheme: Record<
  LearningPlanTask["type"],
  {
    icon: typeof Brain;
    tone: string;
  }
> = {
  mistake_review: {
    icon: NotebookPen,
    tone: "bg-rose-100 text-rose-700",
  },
  chapter_practice: {
    icon: Brain,
    tone: "bg-violet-100 text-violet-700",
  },
  video: {
    icon: PlayCircle,
    tone: "bg-sky-100 text-sky-700",
  },
};

export function DailyLearningPlanCard({ compact = false }: { compact?: boolean }) {
  const [plan, setPlan] = useState<LearningPlanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { ok, payload } = await apiFetch<LearningPlanData>("/api/learning/plan");
      if (active && ok && isApiSuccess(payload)) setPlan(payload.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-secondary/60" />;
  }
  if (!plan || plan.tasks.length === 0) return null;

  const tasks = compact ? plan.tasks.slice(0, 3) : plan.tasks;

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 via-card to-sky-50/70 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-violet-700">
            <Sparkles className="size-4" />
            ব্যক্তিগত দৈনিক প্ল্যাও
          </div>
          <h2 className="mt-1 text-lg font-black text-primary">
            আজ এই {tasks.length}টি ছোট কাজ শেষ করো
          </h2>
        </div>
        {compact && (
          <Link
            href="/student/learning"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            বিস্তারিত
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className={cn("grid gap-3 p-4", !compact && "lg:grid-cols-3")}>
        {tasks.map((task, index) => {
          const theme = taskTheme[task.type];
          const Icon = theme.icon;
          return (
            <Link
              key={task.id}
              href={task.href}
              onClick={() =>
                trackStudentEvent("student_learning_task_clicked", "daily_plan", {
                  task_type: task.type,
                  task_id: task.id,
                })
              }
              className="group flex items-start gap-3 rounded-xl border border-white/80 bg-white/80 p-3.5 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[var(--shadow-sm)]"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  theme.tone,
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-2xs font-black text-muted">
                  কাজ {index + 1}
                </span>
                <span className="mt-0.5 block text-sm font-black text-primary">
                  {task.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
                  {task.description}
                </span>
                <span className="mt-2 flex items-center gap-1 text-2xs font-bold text-violet-700">
                  <Clock3 className="size-3" />
                  প্রায় {task.estimatedMinutes} মিনিট
                </span>
              </span>
              <ArrowRight className="mt-2 size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
