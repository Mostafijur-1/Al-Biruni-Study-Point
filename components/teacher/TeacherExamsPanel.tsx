"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  Clock,
  Eye,
  EyeOff,
  FileQuestion,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";

import { cn } from "@/lib/utils";

type ExamInfo = {
  _id: string;
  title: string;
  subject: string;
  duration: number;
  totalMarks: number;
  passMark: number;
  targetClasses: string[];
  isPublished: boolean;
  resultsPublished: boolean;
  questionCount: number;
  createdAt: string;
};

type TeacherExamsPanelProps = {
  };

export function TeacherExamsPanel() {
    
  const [exams, setExams] = useState<ExamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Exam Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(30);
  const [totalMarks, setTotalMarks] = useState(25);
  const [passMark, setPassMark] = useState(15);
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError("");
      const { ok, payload } = await apiFetch<{ exams: ExamInfo[] }>("/api/teacher/exams");
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

  const [allowedSubjects, setAllowedSubjects] = useState<string[]>([]);

  useEffect(() => {
    fetchExams();

    async function loadAllowedSubjects() {
      try {
        const { ok, payload } = await apiFetch<{ subjects: { subject: string }[] }>("/api/teacher/subjects");
        if (ok && isApiSuccess(payload)) {
          const subjectNames = Array.from(new Set(payload.data.subjects.map((s) => s.subject)));
          setAllowedSubjects(subjectNames);
        }
      } catch (err) {
        console.error("Failed to load allowed subjects:", err);
      }
    }
    loadAllowedSubjects();
  }, []);

  const handleTogglePublish = async (id: string, type: "exam" | "results", currentValue: boolean) => {
    try {
      const { ok, payload } = await apiFetch<{ exam: ExamInfo }>(`/api/teacher/exams/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value: !currentValue }),
      });

      if (ok && isApiSuccess(payload)) {
        setExams((prev) =>
          prev.map((e) => (e._id === id ? { ...e, ...payload.data.exam } : e))
        );
      } else {
        alert(getApiErrorMessage(payload, "Failed to update status."));
      }
    } catch {
      alert("Error updating exam status.");
    }
  };

  const handleDelete = async (id: string) => {
    const msg = "আপনি কি নিশ্চিত যে এই পরীক্ষাটি এবং এর সকল প্রশ্ন ও ফলাফল মুছে ফেলতে চান?";
    if (!confirm(msg)) return;

    try {
      const { ok, payload } = await apiFetch(`/api/teacher/exams/${id}`, {
        method: "DELETE",
      });

      if (ok && isApiSuccess(payload)) {
        setExams((prev) => prev.filter((e) => e._id !== id));
      } else {
        alert(getApiErrorMessage(payload, "Failed to delete exam."));
      }
    } catch {
      alert("Error deleting exam.");
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || targetClasses.length === 0) {
      setFormError("সকল ফিল্ড পূরণ করুন।");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const { ok, payload } = await apiFetch<{ exam: ExamInfo }>("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          duration,
          totalMarks,
          passMark,
          targetClasses,
        }),
      });

      if (ok && isApiSuccess(payload)) {
        setExams((prev) => [payload.data.exam, ...prev]);
        setIsModalOpen(false);
        // Reset form
        setTitle("");
        setSubject("");
        setDuration(30);
        setTotalMarks(25);
        setPassMark(15);
        setTargetClasses([]);
      } else {
        setFormError(getApiErrorMessage(payload, "Failed to create exam."));
      }
    } catch {
      setFormError("Error creating exam.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleClass = (cls: string) => {
    setTargetClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Teacher panel</p>
          <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
            MCQ Exam Management
          </h1>
          <p className="mt-2 text-sm text-muted">
            {"শিক্ষার্থীদের জন্য পরীক্ষা সেট করুন এবং সমাধান ও ফলাফল প্রকাশ করুন।"}
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl font-bold"
        >
          <Plus className="size-4" />
          {"নতুন পরীক্ষা সেট করুন"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
          {"আপনার তৈরি কোনো পরীক্ষা নেই।"}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <article
              key={exam._id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition duration-200"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
                    {exam.subject}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDelete(exam._id)}
                      className="p-1 rounded-lg hover:bg-red-50 text-muted hover:text-brand-red transition cursor-pointer"
                      title="Delete Exam"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <h2 className="font-display text-lg font-bold text-primary line-clamp-1">
                  {exam.title}
                </h2>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-primary" />
                    {exam.duration}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="size-3.5 text-brand-yellow" />
                    {exam.totalMarks} marks (Pass: {exam.passMark})
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5 text-accent" />
                    {exam.targetClasses.join(", ")}
                  </span>
                </div>

                <div className="rounded-xl border border-border/60 bg-surface/50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-muted">প্রশ্ন যুক্ত করা হয়েছে</span>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                      {exam.questionCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <Link href={`/teacher/exams/${exam._id}`} className="block">
                  <Button variant="outline" className="w-full rounded-xl py-2 text-xs font-bold">
                    <FileQuestion className="mr-1.5 size-4" />
                    {"প্রশ্ন আপলোড ও রেজাল্ট দেখুন"}
                  </Button>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTogglePublish(exam._id, "exam", exam.isPublished)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-xl border py-2 text-2xs font-bold transition cursor-pointer",
                      exam.isPublished
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "border-border bg-surface text-muted hover:bg-secondary/40"
                    )}
                  >
                    {exam.isPublished ? (
                      <>
                        <Eye className="size-3.5 shrink-0" />
                        <span>Exam Live</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3.5 shrink-0" />
                        <span>Exam Hidden</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleTogglePublish(exam._id, "results", exam.resultsPublished)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-xl border py-2 text-2xs font-bold transition cursor-pointer",
                      exam.resultsPublished
                        ? "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100"
                        : "border-border bg-surface text-muted hover:bg-secondary/40"
                    )}
                  >
                    {exam.resultsPublished ? (
                      <>
                        <Eye className="size-3.5 shrink-0" />
                        <span>Results Public</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3.5 shrink-0" />
                        <span>Results Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Exam Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h2 className="font-display text-lg font-bold text-primary">
                {"নতুন পরীক্ষা সেট করুন"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-primary transition font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="exam-title">Exam Title</Label>
                <Input
                  id="exam-title"
                  placeholder="e.g. Physics Class 11 Midterm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exam-subject">Subject</Label>
                <select
                  id="exam-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                  required
                >
                  <option value="">-- Select Subject --</option>
                  {allowedSubjects.map((subName) => (
                    <option key={subName} value={subName}>
                      {subName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-duration">Duration (m)</Label>
                  <input
                    id="exam-duration"
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exam-marks">Total Marks</Label>
                  <input
                    id="exam-marks"
                    type="number"
                    min={1}
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exam-pass">Pass Mark</Label>
                  <input
                    id="exam-pass"
                    type="number"
                    min={1}
                    value={passMark}
                    onChange={(e) => setPassMark(Number(e.target.value))}
                    className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Target Classes</Label>
                <div className="flex flex-wrap gap-4">
                  {["class-9", "class-10", "class-11", "class-12"].map((cls) => (
                    <label key={cls} className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetClasses.includes(cls)}
                        onChange={() => toggleClass(cls)}
                        className="rounded border-border text-primary focus:ring-primary size-4"
                      />
                      <span>{cls.replace("class-", "Class ")}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/80">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  className="rounded-xl font-bold"
                >
                  Create Exam
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
