"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit,
  FileImage,
  Image as ImageIcon,
  Loader2,
  Save,
  Server,
  Settings,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdminTeacherMcqReview } from "./AdminTeacherMcqReview";
import {
  apiFetch,
  authenticatedFetch,
  getApiErrorMessage,
  isApiSuccess,
} from "@/lib/api/client";
import { getSyllabusChapters, type SchoolLevel } from "@/lib/content/syllabus";
import { cn } from "@/lib/utils";
import { UploadingIndicator } from "@/components/shared/UploadingIndicator";
import type { CourseSubject } from "@/types";

type ParsedQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type PracticeTestSettings = {
  maxQuestionsPerTest: number;
  secondsPerQuestion: number;
  passMarkPercent: number;
};

type UploadedQuestion = {
  id: string;
  level: SchoolLevel;
  subject: CourseSubject;
  chapter: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
};

/** SSC subjects for upload */
const SSC_SUBJECTS: CourseSubject[] = [
  "পদার্থবিজ্ঞান",
  "রসায়ন",
  "সাধারণ গণিত",
  "উচ্চতর গণিত",
  "জীববিজ্ঞান",
  "তথ্য ও যোগাযোগ প্রযুক্তি",
  "বাংলা ১ম পত্র",
  "বাংলা ২য় পত্র",
  "ইংরেজি ১ম পত্র",
  "ইংরেজি ২য় পত্র",
  "ইসলাম ও নৈতিক শিক্ষা",
  "বাংলাদেশ ও বিশ্বপরিচয়",
];

/** HSC subjects — paper-split for Physics, Chemistry, Higher Math */
const HSC_SUBJECTS: CourseSubject[] = [
  "পদার্থবিজ্ঞান ১ম পত্র",
  "পদার্থবিজ্ঞান ২য় পত্র",
  "রসায়ন ১ম পত্র",
  "রসায়ন ২য় পত্র",
  "উচ্চতর গণিত ১ম পত্র",
  "উচ্চতর গণিত ২য় পত্র",
  "জীববিজ্ঞান ১ম পত্র",
  "জীববিজ্ঞান ২য় পত্র",
  "তথ্য ও যোগাযোগ প্রযুক্তি",
  "বাংলা ১ম পত্র",
  "বাংলা ২য় পত্র",
  "ইংরেজি ১ম পত্র",
  "ইংরেজি ২য় পত্র",
];

const OPTION_BADGES = ["A", "B", "C", "D"];

export function AdminPracticeManager() {
  const locale = "bn";
  // Config states
  const [selectedLevel, setSelectedLevel] = useState<SchoolLevel>("ssc");
  const [selectedSubject, setSelectedSubject] = useState<CourseSubject>("পদার্থবিজ্ঞান");

  const SUBJECTS = selectedLevel === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;

  // Chapter list from static syllabus
  const chapters = getSyllabusChapters(selectedLevel, selectedSubject);
  const [selectedChapter, setSelectedChapter] = useState(
    () => getSyllabusChapters("ssc", "à¦ªà¦¦à¦¾à¦°à§à¦¥à¦¬à¦¿à¦œà§à¦žà¦¾à¦¨")[0] || ""
  );

  // Content upload states
  const [contentType, setContentType] = useState<"text" | "image">("text");
  const [pastedText, setPastedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Status/Response states
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState<{
    addedCount: number;
    questions: ParsedQuestion[];
  } | null>(null);

  // Practice test settings states
  const [settings, setSettings] = useState<PracticeTestSettings>({
    maxQuestionsPerTest: 25,
    secondsPerQuestion: 45,
    passMarkPercent: 60,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Active Tab for main MCQ panel
  const [activeMcqTab, setActiveMcqTab] = useState<"upload" | "uploaded">("upload");

  // Admin's own uploaded pending MCQs states
  const [filterLevel, setFilterLevel] = useState<SchoolLevel>("ssc");
  const [filterSubject, setFilterSubject] = useState<CourseSubject>("পদার্থবিজ্ঞান");
  const [filterChapter, setFilterChapter] = useState(
    () => getSyllabusChapters("ssc", "à¦ªà¦¦à¦¾à¦°à§à¦¥à¦¬à¦¿à¦œà§à¦žà¦¾à¦¨")[0] || ""
  );
  const [uploadedQuestions, setUploadedQuestions] = useState<UploadedQuestion[]>([]);
  const [loadingUploaded, setLoadingUploaded] = useState(false);
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<string[]>([]);
  const [syncingUploaded, setSyncingUploaded] = useState(false);
  const [deletingUploaded, setDeletingUploaded] = useState(false);

  // Edit MCQ modal states
  const [editingMcq, setEditingMcq] = useState<UploadedQuestion | null>(null);
  const [editForm, setEditForm] = useState({
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    imageUrl: "",
    level: "ssc" as SchoolLevel,
    subject: "পদার্থবিজ্ঞান" as CourseSubject,
    chapter: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const filterSubjects = filterLevel === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;
  const filterChapters = getSyllabusChapters(filterLevel, filterSubject);

  // Fetch admin's own uploaded pending questions
  const fetchUploadedQuestions = useCallback(async (level: SchoolLevel, subject: CourseSubject, chapter: string) => {
    if (!level || !subject || !chapter) return;
    try {
      setLoadingUploaded(true);
      setErrorMessage("");
      setSelectedUploadedIds([]);
      const { ok, payload } = await apiFetch<{ questions: UploadedQuestion[] }>(
        `/api/admin/teacher-mcqs?level=${level}&subject=${subject}&chapter=${chapter}&scope=me`
      );
      if (ok && isApiSuccess(payload)) {
        setUploadedQuestions(payload.data.questions);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to load uploaded questions."));
      }
    } catch (error) {
      console.error("[Fetch Uploaded Questions Catch Error]:", error);
      setErrorMessage("An error occurred fetching uploaded questions.");
    } finally {
      setLoadingUploaded(false);
    }
  }, []);

  // Fetch when filters or tab changes
  useEffect(() => {
    if (activeMcqTab === "uploaded" && filterLevel && filterSubject && filterChapter) {
      const timer = window.setTimeout(() => {
        void fetchUploadedQuestions(filterLevel, filterSubject, filterChapter);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeMcqTab, filterLevel, filterSubject, filterChapter, fetchUploadedQuestions]);

  // Sync selected questions to database (approve them)
  const handleBulkSync = async () => {
    if (selectedUploadedIds.length === 0) return;
    setSyncingUploaded(true);
    setErrorMessage("");
    try {
      const { ok, payload } = await apiFetch<{ modifiedCount: number }>("/api/admin/teacher-mcqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedUploadedIds }),
      });
      if (ok && isApiSuccess(payload)) {
        const syncedCount = payload.data.modifiedCount;
        setSuccessData({
          addedCount: syncedCount,
          questions: [],
        });
        setUploadedQuestions((prev) => prev.filter((q) => !selectedUploadedIds.includes(q.id)));
        setSelectedUploadedIds([]);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to sync selected questions."));
      }
    } catch (error) {
      console.error("[Bulk Sync Catch Error]:", error);
      setErrorMessage("Could not connect to the server.");
    } finally {
      setSyncingUploaded(false);
    }
  };

  // Bulk delete selected pending questions
  const handleBulkDeleteUploaded = async () => {
    if (selectedUploadedIds.length === 0) return;
    if (!confirm(locale === "bn" ? `আপনি কি নিশ্চিত যে আপনি ${selectedUploadedIds.length}টি প্রশ্ন মুছে ফেলতে চান?` : `Are you sure you want to delete ${selectedUploadedIds.length} selected questions?`)) return;

    setDeletingUploaded(true);
    setErrorMessage("");
    try {
      const { ok, payload } = await apiFetch("/api/admin/teacher-mcqs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedUploadedIds }),
      });
      if (ok && isApiSuccess(payload)) {
        setUploadedQuestions((prev) => prev.filter((q) => !selectedUploadedIds.includes(q.id)));
        setSelectedUploadedIds([]);
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to delete selected questions."));
      }
    } catch (error) {
      console.error("[Bulk Delete Catch Error]:", error);
      setErrorMessage("Could not connect to the server.");
    } finally {
      setDeletingUploaded(false);
    }
  };

  // Delete individual pending question
  const handleDeleteUploadedQuestion = async (id: string) => {
    if (!confirm(locale === "bn" ? "আপনি কি নিশ্চিত যে এই প্রশ্নটি মুছে ফেলতে চান?" : "Are you sure you want to delete this question?")) return;
    try {
      const { ok, payload } = await apiFetch(`/api/admin/teacher-mcqs/${id}`, {
        method: "DELETE",
      });
      if (ok && isApiSuccess(payload)) {
        setUploadedQuestions((prev) => prev.filter((q) => q.id !== id));
        setSelectedUploadedIds((prev) => prev.filter((item) => item !== id));
      } else {
        setErrorMessage(getApiErrorMessage(payload, "Failed to delete question."));
      }
    } catch (error) {
      console.error("[Delete Question Catch Error]:", error);
      setErrorMessage("Could not connect to the server.");
    }
  };

  // Open edit modal
  const handleOpenEdit = (q: UploadedQuestion) => {
    setEditingMcq(q);
    setEditForm({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      imageUrl: q.imageUrl || "",
      level: q.level,
      subject: q.subject as CourseSubject,
      chapter: q.chapter,
    });
    setEditError("");
    setImageError("");
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setImageError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await authenticatedFetch("/api/upload", {
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
      const { ok, payload } = await apiFetch<{ question: UploadedQuestion }>(
        `/api/admin/teacher-mcqs/${editingMcq.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );
      if (ok && isApiSuccess(payload)) {
        const updated = payload.data.question;
        setUploadedQuestions((prev) =>
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
      } else {
        setEditError(getApiErrorMessage(payload, "Failed to save edits."));
      }
    } catch {
      setEditError("Error connecting to server.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Load test settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const { ok, payload } = await apiFetch<PracticeTestSettings>("/api/admin/practice-settings");
        if (ok && isApiSuccess(payload)) {
          setSettings(payload.data);
        }
      } catch {
        // Use defaults silently
      } finally {
        setSettingsLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Handle settings save
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSaved(false);
    setSettingsSaving(true);
    try {
      const { ok, payload } = await apiFetch("/api/admin/practice-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!ok || !isApiSuccess(payload)) {
        setSettingsError(getApiErrorMessage(payload, "Failed to save settings."));
      } else {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch {
      setSettingsError("Could not connect to the server.");
    } finally {
      setSettingsSaving(false);
    }
  }

  // Handle upload form submission
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessData(null);

    if (!selectedChapter) {
      setErrorMessage(
        locale === "bn" ? "অধ্যায়ের নাম আবশ্যক।" : "Chapter name is required."
      );
      return;
    }

    if (contentType === "text" && !pastedText.trim()) {
      setErrorMessage(
        locale === "bn" ? "অনুগ্রহ করে কনভার্ট করার জন্য টেক্সট লিখুন।" : "Please paste some text."
      );
      return;
    }

    if (contentType !== "text" && !selectedFile) {
      setErrorMessage(
        locale === "bn" ? "অনুগ্রহ করে একটি ছবি সিলেক্ট করুন।" : "Please select an image to upload."
      );
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("level", selectedLevel);
      formData.append("subject", selectedSubject);
      formData.append("chapter", selectedChapter);
      formData.append("contentType", contentType);

      if (contentType === "text") {
        formData.append("text", pastedText);
      } else if (selectedFile) {
        formData.append("files", selectedFile);
      }

      const response = await authenticatedFetch("/api/admin/practice-mcqs/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setErrorMessage(
          payload?.error?.message ||
            getApiErrorMessage(payload, locale === "bn" ? "কনভার্ট করা ব্যর্থ হয়েছে।" : "Conversion failed.")
        );
        return;
      }

      setSuccessData(payload.data);
      setPastedText("");
      setSelectedFile(null);
    } catch {
      setErrorMessage(
        locale === "bn"
          ? "সার্ভারের সাথে সংযোগ করা যায়নি।"
          : "Could not connect to the server."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // (Local JSON file sync state and functions removed)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {"Practice MCQ Management"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "পরীক্ষার সেটিংস পরিবর্তন করুন এবং MCQ আপলোড করুন।"
            : "Configure test settings and upload MCQ questions for students."}
        </p>
      </div>

      {/* ─── Test Settings Panel ─── */}
      <div className="rounded-xl border-2 border-primary/20 bg-card p-5 shadow-[var(--shadow-sm)] space-y-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Settings className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              {locale === "bn" ? "পরীক্ষার সেটিংস" : "Test Settings"}
            </h2>
            <p className="text-xs text-muted">
              {locale === "bn"
                ? "ডিফল্ট: ২৫টি প্রশ্ন · ৫০ সে/প্রশ্ন · ৬০% পাস মার্ক"
                : "Defaults: 25 questions · 50s/question · 60% pass mark"}
            </p>
          </div>
        </div>

        {settingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {"Loading settings..."}
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Seconds per Question */}
              <div className="space-y-1.5">
                <Label htmlFor="seconds-per-q">
                  {locale === "bn" ? "প্রতি প্রশ্নে সময় (সেকেন্ড)" : "Seconds per Question"}
                </Label>
                <input
                  id="seconds-per-q"
                  type="number"
                  min={10}
                  max={300}
                  value={settings.secondsPerQuestion}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, secondsPerQuestion: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                />
                <p className="text-xs text-muted">{"Range: 10–300s"}</p>
              </div>

              {/* Pass Mark */}
              <div className="space-y-1.5">
                <Label htmlFor="pass-mark">
                  {locale === "bn" ? "পাস মার্ক (%)" : "Pass Mark (%)"}
                </Label>
                <input
                  id="pass-mark"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.passMarkPercent}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, passMarkPercent: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                />
                <p className="text-xs text-muted">{"Range: 1–100%"}</p>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-secondary/60 border border-border px-4 py-3 text-xs text-muted flex flex-wrap gap-4">
              <span>
                {locale === "bn" ? "সময় প্রতি প্রশ্ন:" : "Seconds per question:"}{" "}
                <span className="font-bold text-primary">{settings.secondsPerQuestion}s</span>
              </span>
              <span>·</span>
              <span>
                {locale === "bn" ? "পাস মার্ক:" : "Pass Mark:"}{" "}
                <span className="font-bold text-primary">{settings.passMarkPercent}%</span>
              </span>
            </div>

            {settingsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSaved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span>{"Settings saved successfully!"}</span>
              </div>
            )}

            <Button
              type="submit"
              loading={settingsSaving}
              disabled={settingsSaving}
              className="rounded-xl"
            >
              <Save className="mr-2 size-4" />
              {settingsSaving
                ? "Saving..."
                :  "Save Settings"}
            </Button>
          </form>
        )}
      </div>

      {/* Main MCQ Management Tabs */}
      <div className="flex border-b border-border gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveMcqTab("upload");
            setErrorMessage("");
            setSuccessData(null);
          }}
          className={cn(
            "px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5",
            activeMcqTab === "upload"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary"
          )}
        >
          <span>{locale === "bn" ? "প্রশ্ন আপলোড করুন" : "Upload MCQ"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMcqTab("uploaded");
            setErrorMessage("");
            setSuccessData(null);
          }}
          className={cn(
            "px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5",
            activeMcqTab === "uploaded"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary"
          )}
        >
          <span>{locale === "bn" ? "আপলোডকৃত প্রশ্নসমূহ" : "Uploaded MCQs"}</span>
        </button>
      </div>

      {/* --- TAB CONTENT: UPLOAD --- */}
      {activeMcqTab === "upload" && (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-200">
          {/* Upload Form */}
          <form
            onSubmit={handleUpload}
            className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-5"
          >
            <h2 className="font-display text-lg font-bold text-primary">
              {locale === "bn" ? "প্রশ্ন আপলোড করুন" : "Upload Questions"}
            </h2>

            {/* Target Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="level-select">{locale === "bn" ? "শ্রেণি স্তর" : "Class Level"}</Label>
                <select
                  id="level-select"
                  value={selectedLevel}
                  onChange={(e) => {
                    const level = e.target.value as SchoolLevel;
                    const subjects = level === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;
                    const subject = subjects.includes(selectedSubject) ? selectedSubject : subjects[0];
                    setSelectedLevel(level);
                    setSelectedSubject(subject);
                    setSelectedChapter(getSyllabusChapters(level, subject)[0] || "");
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                >
                  <option value="ssc">SSC (Class 9-10)</option>
                  <option value="hsc">HSC (Class 11-12)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject-select">{locale === "bn" ? "বিষয়" : "Subject"}</Label>
                <select
                  id="subject-select"
                  value={selectedSubject}
                  onChange={(e) => {
                    const subject = e.target.value as CourseSubject;
                    setSelectedSubject(subject);
                    setSelectedChapter(getSyllabusChapters(selectedLevel, subject)[0] || "");
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chapter Select */}
            <div className="space-y-2">
              <Label htmlFor="chapter-select">{locale === "bn" ? "অধ্যায়" : "Chapter"}</Label>
              {chapters.length > 0 ? (
                <select
                  id="chapter-select"
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                >
                  {chapters.map((chap) => (
                    <option key={chap} value={chap}>
                      {chap}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted">
                  {locale === "bn" ? "অধ্যায় লোড করা যায়নি।" : "No chapters available."}
                </p>
              )}
            </div>

            {/* Upload Method Tabs */}
            <div className="space-y-1.5">
              <Label>{locale === "bn" ? "আপলোড পদ্ধতি" : "Upload Method"}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setContentType("text"); setSelectedFile(null); }}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition",
                    contentType === "text"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted hover:border-primary/20"
                  )}
                >
                  <Type className="size-4 shrink-0" />
                  <span>{locale === "bn" ? "টেক্সট পেস্ট" : "Paste Text"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setContentType("image"); setSelectedFile(null); }}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition",
                    contentType === "image"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted hover:border-primary/20"
                  )}
                >
                  <FileImage className="size-4 shrink-0" />
                  <span>{locale === "bn" ? "ছবি আপলোড" : "Upload Image"}</span>
                </button>
              </div>
            </div>

            {/* Content Inputs */}
            {contentType === "text" ? (
              <div className="space-y-1.5">
                <Label htmlFor="paste-area">{locale === "bn" ? "প্রশ্নাবলি পেস্ট করুন" : "Paste MCQ Content"}</Label>
                <textarea
                  id="paste-area"
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={
                    locale === "bn"
                      ? "১. ভৌত রাশির একক কোনটি?\nক) মিটার খ) সেকেন্ড গ) কেজি ঘ) সব কয়টি\nসঠিক উত্তর: ঘ\n\n(যেকোনো ফরম্যাটে লিখুন, এআই নিজে এটি সাজিয়ে নিবে!)"
                      : "1. What is the SI unit of force?\nA) Pascal B) Joule C) Newton D) Watt\nAnswer: C\n\n(Write/paste in any format, Gemini AI will handle the parsing!)"
                  }
                  className="w-full rounded-lg border border-border bg-surface p-3 text-sm font-medium outline-none focus:border-primary"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="file-input">
                  {locale === "bn"
                    ? "এমসিকিউ প্রশ্ন সম্বলিত ছবি (একটি, সর্বোচ্চ ৪ MB)"
                    : "Upload Question Image (one file, max 4 MB)"}
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 4 * 1024 * 1024) {
                        setErrorMessage(
                          locale === "bn" ? "ছবির আকার ৪ MB এর কম হতে হবে।" : "Image must be under 4 MB."
                        );
                        setSelectedFile(null);
                        e.target.value = "";
                        return;
                      }
                      setErrorMessage("");
                      setSelectedFile(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById("file-input")?.click()}
                    className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-3 text-sm font-semibold text-muted hover:border-primary/30 hover:bg-secondary/40 transition"
                  >
                    <Upload className="size-4" />
                    {selectedFile
                      ? selectedFile.name
                      : locale === "bn" ? "ফাইল সিলেক্ট করুন" : "Choose Image"}
                  </button>
                  {selectedFile && (
                    <button
                      type="button"
                      aria-label="Remove selected image"
                      onClick={() => {
                        setSelectedFile(null);
                        const input = document.getElementById("file-input") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      className="shrink-0 rounded-md p-1 text-muted hover:bg-red-50 hover:text-brand-red"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-xs text-muted">
                    {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            {/* Action button & states */}
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <UploadingIndicator isUploading={submitting} className="my-2" />

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-xl"
              loading={submitting}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  {locale === "bn" ? "এমসিকিউ রূপান্তর হচ্ছে..." : "Converting MCQs..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload className="size-4" />
                  {locale === "bn" ? "আপলোড ও রূপান্তর করুন" : "Upload & Convert"}
                </span>
              )}
            </Button>
          </form>

          {/* Sidebar Guidelines/Parsed Preview */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="font-display text-lg font-bold text-primary">
              {locale === "bn" ? "আপলোড তথ্য" : "Upload Guidelines"}
            </h2>

            {!successData ? (
              <div className="text-sm text-muted space-y-3">
                <p>
                  {locale === "bn"
                    ? "১. জেমিনি এআই ইমেজ বা অগোছালো টেক্সট ফাইল থেকে এমসিকিউ প্রশ্ন, অপশন ও সঠিক উত্তর সনাক্ত করতে পারে।"
                    : "1. Gemini AI can parse messy, raw text or images of papers to detect questions, options, correct answers, and explanations."}
                </p>
                <p>
                  {locale === "bn"
                    ? "২. HSC-তে Physics, Chemistry ও Higher Math এর 1st Paper ও 2nd Paper আলাদাভাবে আপলোড করুন।"
                    : "2. For HSC, upload Physics, Chemistry and Higher Math 1st Paper and 2nd Paper separately."}
                </p>
                <p>
                  {locale === "bn"
                    ? "৩. কনভার্ট শেষ হলে নিচে প্রশ্নগুলোর প্রিভিউ দেখতে পাবেন।"
                    : "3. Once conversion completes, you will see a real-time preview of the parsed questions here."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                  <span className="text-xs font-bold">
                    {locale === "bn"
                      ? `সফলভাবে ${successData.addedCount}টি প্রশ্ন যুক্ত করা হয়েছে!`
                      : `Successfully added ${successData.addedCount} questions!`}
                  </span>
                </div>

                <div className="border-t border-border pt-3 space-y-3 max-h-[30rem] overflow-y-auto">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    {locale === "bn" ? "প্রশ্নাবলি প্রিভিউ" : "Questions Preview"}
                  </h3>
                  {successData.questions.map((q, idx) => (
                    <div key={q.id || idx} className="rounded-lg border border-border bg-surface p-3 text-sm space-y-2">
                      <div className="font-semibold text-primary">
                        {idx + 1}. {q.question}
                      </div>
                      <div className="grid gap-1 pl-4 text-xs font-medium text-muted">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={cn(
                              oIdx === q.correctIndex ? "text-emerald-700 font-bold" : "text-muted"
                            )}
                          >
                            {String.fromCharCode(65 + oIdx)}) {opt}
                            {oIdx === q.correctIndex && " (Correct)"}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="text-2xs text-emerald-800 bg-emerald-50/50 p-1.5 rounded border border-emerald-100">
                          <strong>Explanation:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: UPLOADED --- */}
      {activeMcqTab === "uploaded" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="font-display text-lg font-bold text-primary">
              {locale === "bn" ? "আপলোডকৃত প্রশ্নসমূহ" : "Uploaded MCQs"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Level select */}
              <div className="space-y-1.5">
                <Label htmlFor="filter-level">{locale === "bn" ? "শ্রেণি স্তর" : "Class Level"}</Label>
                <select
                  id="filter-level"
                  value={filterLevel}
                  onChange={(e) => {
                    const level = e.target.value as SchoolLevel;
                    const subjects = level === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;
                    const subject = subjects.includes(filterSubject) ? filterSubject : subjects[0];
                    setFilterLevel(level);
                    setFilterSubject(subject);
                    setFilterChapter(getSyllabusChapters(level, subject)[0] || "");
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                >
                  <option value="ssc">SSC (Class 9-10)</option>
                  <option value="hsc">HSC (Class 11-12)</option>
                </select>
              </div>

              {/* Subject Select */}
              <div className="space-y-1.5">
                <Label htmlFor="filter-subject">{locale === "bn" ? "বিষয়" : "Subject"}</Label>
                <select
                  id="filter-subject"
                  value={filterSubject}
                  onChange={(e) => {
                    const subject = e.target.value as CourseSubject;
                    setFilterSubject(subject);
                    setFilterChapter(getSyllabusChapters(filterLevel, subject)[0] || "");
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                >
                  {filterSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter Select */}
              <div className="space-y-1.5">
                <Label htmlFor="filter-chapter">{locale === "bn" ? "অধ্যায়" : "Chapter"}</Label>
                {filterChapters.length > 0 ? (
                  <select
                    id="filter-chapter"
                    value={filterChapter}
                    onChange={(e) => setFilterChapter(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-primary"
                  >
                    {filterChapters.map((chap: string) => (
                      <option key={chap} value={chap}>
                        {chap}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted">
                    {locale === "bn" ? "অধ্যায় লোড করা যায়নি।" : "No chapters available."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* MCQs List */}
          {loadingUploaded ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>{locale === "bn" ? "প্রশ্ন লোড হচ্ছে..." : "Loading uploaded questions..."}</span>
            </div>
          ) : !filterChapter ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground text-sm">
              {locale === "bn" ? "প্রশ্ন দেখতে বিষয় এবং অধ্যায় সিলেক্ট করুন।" : "Please select subject and chapter to view questions."}
            </div>
          ) : uploadedQuestions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground text-sm">
              {locale === "bn" ? "এই অধ্যায়ে আপনার আপলোডকৃত কোনো প্রশ্ন পাওয়া যায়নি।" : "No uploaded questions found for this chapter."}
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Bulk Actions Header */}
              <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      uploadedQuestions.length > 0 &&
                      selectedUploadedIds.length === uploadedQuestions.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUploadedIds(uploadedQuestions.map((q) => q.id));
                      } else {
                        setSelectedUploadedIds([]);
                      }
                    }}
                    className="rounded border-border text-primary focus:ring-primary size-4"
                  />
                  <span>{locale === "bn" ? "সব সিলেক্ট করুন" : "Select All"}</span>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-semibold">
                    {selectedUploadedIds.length} {locale === "bn" ? "টি সিলেক্টেড" : "selected"}
                  </span>
                  <Button
                    type="button"
                    disabled={selectedUploadedIds.length === 0 || syncingUploaded}
                    loading={syncingUploaded}
                    onClick={handleBulkSync}
                    className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Server className="size-3.5 mr-1" />
                    {locale === "bn" ? "ডেটাবেজে সিঙ্ক করুন" : "Sync to Database"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedUploadedIds.length === 0 || deletingUploaded}
                    loading={deletingUploaded}
                    onClick={handleBulkDeleteUploaded}
                    className="rounded-lg text-xs font-bold text-brand-red border-red-200 hover:bg-red-50 hover:text-brand-red"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {locale === "bn" ? "মুছে ফেলুন" : "Delete Selected"}
                  </Button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {uploadedQuestions.map((q, idx) => (
                  <article
                    key={q.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUploadedIds.includes(q.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUploadedIds((prev) => [...prev, q.id]);
                            } else {
                              setSelectedUploadedIds((prev) => prev.filter((id) => id !== q.id));
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary size-4"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-primary">
                          Q {idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(q)}
                          className="rounded-lg h-8 text-xs font-bold text-primary"
                        >
                          <Edit className="size-3.5 mr-1" />
                          {locale === "bn" ? "এডিট" : "Edit"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUploadedQuestion(q.id)}
                          className="rounded-lg h-8 text-xs font-bold text-brand-red border-red-200 hover:bg-red-50 hover:text-brand-red"
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          {locale === "bn" ? "ডিলিট" : "Delete"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <h4 className="text-base font-bold text-foreground">{q.question}</h4>

                      {q.imageUrl && (
                        <Image
                          src={q.imageUrl}
                          alt="MCQ image"
                          width={768}
                          height={512}
                          className="h-auto max-h-48 max-w-full rounded border bg-secondary/10 object-contain"
                        />
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((opt: string, oIdx: number) => {
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Review Teacher MCQs Panel ─── */}
      <div className="rounded-xl border-2 border-primary/20 bg-card p-5 shadow-[var(--shadow-sm)]">
        <AdminTeacherMcqReview />
      </div>

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
                        id="image-file-edit"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="image-file-edit"
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
                    <p className="text-[10px] text-muted-foreground">Formats: PNG, JPG, WebP. Hosted securely on Cloudinary.</p>
                  </div>

                  {editForm.imageUrl && (
                    <div className="relative size-20 rounded-lg border border-border bg-secondary/10 overflow-hidden shrink-0 group">
                      <Image src={editForm.imageUrl} alt="Preview" fill sizes="80px" className="object-contain" />
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

              {/* Subject/Chapter select for Edit */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-level" className="font-bold">Level</Label>
                  <select
                    id="edit-level"
                    value={editForm.level}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, level: e.target.value as SchoolLevel }))}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  >
                    <option value="ssc">SSC</option>
                    <option value="hsc">HSC</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-subject" className="font-bold">Subject</Label>
                  <select
                    id="edit-subject"
                    value={editForm.subject}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value as CourseSubject }))}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  >
                    {(editForm.level === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-chapter" className="font-bold">Chapter</Label>
                  <select
                    id="edit-chapter"
                    value={editForm.chapter}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, chapter: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary transition"
                  >
                    {(getSyllabusChapters(editForm.level, editForm.subject)).map((chap) => (
                      <option key={chap} value={chap}>{chap}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className="grid gap-3 sm:grid-cols-2">
                {editForm.options.map((opt: string, idx: number) => (
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
                  {OPTION_BADGES.map((badge: string, idx: number) => (
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
                disabled={savingEdit}
                className="rounded-xl px-5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                loading={savingEdit}
                disabled={savingEdit}
                className="rounded-xl px-6"
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
