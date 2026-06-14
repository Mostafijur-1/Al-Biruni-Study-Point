"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Edit,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { getTranslatedChapter } from "@/lib/content/syllabus";

type MCQQuestion = {
  _id: string;
  level: "ssc" | "hsc";
  subject: string;
  chapter: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
};

type ReportedQuestion = {
  _id: string;
  questionId: MCQQuestion | null;
  studentId: {
    _id: string;
    name: string;
    email?: string;
  } | null;
  comment: string;
  resolved: boolean;
  createdAt: string;
};

type SubjectInfo = {
  level: "ssc" | "hsc";
  subject: string;
  chapters: string[];
};

type TeacherMcqReviewProps = {
  locale: string;
};

export function TeacherMcqReview({ locale }: TeacherMcqReviewProps) {
  const [activeTab, setActiveTab] = useState<"browse" | "reports">("browse");

  // Domain subjects/chapters
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  
  // MCQ List by Chapter
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [loadingMcqs, setLoadingMcqs] = useState(false);

  // Local chapter search state
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");

  // Reported MCQ states
  const [reports, setReports] = useState<ReportedQuestion[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Editing modal states
  const [editingMcq, setEditingMcq] = useState<MCQQuestion | null>(null);
  const [editForm, setEditForm] = useState({
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    imageUrl: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Load domain subjects
  useEffect(() => {
    async function fetchSubjects() {
      try {
        setLoadingSubjects(true);
        const { ok, payload } = await apiFetch<{ subjects: SubjectInfo[] }>("/api/teacher/subjects");
        if (ok && isApiSuccess(payload)) {
          setSubjects(payload.data.subjects);
        } else {
          setErrorMessage(getApiErrorMessage(payload, "Failed to load subjects."));
        }
      } catch {
        setErrorMessage("An error occurred fetching subjects.");
      } finally {
        setLoadingSubjects(false);
      }
    }
    fetchSubjects();
  }, []);

  // Fetch MCQs when a chapter is expanded
  const fetchChapterMcqs = useCallback(async (level: string, subject: string, chapter: string) => {
    try {
      setLoadingMcqs(true);
      setMcqs([]);
      setChapterSearchQuery("");
      const url = `/api/teacher/mcqs?level=${level}&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`;
      const { ok, payload } = await apiFetch<{ questions: MCQQuestion[] }>(url);
      if (ok && isApiSuccess(payload)) {
        setMcqs(payload.data.questions);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to load questions."));
      }
    } catch {
      setErrorMessage("An error occurred loading questions.");
    } finally {
      setLoadingMcqs(false);
    }
  }, []);

  // Fetch Reports
  const fetchReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const { ok, payload } = await apiFetch<{ reports: ReportedQuestion[] }>("/api/teacher/reports");
      if (ok && isApiSuccess(payload)) {
        setReports(payload.data.reports);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to load reported questions."));
      }
    } catch {
      setErrorMessage("An error occurred fetching reports.");
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "reports") {
      fetchReports();
    }
  }, [activeTab, fetchReports]);

  // Delete MCQ
  const handleDeleteMcq = async (id: string) => {
    if (!confirm(locale === "bn" ? "আপনি কি নিশ্চিত যে এই প্রশ্নটি মুছে ফেলতে চান?" : "Are you sure you want to delete this question?")) return;

    try {
      const { ok, payload } = await apiFetch(`/api/teacher/mcqs/${id}`, {
        method: "DELETE",
      });

      if (ok && isApiSuccess(payload)) {
        setSuccessMessage(locale === "bn" ? "প্রশ্নটি সফলভাবে মুছে ফেলা হয়েছে।" : "Question deleted successfully.");
        // Remove from list
        setMcqs((prev) => prev.filter((q) => q._id !== id));
        setReports((prev) => prev.filter((r) => r.questionId?._id !== id));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to delete question."));
      }
    } catch {
      setErrorMessage("An error occurred deleting the question.");
    }
  };

  // Open edit modal
  const openEditModal = (mcq: MCQQuestion) => {
    setEditingMcq(mcq);
    setEditForm({
      question: mcq.question,
      options: [...mcq.options],
      correctIndex: mcq.correctIndex,
      explanation: mcq.explanation || "",
      imageUrl: mcq.imageUrl || "",
    });
    setEditError("");
    setImageError("");
  };

  // Image upload handler
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
      const result = await response.json();
      if (response.ok && result.success) {
        setEditForm((prev) => ({ ...prev, imageUrl: result.data.url }));
      } else {
        setImageError(result.message || "Failed to upload image.");
      }
    } catch {
      setImageError("Error uploading image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save edited MCQ
  const handleSaveEdit = async () => {
    if (!editingMcq) return;

    if (!editForm.question.trim()) {
      setEditError("Question is required.");
      return;
    }

    if (editForm.options.some((o) => !o.trim())) {
      setEditError("All 4 options must be filled.");
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError("");

      const { ok, payload } = await apiFetch<{ question: MCQQuestion }>(
        `/api/teacher/mcqs/${editingMcq._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );

      if (ok && isApiSuccess(payload)) {
        const updated = payload.data.question;
        
        // Update lists
        setMcqs((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
        setReports((prev) => prev.filter((r) => r.questionId?._id !== updated._id)); // remove report since it's edited and resolved
        
        setSuccessMessage(locale === "bn" ? "প্রশ্নটি সফলভাবে আপডেট করা হয়েছে।" : "Question updated successfully.");
        setEditingMcq(null);
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setEditError(getApiErrorMessage(payload, "Failed to update question."));
      }
    } catch {
      setEditError("An error occurred updating the question.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Dismiss report
  const handleDismissReport = async (reportId: string) => {
    try {
      const { ok, payload } = await apiFetch("/api/teacher/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });

      if (ok && isApiSuccess(payload)) {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
        setSuccessMessage(locale === "bn" ? "রিপোর্টটি সমাধান করা হয়েছে।" : "Report resolved successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to resolve report."));
      }
    } catch {
      setErrorMessage("An error occurred resolving the report.");
    }
  };

  const OPTION_BADGES = ["A", "B", "C", "D"];

  const filteredMcqs = mcqs.filter((q) =>
    q.question.toLowerCase().includes(chapterSearchQuery.toLowerCase())
  );

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
          {locale === "bn" ? "এমসিকিউ রিভিউ প্যানেল" : "MCQ Review Panel"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {locale === "bn"
            ? "আপনার সিলেক্ট করা বিষয়ের প্রশ্নগুলো দেখুন, এডিট বা ডিলিট করুন এবং রিপোর্ট চেক করুন।"
            : "Review, edit, delete MCQs within your subjects and manage student reports."}
        </p>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab("browse");
            setErrorMessage("");
          }}
          className={cn(
            "px-4 py-2 text-sm font-bold border-b-2 transition-all",
            activeTab === "browse"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-primary"
          )}
        >
          {locale === "bn" ? "বিষয় ও অধ্যায় ব্রাউজ করুন" : "Browse Chapters"}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("reports");
            setErrorMessage("");
          }}
          className={cn(
            "px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5",
            activeTab === "reports"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-primary"
          )}
        >
          <span>{locale === "bn" ? "রিপোর্ট করা প্রশ্নসমূহ" : "Reported Questions"}</span>
          {reports.length > 0 && (
            <span className="bg-brand-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {reports.length}
            </span>
          )}
        </button>
      </div>

      {/* --- TAB CONTENT: BROWSE --- */}
      {activeTab === "browse" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {loadingSubjects ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="size-5 animate-spin" />
              <span>Loading subject mapping...</span>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {/* Subject Sidebar */}
              <div className="md:col-span-1 rounded-xl border border-border bg-card p-4 h-fit space-y-2">
                <h3 className="text-xs font-bold text-accent uppercase tracking-wider px-1 mb-3">
                  {locale === "bn" ? "আপনার বিষয়সমূহ" : "Your Subjects"}
                </h3>
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1">No subjects assigned.</p>
                ) : (
                  subjects.map((sub) => {
                    const key = `${sub.level}-${sub.subject}`;
                    const isExpanded = expandedSubject === key;
                    return (
                      <div key={key} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedSubject(isExpanded ? null : key);
                            setExpandedChapter(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between text-left p-2 rounded-lg text-sm font-semibold transition hover:bg-secondary",
                            isExpanded ? "bg-secondary text-primary" : "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            <span className="text-[10px] uppercase font-bold mr-1.5 px-1 py-0.5 rounded bg-primary/10 text-primary">
                              {sub.level}
                            </span>
                            {sub.subject}
                          </span>
                          {isExpanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                        </button>

                        {/* Chapters */}
                        {isExpanded && (
                          <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-border/60 ml-3">
                            {sub.chapters.map((chap) => {
                              const isChapSelected = expandedChapter === chap;
                              return (
                                <button
                                  key={chap}
                                  type="button"
                                  onClick={() => {
                                    setExpandedChapter(chap);
                                    fetchChapterMcqs(sub.level, sub.subject, chap);
                                  }}
                                  className={cn(
                                    "w-full text-left p-1.5 rounded text-xs font-medium transition block truncate",
                                    isChapSelected
                                      ? "bg-primary/5 text-primary font-bold border-l-2 border-primary pl-2.5"
                                      : "text-muted-foreground hover:text-primary hover:bg-secondary/45"
                                  )}
                                >
                                  {getTranslatedChapter(chap, locale)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Questions Area */}
              <div className="md:col-span-2 space-y-4">
                {!expandedChapter ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-muted-foreground text-sm">
                    <BookOpen className="size-8 mx-auto mb-2 opacity-50" />
                    <span>
                      {locale === "bn" ? (
                        <>
                          প্রশ্ন দেখতে{" "}
                          <span className="hidden md:inline">বামদিকের</span>
                          <span className="inline md:hidden">উপরের</span>{" "}
                          প্যানেল থেকে একটি অধ্যায় নির্বাচন করুন।
                        </>
                      ) : (
                        <>
                          Select a chapter from the{" "}
                          <span className="hidden md:inline">left</span>
                          <span className="inline md:hidden">top</span>{" "}
                          panel to review questions.
                        </>
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-sm)] flex items-center justify-between">
                      <span className="text-sm font-bold text-primary truncate">
                        {getTranslatedChapter(expandedChapter, locale)}
                      </span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {mcqs.length} {locale === "bn" ? "টি প্রশ্ন" : "Questions"}
                      </span>
                    </div>

                    {loadingMcqs ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span>Loading questions...</span>
                      </div>
                    ) : mcqs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground text-sm">
                        {"No practice questions in this chapter yet."}
                      </div>
                    ) : (
                      <>
                        {/* Chapter MCQ local search bar */}
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={chapterSearchQuery}
                            onChange={(e) => setChapterSearchQuery(e.target.value)}
                            placeholder={locale === "bn" ? "এই অধ্যায়ের প্রশ্ন খুঁজুন..." : "Search within this chapter..."}
                            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>

                        {filteredMcqs.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground text-sm">
                            {locale === "bn" ? "কোন প্রশ্ন পাওয়া যায়নি।" : "No questions match your search query."}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {filteredMcqs.map((q, idx) => (
                              <MCQCard
                                key={q._id}
                                mcq={q}
                                index={idx}
                                onEdit={openEditModal}
                                onDelete={handleDeleteMcq}
                                OPTION_BADGES={OPTION_BADGES}
                                searchQuery={chapterSearchQuery}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: REPORTS --- */}
      {activeTab === "reports" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {loadingReports ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>Loading reported questions...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground text-sm">
              {"No reported questions. Good job!"}
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => {
                const q = report.questionId;
                if (!q) return null; // skipped or deleted
                return (
                  <article
                    key={report._id}
                    className="rounded-xl border border-amber-200 bg-amber-50/20 p-5 shadow-sm space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Reported MCQ
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="size-3.5" />
                          <span className="font-semibold">{report.studentId?.name || "Student"}</span>
                          {report.studentId?.email && (
                            <>
                              <span>·</span>
                              <Mail className="size-3.5" />
                              <span>{report.studentId?.email}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismissReport(report._id)}
                          className="rounded-lg h-8 text-xs font-bold"
                        >
                          Resolve/Dismiss
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(q)}
                          className="rounded-lg h-8 text-xs font-bold text-primary"
                        >
                          <Edit className="size-3.5 mr-1" />
                          Edit MCQ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMcq(q._id)}
                          className="rounded-lg h-8 text-xs font-bold text-brand-red border-red-200 hover:bg-red-50 hover:text-brand-red"
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          Delete MCQ
                        </Button>
                      </div>
                    </div>

                    {/* Report Comment */}
                    <div className="bg-amber-100/40 rounded-lg p-3 border border-amber-200/50 flex items-start gap-2 text-sm text-amber-900">
                      <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong className="font-bold">Student feedback:</strong>{" "}
                        <span>{report.comment}</span>
                      </div>
                    </div>

                    {/* Question details preview */}
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded bg-secondary text-primary">
                          {q.level.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">
                          {q.subject} · {getTranslatedChapter(q.chapter, locale)}
                        </span>
                      </div>
                      
                      <h4 className="text-base font-bold text-foreground">{q.question}</h4>

                      {q.imageUrl && (
                        <img
                          src={q.imageUrl}
                          alt="MCQ image"
                          className="max-w-full max-h-48 rounded object-contain border bg-secondary/10"
                        />
                      )}

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
                                  : "border-border text-muted-foreground"
                              )}
                            >
                              <span className="size-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                                {OPTION_BADGES[oIdx]}
                              </span>
                              <span>{opt}</span>
                              {isCorrect && <Check className="size-4 shrink-0 ml-auto" />}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="border-t border-border pt-2.5 text-xs text-muted-foreground">
                          <strong className="font-semibold">Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- EDIT MCQ MODAL --- */}
      {editingMcq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-primary">
                {locale === "bn" ? "এমসিকিউ এডিট করুন" : "Edit MCQ Question"}
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
                <AlertTriangle className="size-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Question Text */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-question" className="font-bold">Question Text</Label>
                <textarea
                  id="edit-question"
                  rows={2}
                  value={editForm.question}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, question: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  placeholder="Enter the question text..."
                />
              </div>

              {/* Image Upload Block */}
              <div className="space-y-2.5">
                <Label className="font-bold">Question Illustration (Image)</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="relative">
                      <input
                        type="file"
                        id="image-file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="image-file"
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
                    <p className="text-[10px] text-muted-foreground">Formats: PNG, JPG, GIF. Hosted securely on Cloudinary.</p>
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
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                      placeholder={`Option ${OPTION_BADGES[idx]}`}
                    />
                  </div>
                ))}
              </div>

              {/* Correct Index */}
              <div className="space-y-1.5">
                <Label htmlFor="correct-idx" className="font-bold">Correct Option</Label>
                <select
                  id="correct-idx"
                  value={editForm.correctIndex}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, correctIndex: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
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
                <Label htmlFor="edit-explanation" className="font-bold">Solution Explanation (Optional)</Label>
                <textarea
                  id="edit-explanation"
                  rows={2}
                  value={editForm.explanation}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, explanation: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  placeholder="Explain why this is correct..."
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingMcq(null)}
                disabled={isSavingEdit}
                className="rounded-xl px-5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                loading={isSavingEdit}
                disabled={isSavingEdit}
                className="rounded-xl px-6"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type MCQCardProps = {
  mcq: MCQQuestion;
  index: number;
  onEdit: (mcq: MCQQuestion) => void;
  onDelete: (id: string) => void;
  OPTION_BADGES: string[];
  searchQuery?: string;
};

function highlightText(text: string, search: string) {
  if (!search.trim()) return <span>{text}</span>;

  const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`(${escapedSearch})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

function MCQCard({ mcq, index, onEdit, onDelete, OPTION_BADGES, searchQuery }: MCQCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-6 place-items-center rounded bg-primary text-white text-[11px] font-bold">
            {index + 1}
          </span>
          <h4 className="text-base font-bold text-foreground pt-0.5 leading-snug">
            {highlightText(mcq.question, searchQuery || "")}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(mcq)}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-primary transition"
            title="Edit question"
          >
            <Edit className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(mcq._id)}
            className="p-1.5 rounded-lg border border-red-100 text-muted-foreground hover:bg-red-50 hover:text-brand-red hover:border-brand-red/30 transition"
            title="Delete question"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Image illustration */}
      {mcq.imageUrl && (
        <img
          src={mcq.imageUrl}
          alt="Illustration"
          className="max-w-full max-h-48 rounded object-contain border border-border/60 bg-muted/20"
        />
      )}

      {/* Options grid */}
      <div className="grid gap-2 sm:grid-cols-2">
        {mcq.options.map((opt, oIdx) => {
          const isCorrect = oIdx === mcq.correctIndex;
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
      {mcq.explanation && (
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          <strong className="font-semibold">Explanation:</strong> {mcq.explanation}
        </div>
      )}
    </article>
  );
}
