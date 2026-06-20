"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Trash2, User, Edit, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  // Edit MCQ States
  const [editingMcq, setEditingMcq] = useState<PendingMCQ | null>(null);
  const [editForm, setEditForm] = useState({
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    imageUrl: "",
    level: "ssc" as "ssc" | "hsc",
    subject: "",
    chapter: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  async function fetchPendingQuestions() {
    try {
      setLoading(true);
      setError("");
      setSelectedIds([]);
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
        setSelectedIds((prev) => prev.filter((item) => item !== id));
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
        setSelectedIds((prev) => prev.filter((item) => item !== id));
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

  // Bulk Select Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(questions.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  async function handleBulkApprove() {
    if (selectedIds.length === 0) return;
    setBulkApproving(true);
    setError("");
    setSuccess("");
    try {
      const { ok, payload } = await apiFetch<{ modifiedCount: number }>("/api/admin/teacher-mcqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (ok && isApiSuccess(payload)) {
        setSuccess(
          locale === "bn"
            ? `সফলভাবে ${selectedIds.length}টি প্রশ্ন অনুমোদন করা হয়েছে!`
            : `Successfully approved ${selectedIds.length} questions!`
        );
        const approvedSet = new Set(selectedIds);
        setQuestions((prev) => prev.filter((q) => !approvedSet.has(q.id)));
        setSelectedIds([]);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(getApiErrorMessage(payload, "Failed to approve selected questions."));
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setBulkApproving(false);
    }
  }

  // Edit MCQ Handlers
  const handleOpenEdit = (q: PendingMCQ) => {
    setEditingMcq(q);
    setEditForm({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      imageUrl: q.imageUrl || "",
      level: q.level,
      subject: q.subject,
      chapter: q.chapter,
    });
    setEditError("");
    setImageError("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setImageError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setEditForm((prev) => ({ ...prev, imageUrl: data.data.url }));
      } else {
        setImageError(data.error?.message || "Failed to upload image.");
      }
    } catch {
      setImageError("Network error uploading image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMcq) return;
    if (!editForm.question.trim()) {
      setEditError("Question text is required.");
      return;
    }
    if (editForm.options.some((o) => !o.trim())) {
      setEditError("All 4 options must be filled.");
      return;
    }
    if (!editForm.subject.trim()) {
      setEditError("Subject is required.");
      return;
    }
    if (!editForm.chapter.trim()) {
      setEditError("Chapter is required.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    try {
      const { ok, payload } = await apiFetch<{ question: any }>(
        `/api/admin/teacher-mcqs/${editingMcq.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );
      if (ok && isApiSuccess(payload)) {
        const updated = payload.data.question;
        setQuestions((prev) =>
          prev.map((item) =>
            item.id === editingMcq.id
              ? {
                  ...item,
                  question: updated.question,
                  options: updated.options,
                  correctIndex: updated.correctIndex,
                  explanation: updated.explanation,
                  imageUrl: updated.imageUrl,
                  level: updated.level,
                  subject: updated.subject,
                  chapter: updated.chapter,
                }
              : item
          )
        );
        setEditingMcq(null);
        setSuccess(locale === "bn" ? "প্রশ্নটি সফলভাবে এডিট করা হয়েছে।" : "Question edited successfully.");
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setEditError(getApiErrorMessage(payload, "Failed to save edits."));
      }
    } catch {
      setEditError("Error connecting to server.");
    } finally {
      setSavingEdit(false);
    }
  };

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
          {/* Bulk Selection Bar */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="select-all-pending"
                checked={selectedIds.length === questions.length && questions.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
              />
              <label htmlFor="select-all-pending" className="text-sm font-bold text-primary cursor-pointer select-none">
                {locale === "bn" ? `সব নির্বাচন করুন (${questions.length})` : `Select All (${questions.length})`}
              </label>
            </div>
            <Button
              onClick={handleBulkApprove}
              disabled={selectedIds.length === 0 || bulkApproving}
              loading={bulkApproving}
              className="rounded-xl font-bold py-2 px-5"
            >
              {locale === "bn" ? `নির্বাচিতগুলো অনুমোদন করুন (${selectedIds.length})` : `Approve Selected (${selectedIds.length})`}
            </Button>
          </div>

          {/* Questions list */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <article
                key={q.id}
                className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-4"
              >
                {/* Card Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={(e) => handleSelectOne(q.id, e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer mr-1"
                    />
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
                <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(q)}
                    className="text-muted hover:text-primary hover:bg-secondary flex items-center gap-1.5"
                  >
                    <Edit className="size-4" />
                    {locale === "bn" ? "সম্পাদনা করুন" : "Edit Question"}
                  </Button>
                  <div className="flex gap-2.5 ml-auto">
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
                      {locale === "bn" ? "অনুমোদন করুন" : "Approve & Add"}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- ADMIN EDIT MCQ MODAL --- */}
      {editingMcq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base md:text-lg font-bold text-primary">
                {locale === "bn" ? "প্রশ্ন সম্পাদনা" : "Edit MCQ Question"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMcq(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-primary transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {editError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Level, Subject, Chapter metadata */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-level" className="font-bold">Level</Label>
                  <select
                    id="edit-level"
                    value={editForm.level}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, level: e.target.value as "ssc" | "hsc" }))}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary transition"
                  >
                    <option value="ssc">SSC</option>
                    <option value="hsc">HSC</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-subject" className="font-bold">Subject</Label>
                  <input
                    type="text"
                    id="edit-subject"
                    value={editForm.subject}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary transition"
                    placeholder="Subject..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-chapter" className="font-bold">Chapter (key)</Label>
                  <input
                    type="text"
                    id="edit-chapter"
                    value={editForm.chapter}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, chapter: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary transition"
                    placeholder="Chapter key (e.g. physics-ch1)..."
                  />
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-question" className="font-bold">Question Text</Label>
                <textarea
                  id="edit-question"
                  rows={2}
                  value={editForm.question}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, question: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  placeholder="Enter the question..."
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label className="font-bold">Question Illustration (Image)</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="relative">
                      <input
                        type="file"
                        id="edit-image-file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="edit-image-file"
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold cursor-pointer hover:border-primary hover:bg-secondary/20 transition-all",
                          isUploadingImage && "pointer-events-none opacity-60"
                        )}
                      >
                        {isUploadingImage ? (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        ) : (
                          <ImageIcon className="size-4 text-muted-foreground" />
                        )}
                        <span>{isUploadingImage ? "Uploading..." : "Choose File"}</span>
                      </label>
                    </div>
                    {imageError && <p className="text-[10px] text-brand-red font-semibold">{imageError}</p>}
                  </div>

                  {editForm.imageUrl && (
                    <div className="relative size-20 rounded-lg border border-border bg-secondary/10 overflow-hidden shrink-0 group">
                      <img src={editForm.imageUrl} alt="Preview" className="size-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, imageUrl: "" }))}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 text-white rounded-lg"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="grid gap-3 sm:grid-cols-2">
                {editForm.options.map((opt, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <Label htmlFor={`option-${idx}`} className="font-bold">
                      Option {OPTION_BADGES[idx]}
                    </Label>
                    <input
                      type="text"
                      id={`option-${idx}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...editForm.options];
                        newOpts[idx] = e.target.value;
                        setEditForm((prev) => ({ ...prev, options: newOpts }));
                      }}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary transition"
                      placeholder={`Option ${OPTION_BADGES[idx]}`}
                    />
                  </div>
                ))}
              </div>

              {/* Correct Option */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-correct-index" className="font-bold">Correct Answer</Label>
                <select
                  id="edit-correct-index"
                  value={editForm.correctIndex}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, correctIndex: parseInt(e.target.value) }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary transition"
                >
                  {OPTION_BADGES.map((badge, idx) => (
                    <option key={idx} value={idx}>
                      Option {badge}
                    </option>
                  ))}
                </select>
              </div>

              {/* Explanation */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-explanation" className="font-bold">Explanation</Label>
                <textarea
                  id="edit-explanation"
                  rows={2}
                  value={editForm.explanation}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, explanation: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary transition"
                  placeholder="Explain why this option is correct..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingMcq(null)}
                disabled={savingEdit}
                className="rounded-xl px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                loading={savingEdit}
                disabled={isUploadingImage}
                className="rounded-xl px-5 py-2"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
