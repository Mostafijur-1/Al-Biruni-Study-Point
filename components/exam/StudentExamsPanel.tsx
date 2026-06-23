"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  Calendar,
  Clock,
  FileQuestion,
  GraduationCap,
  Play,
  RefreshCw,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type StudentExam = {
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

type StudentExamsPanelProps = {
  };

export function StudentExamsPanel({}: StudentExamsPanelProps) {
  
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "completed">("available");

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError("");
      const { ok, payload } = await apiFetch<{ exams: StudentExam[] }>("/api/mcq/exams");
      if (ok && isApiSuccess(payload)) {
        setExams(payload.data.exams);
      } else {
        setError(getApiErrorMessage(payload, "Failed to load exams."));
      }
    } catch {
      setError("An error occurred connecting to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const availableExams = exams.filter((e) => !e.hasSubmitted);
  const completedExams = exams.filter((e) => e.hasSubmitted);

  const currentList = activeTab === "available" ? availableExams : completedExams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Student Portal</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {"শ্রেণীকক্ষ পরীক্ষা"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {"আপনার শিক্ষকের দেওয়া পরীক্ষাগুলোতে অংশ নিন।"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("available")}
          className={cn(
            "border-b-2 px-5 py-2.5 text-sm font-semibold transition cursor-pointer",
            activeTab === "available"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary"
          )}
        >
          {"চলমান পরীক্ষা"} ({availableExams.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={cn(
            "border-b-2 px-5 py-2.5 text-sm font-semibold transition cursor-pointer",
            activeTab === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary"
          )}
        >
          {"সম্পন্ন পরীক্ষা"} ({completedExams.length})
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border bg-card/40 p-5 space-y-4 shadow-[var(--shadow-sm)]"
            >
              <div className="h-6 w-1/2 rounded bg-secondary animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-secondary animate-pulse" />
              <div className="h-8 w-full rounded-xl bg-secondary animate-pulse mt-4" />
            </div>
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted">
          {activeTab === "available"
            ? "এই মুহূর্তে কোনো নতুন পরীক্ষা নেই।"
            : "আপনি এখনো কোনো পরীক্ষা সম্পন্ন করেননি।"}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {currentList.map((exam) => (
            <article
              key={exam._id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition duration-200"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
                    {exam.subject}
                  </span>
                  <span className="text-2xs text-muted font-bold flex items-center gap-1">
                    <Calendar className="size-3 text-muted" />
                    {new Date(exam.createdAt).toLocaleDateString("bn-BD", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <h2 className="font-display text-lg font-bold text-primary line-clamp-1">
                  {exam.title}
                </h2>

                <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                  <User className="size-3.5 text-accent" />
                  <span>{exam.teacherName}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-2xs font-semibold text-muted bg-surface/50 p-2.5 rounded-xl border border-border/40">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 text-primary" />
                    {exam.duration} {"মিনিট"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="size-3 text-brand-yellow" />
                    {exam.totalMarks} {"নম্বর"}
                  </span>
                  <span className="flex items-center gap-1 mt-1 col-span-2">
                    <FileQuestion className="size-3 text-brand-blue" />
                    {exam.questionCount} {"টি প্রশ্ন"}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                {activeTab === "available" ? (
                  <Link href={`/student/exams/${exam._id}`} className="block">
                    <Button className="w-full rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Play className="size-3.5 fill-current" />
                      {"পরীক্ষা শুরু করুন"}
                    </Button>
                  </Link>
                ) : (
                  <div className="space-y-2">
                    {exam.resultsPublished ? (
                      <Link href={"/student/results"} className="block">
                        <Button variant="outline" className="w-full rounded-xl py-2 text-xs font-bold border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 flex items-center justify-center gap-1.5">
                          <GraduationCap className="size-4" />
                          {"ফলাফল ও সমাধান দেখুন"}
                        </Button>
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-2xs font-bold text-amber-800">
                        {"ফলাফল প্রকাশের অপেক্ষায়"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
