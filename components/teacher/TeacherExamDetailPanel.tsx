"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileJson,
  FileText,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath } from "@/lib/i18n";
import { TeacherMcqResults } from "@/components/exam/TeacherMcqResults";
import { cn } from "@/lib/utils";
import { UploadingIndicator } from "@/components/shared/UploadingIndicator";
import { getTranslatedChapter } from "@/lib/content/syllabus";

type MCQQuestion = {
  _id?: string;
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type ExamDetail = {
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
};

type TeacherExamDetailPanelProps = {
    examId: string;
};

export function TeacherExamDetailPanel({ examId }: TeacherExamDetailPanelProps) {
  const locale = "bn";
      
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upload state
  const [activeTab, setActiveTab] = useState<"questions" | "upload" | "database" | "results">("questions");
  const [contentType, setContentType] = useState<"text" | "image">("text");
  const [pastedText, setPastedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [parsedPreview, setParsedPreview] = useState<MCQQuestion[]>([]);

  // Add from database state
  const [dbChapters, setDbChapters] = useState<string[]>([]);
  const [selectedDbChapter, setSelectedDbChapter] = useState("");
  const [dbQuestions, setDbQuestions] = useState<any[]>([]);
  const [loadingDbQuestions, setLoadingDbQuestions] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [addingFromDb, setAddingFromDb] = useState(false);
  const [dbSourceScope, setDbSourceScope] = useState<"all" | "my-uploaded">("all");

  // Edit Exam Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [editTotalMarks, setEditTotalMarks] = useState(25);
  const [editPassMark, setEditPassMark] = useState(15);
  const [editTargetClasses, setEditTargetClasses] = useState<string[]>([]);
  const [editAllowedSubjects, setEditAllowedSubjects] = useState<string[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [editFormError, setEditFormError] = useState("");

  useEffect(() => {
    async function loadAllowedSubjects() {
      try {
        const { ok, payload } = await apiFetch<{ subjects: { subject: string }[] }>("/api/teacher/subjects");
        if (ok && isApiSuccess(payload)) {
          const subjectNames = Array.from(new Set(payload.data.subjects.map((s) => s.subject)));
          setEditAllowedSubjects(subjectNames);
        }
      } catch (err) {
        console.error("Failed to load allowed subjects:", err);
      }
    }
    loadAllowedSubjects();
  }, []);

  const openEditModal = () => {
    if (!exam) return;
    setEditTitle(exam.title);
    setEditSubject(exam.subject);
    setEditDuration(exam.duration);
    setEditTotalMarks(exam.totalMarks);
    setEditPassMark(exam.passMark);
    setEditTargetClasses([...exam.targetClasses]);
    setEditFormError("");
    setIsEditModalOpen(true);
  };

  const handleUpdateExamDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editSubject.trim() || editTargetClasses.length === 0) {
      setEditFormError("Please fill in all fields.");
      return;
    }
    try {
      setSavingDetails(true);
      setEditFormError("");
      const { ok, payload } = await apiFetch<{ exam: ExamDetail }>(
        `/api/teacher/exams/${examId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            subject: editSubject.trim(),
            duration: editDuration,
            totalMarks: editTotalMarks,
            passMark: editPassMark,
            targetClasses: editTargetClasses,
          }),
        }
      );

      if (ok && isApiSuccess(payload)) {
        setExam(payload.data.exam);
        setIsEditModalOpen(false);
      } else {
        setEditFormError(getApiErrorMessage(payload, "Failed to update exam details."));
      }
    } catch {
      setEditFormError("Error updating exam details.");
    } finally {
      setSavingDetails(false);
    }
  };

  const toggleEditClass = (cls: string) => {
    setEditTargetClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("Are you sure you want to delete this question from the exam?")) return;
    try {
      const { ok, payload } = await apiFetch(
        `/api/teacher/exams/${examId}/questions?questionId=${qId}`,
        { method: "DELETE" }
      );
      if (ok && isApiSuccess(payload)) {
        await fetchExamDetails();
      } else {
        alert(getApiErrorMessage(payload, "Failed to delete question."));
      }
    } catch {
      alert("Error connecting to server.");
    }
  };

  useEffect(() => {
    async function loadDbChapters() {
      if (!exam) return;
      try {
        const { ok, payload } = await apiFetch<{ subjects: any[] }>("/api/teacher/subjects");
        if (ok && isApiSuccess(payload)) {
          const matching = payload.data.subjects.find(s => s.subject === exam.subject);
          if (matching) {
            setDbChapters(matching.chapters);
          }
        }
      } catch (err) {
        console.error("Failed to load DB chapters:", err);
      }
    }
    if (exam) {
      loadDbChapters();
    }
  }, [exam]);

  const fetchDbQuestions = useCallback(async (chapter: string, scope: "all" | "my-uploaded" = "all") => {
    if (!exam || !chapter) return;
    try {
      setLoadingDbQuestions(true);
      setDbQuestions([]);
      setSelectedQuestionIds([]);

      const isHsc = exam.targetClasses.some(c => c === "class-11" || c === "class-12");
      const level = isHsc ? "hsc" : "ssc";

      const url = `/api/teacher/mcqs?level=${level}&subject=${encodeURIComponent(exam.subject)}&chapter=${encodeURIComponent(chapter)}&scope=${scope}`;
      const { ok, payload } = await apiFetch<{ questions: any[] }>(url);
      if (ok && isApiSuccess(payload)) {
        setDbQuestions(payload.data.questions);
      } else {
        alert(getApiErrorMessage(payload, "Failed to load database questions."));
      }
    } catch {
      alert("Error loading questions from database.");
    } finally {
      setLoadingDbQuestions(false);
    }
  }, [exam]);

  useEffect(() => {
    if (selectedDbChapter) {
      fetchDbQuestions(selectedDbChapter, dbSourceScope);
    }
  }, [selectedDbChapter, dbSourceScope, fetchDbQuestions]);

  const handleAddSelectedFromDb = async () => {
    if (selectedQuestionIds.length === 0 || !exam) return;
    try {
      setAddingFromDb(true);
      const { ok, payload } = await apiFetch<{ addedCount: number }>(
        `/api/teacher/exams/${examId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionIds: selectedQuestionIds }),
        }
      );

      if (ok && isApiSuccess(payload)) {
        alert(`Successfully added ${payload.data.addedCount} questions from database!`);
        setSelectedQuestionIds([]);
        setSelectedDbChapter("");
        await fetchExamDetails();
        setActiveTab("questions");
      } else {
        alert(getApiErrorMessage(payload, "Failed to add questions."));
      }
    } catch {
      alert("Error connecting to server.");
    } finally {
      setAddingFromDb(false);
    }
  };

  const fetchExamDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { ok, payload } = await apiFetch<{ exam: ExamDetail; questions: MCQQuestion[] }>(
        `/api/teacher/exams/${examId}`
      );
      if (ok && isApiSuccess(payload)) {
        setExam(payload.data.exam);
        setQuestions(payload.data.questions);
      } else {
        setError(getApiErrorMessage(payload, "Failed to load exam details."));
      }
    } catch {
      setError("An error occurred connecting to the server.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExamDetails();
  }, [fetchExamDetails]);

  const handleUploadQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");
    setParsedPreview([]);

    if (contentType === "text" && !pastedText.trim()) {
      setUploadError("টেক্সট পেস্ট করুন।");
      return;
    }
    if (contentType !== "text" && !selectedFile) {
      setUploadError("অনুগ্রহ করে একটি ছবি নির্বাচন করুন।");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("contentType", contentType);
      if (contentType === "text") {
        formData.append("text", pastedText);
      } else if (selectedFile) {
        formData.append("files", selectedFile);
      }

      const response = await fetch(`/api/teacher/exams/${examId}/questions`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (response.ok && payload.success) {
        setUploadSuccess(
          locale === "bn"
            ? `সফলভাবে ${payload.data.addedCount}টি প্রশ্ন যুক্ত করা হয়েছে!`
            : `Successfully parsed and added ${payload.data.addedCount} questions!`
        );
        setParsedPreview(payload.data.questions);
        setPastedText("");
        setSelectedFile(null);
        // Refresh question list
        await fetchExamDetails();
      } else {
        setUploadError(payload?.error?.message || getApiErrorMessage(payload, "Failed to parse questions."));
      }
    } catch {
      setUploadError("Error connecting to question parser.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <RefreshCw className="size-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted">Loading exam details...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        {error || "Exam not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Back Link */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <Link href={"/teacher/exams"} className="text-sm font-semibold text-primary hover:underline">
          ← Back to MCQ exams
        </Link>
        <div className="flex gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
            {exam.subject}
          </span>
        </div>
      </div>

      {/* Exam Info Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Exam Details</p>
            <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
              {exam.title}
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openEditModal}
            className="rounded-xl text-xs font-bold shrink-0 border-primary/20 text-primary hover:bg-secondary/40"
          >
            Edit Details
          </Button>
        </div>
        <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-center">
            <Clock className="size-5 text-primary mx-auto mb-1" />
            <span className="block text-2xs text-muted font-bold uppercase">Duration</span>
            <span className="text-sm font-bold text-primary">{exam.duration} mins</span>
          </div>
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-center">
            <Award className="size-5 text-brand-yellow mx-auto mb-1" />
            <span className="block text-2xs text-muted font-bold uppercase">Marks / Pass</span>
            <span className="text-sm font-bold text-primary">{exam.totalMarks} / {exam.passMark}</span>
          </div>
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-center">
            <Users className="size-5 text-accent mx-auto mb-1" />
            <span className="block text-2xs text-muted font-bold uppercase">Classes</span>
            <span className="text-sm font-bold text-primary">{exam.targetClasses.join(", ")}</span>
          </div>
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-center">
            <FileJson className="size-5 text-brand-blue mx-auto mb-1" />
            <span className="block text-2xs text-muted font-bold uppercase">Questions</span>
            <span className="text-sm font-bold text-primary">{questions.length} / {exam.totalMarks}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto whitespace-nowrap border-b border-border scrollbar-none">
        <button
          onClick={() => setActiveTab("questions")}
          className={cn(
            "border-b-2 px-5 py-2.5 text-sm font-semibold transition shrink-0 cursor-pointer",
            activeTab === "questions" ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
          )}
        >
          Questions ({questions.length})
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={cn(
            "border-b-2 px-5 py-2.5 text-sm font-semibold transition shrink-0 cursor-pointer",
            activeTab === "upload" ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
          )}
        >
          Upload Questions
        </button>
        <button
          onClick={() => setActiveTab("database")}
          className={cn(
            "border-b-2 px-5 py-2.5 text-sm font-semibold transition shrink-0 cursor-pointer",
            activeTab === "database" ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
          )}
        >
          Add from Database
        </button>
        <button
          onClick={() => setActiveTab("results")}
          className={cn(
            "border-b-2 px-5 py-2.5 text-sm font-semibold transition shrink-0 cursor-pointer",
            activeTab === "results" ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
          )}
        >
          Student Results
        </button>
      </div>

      {/* Tab content: Browse Questions */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-muted">
              No questions added yet. Switch to the "Upload Questions" tab to add some.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {questions.map((q, idx) => {
                const qId = q.id || q._id || "";
                return (
                  <article key={qId || idx} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs relative group">
                    <div className="font-bold text-primary text-sm flex items-start gap-2 pr-6">
                      <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-2xs text-primary">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{q.question}</span>
                      <button
                        onClick={() => handleDeleteQuestion(qId)}
                        className="absolute top-3.5 right-3.5 p-1 rounded-lg text-muted hover:text-brand-red hover:bg-red-50 transition cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid gap-1.5 pl-7 text-xs font-semibold text-muted">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={cn(
                            "rounded-md border p-2",
                            oIdx === q.correctIndex
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-border bg-secondary/10"
                          )}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                          {oIdx === q.correctIndex && " (Correct)"}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div className="mt-2 rounded-lg bg-secondary/30 p-2.5 text-2xs text-muted font-medium border border-border/40 pl-7">
                        <strong className="text-primary font-bold">Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab content: Upload Questions */}
      {activeTab === "upload" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Form */}
          <form onSubmit={handleUploadQuestions} className="md:col-span-2 rounded-xl border border-border bg-card p-5 shadow-xs space-y-5">
            <h2 className="font-display text-sm font-bold text-primary">Upload Questions</h2>

            {/* Type selector */}
            <div className="space-y-1.5">
              <Label>Source Type</Label>
              <div className="flex flex-wrap gap-1.5 bg-secondary/60 p-1 rounded-xl w-full sm:w-fit">
                <button
                  type="button"
                  onClick={() => { setContentType("text"); setSelectedFile(null); }}
                  className={cn("flex-1 sm:flex-initial rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap", contentType === "text" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-primary")}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  onClick={() => { setContentType("image"); setSelectedFile(null); }}
                  className={cn("flex-1 sm:flex-initial rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap", contentType === "image" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-primary")}
                >
                  Upload Image
                </button>
              </div>
            </div>

            {/* Content inputs */}
            {contentType === "text" ? (
              <div className="space-y-1.5">
                <Label htmlFor="exam-raw-text">Raw Text (Questions, options, and explanations)</Label>
                <textarea
                  id="exam-raw-text"
                  rows={8}
                  placeholder="Paste questions here... e.g.
1. What is the value of g?
a) 9.8 m/s^2
b) 10
c) 8
d) 9"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>ছবি নির্বাচন করুন (একটি, সর্বোচ্চ ৪ MB)</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="exam-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 4 * 1024 * 1024) {
                        setUploadError("ছবির আকার ৪ MB এর কম হতে হবে।");
                        setSelectedFile(null);
                        e.target.value = "";
                        return;
                      }
                      setUploadError("");
                      setSelectedFile(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById("exam-file-input")?.click()}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-3 py-2 text-xs font-bold text-muted hover:border-primary/30 hover:bg-secondary/40 transition cursor-pointer"
                  >
                    <Upload className="size-4" />
                    {selectedFile ? selectedFile.name : "ফাইল নির্বাচন করুন"}
                  </button>
                  {selectedFile && (
                    <button
                      type="button"
                      aria-label="Remove selected image"
                      onClick={() => {
                        setSelectedFile(null);
                        const input = document.getElementById("exam-file-input") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      className="shrink-0 rounded-md p-1 text-muted hover:bg-red-50 hover:text-brand-red"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-[11px] font-semibold text-muted">
                    {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <UploadingIndicator isUploading={uploading} className="my-2" />

            <Button
              type="submit"
              loading={uploading}
              disabled={uploading}
              className="w-full rounded-xl py-2 font-bold"
            >
              {uploading ? (
                "প্রশ্ন প্রসেস করা হচ্ছে..."
              ) : (
                "পার্স এবং প্রশ্ন যোগ করুন"
              )}
            </Button>
          </form>

          {/* Guidelines Sidebar */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
            <h3 className="font-display text-sm font-bold text-primary">Instructions</h3>
            <div className="text-xs text-muted space-y-3 font-medium leading-relaxed">
              <p>
                1. <strong>Pasted Text / TXT file:</strong> Ensure questions are clearly separated. Options should start with identifiers like a), b), c), d) or 1), 2), 3), 4).
              </p>
              <p>
                2. <strong>Image OCR:</strong> Take a clear photo of the exam paper. Gemini AI will run OCR to detect text, translate it to Bengali, and format it as a valid exam.
              </p>
              <p>
                3. Gemini will automatically translate questions into **Bengali** and ensure exactly **4 options** are present for each question.
              </p>
            </div>

            {parsedPreview.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <h4 className="text-2xs font-bold uppercase tracking-wider text-muted">Parsed Questions:</h4>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {parsedPreview.map((pq, pIdx) => (
                    <div key={pIdx} className="rounded border border-border bg-surface p-2 text-2xs font-semibold text-primary truncate">
                      {pIdx + 1}. {pq.question}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content: Add from Database */}
      {activeTab === "database" && (() => {
        const filteredDbQuestions = dbQuestions.filter(dbQ => {
          return !questions.some(eq => eq.question === dbQ.question);
        });

        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h2 className="font-display text-sm font-bold text-primary">Add Questions from Database</h2>
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-1.5">
                  <Label htmlFor="db-chapter-select">Select Chapter</Label>
                  <select
                    id="db-chapter-select"
                    value={selectedDbChapter}
                    onChange={(e) => setSelectedDbChapter(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  >
                    <option value="">-- Select Chapter --</option>
                    {dbChapters.map((chap) => (
                      <option key={chap} value={chap}>
                        {getTranslatedChapter(chap, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="db-source-select">Database Source</Label>
                  <select
                    id="db-source-select"
                    value={dbSourceScope}
                    onChange={(e) => setDbSourceScope(e.target.value as "all" | "my-uploaded")}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  >
                    <option value="all">Whole Database (All Questions)</option>
                    <option value="my-uploaded">My Uploaded Questions Only</option>
                  </select>
                </div>
              </div>
            </div>

            {selectedDbChapter && (
              <div className="space-y-4">
                {loadingDbQuestions ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <RefreshCw className="size-6 animate-spin text-primary" />
                    <p className="text-xs font-semibold text-muted">Loading questions from database...</p>
                  </div>
                ) : filteredDbQuestions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/45 p-8 text-center text-muted-foreground text-sm">
                    No questions found in this chapter.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Select All / Add bar */}
                    <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="select-all-qs"
                          checked={selectedQuestionIds.length === filteredDbQuestions.length && filteredDbQuestions.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedQuestionIds(filteredDbQuestions.map(q => q._id));
                            } else {
                              setSelectedQuestionIds([]);
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                        />
                        <label htmlFor="select-all-qs" className="text-sm font-bold text-primary cursor-pointer select-none">
                          Select All ({filteredDbQuestions.length})
                        </label>
                      </div>

                      <Button
                        onClick={handleAddSelectedFromDb}
                        disabled={selectedQuestionIds.length === 0 || addingFromDb}
                        loading={addingFromDb}
                        className="rounded-xl font-bold py-2 px-5"
                      >
                        Add Selected ({selectedQuestionIds.length}) to Exam
                      </Button>
                    </div>

                    {/* List of DB Questions */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {filteredDbQuestions.map((q, idx) => {
                        const isSelected = selectedQuestionIds.includes(q._id);
                        return (
                          <article
                            key={q._id}
                            className={cn(
                              "rounded-xl border-2 p-4 space-y-3 cursor-pointer select-none transition-colors",
                              isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                            )}
                            onClick={() => {
                              setSelectedQuestionIds(prev =>
                                prev.includes(q._id) ? prev.filter(id => id !== q._id) : [...prev, q._id]
                              );
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="rounded border-border text-primary focus:ring-primary size-4 mt-1"
                              />
                              <div className="font-bold text-primary text-sm flex items-start gap-2 flex-1">
                                <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-2xs text-primary">
                                  {idx + 1}
                                </span>
                                <span className="flex-1">{q.question}</span>
                              </div>
                            </div>

                            <div className="grid gap-1.5 pl-7 text-xs font-semibold text-muted">
                              {q.options.map((opt: string, oIdx: number) => (
                                <div
                                  key={oIdx}
                                  className={cn(
                                    "rounded-md border p-2",
                                    oIdx === q.correctIndex
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-border bg-secondary/10"
                                  )}
                                >
                                  {String.fromCharCode(65 + oIdx)}. {opt}
                                  {oIdx === q.correctIndex && " (Correct)"}
                                </div>
                              ))}
                            </div>
                            {q.explanation && (
                              <div className="mt-2 rounded-lg bg-secondary/30 p-2.5 text-2xs text-muted font-medium border border-border/40 pl-7">
                                <strong className="text-primary font-bold">Explanation:</strong> {q.explanation}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab content: Student Results */}
      {activeTab === "results" && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
          <TeacherMcqResults examId={examId} />
        </div>
      )}

      {/* Edit Exam Details Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h2 className="font-display text-lg font-bold text-primary">
                {"পরীক্ষার তথ্য সংশোধন"}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted hover:text-primary transition font-bold"
              >
                ✕
              </button>
            </div>

            {editFormError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {editFormError}
              </div>
            )}

            <form onSubmit={handleUpdateExamDetails} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-exam-title">Exam Title</Label>
                <Input
                  id="edit-exam-title"
                  placeholder="e.g. Physics Class 11 Midterm"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-exam-subject">Subject</Label>
                <select
                  id="edit-exam-subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                  required
                >
                  <option value="">-- Select Subject --</option>
                  {editAllowedSubjects.map((subName) => (
                    <option key={subName} value={subName}>
                      {subName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-exam-duration">Duration (m)</Label>
                  <input
                    id="edit-exam-duration"
                    type="number"
                    min={1}
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-exam-marks">Total Marks</Label>
                  <input
                    id="edit-exam-marks"
                    type="number"
                    min={1}
                    value={editTotalMarks}
                    onChange={(e) => setEditTotalMarks(Number(e.target.value))}
                    className="flex h-10 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-exam-pass">Pass Mark</Label>
                  <input
                    id="edit-exam-pass"
                    type="number"
                    min={1}
                    value={editPassMark}
                    onChange={(e) => setEditPassMark(Number(e.target.value))}
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
                        checked={editTargetClasses.includes(cls)}
                        onChange={() => toggleEditClass(cls)}
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
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={savingDetails}
                  className="rounded-xl font-bold"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
