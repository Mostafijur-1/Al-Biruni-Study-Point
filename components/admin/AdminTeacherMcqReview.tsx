"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { getTranslatedChapter } from "@/lib/content/syllabus";
import { cn } from "@/lib/utils";

type PendingMCQ = {
  id: string;
  level: "ssc" | "hsc";
  subject: string;
  chapter: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
};

const OPTION_BADGES = ["A", "B", "C", "D"];

export function AdminTeacherMcqReview({ locale }: { locale: string }) {
  const [questions, setQuestions] = useState<PendingMCQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchPendingQuestions() {
    try {
      setLoading(true);
      setError("");
      const { ok, payload } = await apiFetch<{ questions: PendingMCQ[] }>("/api/admin/teacher-mcqs");
      if (ok && isApiSuccess(payload)) {
        setQuestions(payload.data.questions);
      } else {
        setError(getApiErrorMessage(payload, "Failed to load pending questions."));
      }
    } catch {
      setError("An unexpected error occurred while connecting to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingQuestions();
  }, []);

  async function handleApprove(id: string) {
    setActionId(id);
    setError("");
    setSuccess("");
    try {
      const { ok, payload } = await apiFetch(`/api/admin/teacher-mcqs/${id}`, {
        method: "PATCH",
      });
      if (ok && isApiSuccess(payload)) {
        setSuccess(locale === "bn" ? "প্রশ্নটি সফলভাবে সাধারণ পুলে যুক্ত করা হয়েছে।" : "Question approved and added to general pool!");
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(getApiErrorMessage(payload, "Failed to approve question."));
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(locale === "bn" ? "আপনি কি নিশ্চিত যে এই প্রশ্নটি মুছে ফেলতে চান?" : "Are you sure you want to delete this question?")) return;

    setActionId(id);
    setError("");
    setSuccess("");
    try {
      const { ok, payload } = await apiFetch(`/api/admin/teacher-mcqs/${id}`, {
        method: "DELETE",
      });
      if (ok && isApiSuccess(payload)) {
        setSuccess(locale === "bn" ? "প্রশ্নটি সফলভাবে মুছে ফেলা হয়েছে।" : "Question deleted successfully.");
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(getApiErrorMessage(payload, "Failed to delete question."));
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <span>{locale === "bn" ? "অপেক্ষমান প্রশ্নসমূহ লোড হচ্ছে..." : "Loading pending questions..."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">
            {locale === "bn" ? "শিক্ষকদের তৈরি প্রশ্নাবলী রিভিউ" : "Review Teacher MCQs"}
          </h2>
          <p className="text-xs text-muted">
            {locale === "bn"
              ? `অপেক্ষমান মোট প্রশ্ন: ${questions.length}টি`
              : `Total pending questions: ${questions.length}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPendingQuestions}>
          {locale === "bn" ? "রিফ্রেশ" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground text-sm">
          {locale === "bn"
            ? "রিভিউ করার জন্য শিক্ষকদের তৈরি কোনো প্রশ্ন নেই।"
            : "No pending teacher questions to review. All caught up!"}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <article
              key={q.id}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-4"
            >
              {/* Card Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-bold uppercase text-primary tracking-wide">
                    {q.level.toUpperCase()}
                  </span>
                  <span className="font-semibold text-foreground/80">{q.subject}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground font-medium">
                    {getTranslatedChapter(q.chapter, locale)}
                  </span>
                </div>
                {q.createdBy && (
                  <div className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 dark:bg-amber-950/20 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200/50">
                    <User className="size-3" />
                    <span>{q.createdBy.name}</span>
                  </div>
                )}
              </div>

              {/* Question Text */}
              <div className="flex items-start gap-2.5">
                <span className="grid size-6 place-items-center rounded bg-secondary text-muted-foreground text-[11px] font-bold shrink-0">
                  {idx + 1}
                </span>
                <h4 className="text-base font-bold text-foreground pt-0.5 leading-snug">
                  {q.question}
                </h4>
              </div>

              {/* Question Image */}
              {q.imageUrl && (
                <img
                  src={q.imageUrl}
                  alt="Illustration"
                  className="max-w-full max-h-48 rounded object-contain border border-border/60 bg-muted/20"
                />
              )}

              {/* Options list */}
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oIdx) => {
                  const isCorrect = oIdx === q.correctIndex;
                  return (
                    <div
                      key={oIdx}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        isCorrect
                          ? "border-emerald-300 bg-emerald-50/50 text-emerald-800 font-bold"
                          : "border-border text-muted-foreground bg-secondary/10"
                      )}
                    >
                      <span className="size-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {OPTION_BADGES[oIdx]}
                      </span>
                      <span>{opt}</span>
                      {isCorrect && <Check className="size-4 shrink-0 ml-auto text-emerald-700" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="text-xs text-muted-foreground border-t border-border pt-2">
                  <strong className="font-semibold">Explanation:</strong> {q.explanation}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(q.id)}
                  loading={actionId === q.id}
                  disabled={actionId !== null}
                  className="text-brand-red border-red-100 hover:bg-red-50 hover:text-brand-red"
                >
                  <Trash2 className="size-4 mr-1.5" />
                  {locale === "bn" ? "বাতিল করুন" : "Reject & Delete"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(q.id)}
                  loading={actionId === q.id}
                  disabled={actionId !== null}
                >
                  <Check className="size-4 mr-1.5" />
                  {locale === "bn" ? "অনুমোদন করুন" : "Approve & Add to Pool"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
