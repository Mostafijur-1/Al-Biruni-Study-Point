"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Atom,
  Beaker,
  BookOpen,
  Brain,
  Calculator,
  CheckCircle2,
  Cpu,
  Database,
  FileImage,
  FileJson,
  FileText,
  GraduationCap,
  RefreshCw,
  Save,
  Server,
  Settings,
  Type,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { SYLLABUS, type SchoolLevel } from "@/lib/content/syllabus";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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

/** SSC subjects for upload */
const SSC_SUBJECTS: CourseSubject[] = ["Physics", "Chemistry", "Math", "Higher Math", "ICT"];

/** HSC subjects — paper-split for Physics, Chemistry, Higher Math */
const HSC_SUBJECTS: CourseSubject[] = [
  "Physics 1st Paper",
  "Physics 2nd Paper",
  "Chemistry 1st Paper",
  "Chemistry 2nd Paper",
  "Higher Math 1st Paper",
  "Higher Math 2nd Paper",
  "ICT",
];

export function AdminPracticeManager({ locale }: { locale: Locale }) {
  // Config states
  const [selectedLevel, setSelectedLevel] = useState<SchoolLevel>("ssc");
  const [selectedSubject, setSelectedSubject] = useState<CourseSubject>("Physics");

  const SUBJECTS = selectedLevel === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;

  // Chapter list from static syllabus
  const chapters = SYLLABUS[selectedLevel]?.[selectedSubject] || [];
  const [selectedChapter, setSelectedChapter] = useState("");

  // Content upload states
  const [contentType, setContentType] = useState<"text" | "file" | "image">("text");
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

  // Reset selected chapter when level or subject changes
  useEffect(() => {
    const subjects = selectedLevel === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;
    // If the currently selected subject is not valid for this level, reset it
    if (!subjects.includes(selectedSubject)) {
      setSelectedSubject(subjects[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel]);

  useEffect(() => {
    const list = SYLLABUS[selectedLevel]?.[selectedSubject] || [];
    if (list.length > 0) {
      setSelectedChapter(list[0]);
    } else {
      setSelectedChapter("");
    }
  }, [selectedLevel, selectedSubject]);

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
        locale === "bn" ? "অনুগ্রহ করে একটি ফাইল নির্বাচন করুন।" : "Please select a file to upload."
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
      } else {
        formData.append("file", selectedFile as Blob);
      }

      const response = await fetch("/api/admin/practice-mcqs/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setErrorMessage(
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

  // DB Sync states
  const [serverFiles, setServerFiles] = useState<Array<{
    level: "ssc" | "hsc";
    subject: string;
    chapter: string;
    questionCount: number;
    isSynced: boolean;
  }>>([]);
  const [selectedServerFiles, setSelectedServerFiles] = useState<Array<{
    level: "ssc" | "hsc";
    subject: string;
    chapter: string;
  }>>([]);
  const [serverFilesLoading, setServerFilesLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState("");

  // DB Direct Upload states
  const [localUploadLevel, setLocalUploadLevel] = useState<SchoolLevel>("ssc");
  const [localUploadSubject, setLocalUploadSubject] = useState<CourseSubject>("Physics");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [localUploading, setLocalUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  const localSubjects = localUploadLevel === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;

  // Sync direct local level with local subjects list
  useEffect(() => {
    const subjects = localUploadLevel === "hsc" ? HSC_SUBJECTS : SSC_SUBJECTS;
    if (!subjects.includes(localUploadSubject)) {
      setLocalUploadSubject(subjects[0]);
    }
  }, [localUploadLevel]);

  // Fetch server files list on mount
  async function fetchServerFiles() {
    setServerFilesLoading(true);
    setSyncError("");
    try {
      const response = await fetch("/api/admin/practice-mcqs/list-files");
      const payload = await response.json();
      if (response.ok && payload.success) {
        setServerFiles(payload.data);
      } else {
        setSyncError(payload.error?.message || "Failed to load files from server.");
      }
    } catch {
      setSyncError("Could not connect to the server.");
    } finally {
      setServerFilesLoading(false);
    }
  }

  useEffect(() => {
    fetchServerFiles();
  }, []);

  // Sync selected server files to MongoDB
  async function handleServerSync(e: React.FormEvent) {
    e.preventDefault();
    if (selectedServerFiles.length === 0) {
      setSyncError("Please select at least one file to sync.");
      return;
    }

    setSyncing(true);
    setSyncError("");
    setSyncSuccess("");

    try {
      const response = await fetch("/api/admin/practice-mcqs/db-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: selectedServerFiles }),
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        setSyncSuccess(
          locale === "bn"
            ? `সফলভাবে ডেটাবেজে ${payload.data.addedCount}টি প্রশ্ন যুক্ত করা হয়েছে!`
            : `Successfully synced ${payload.data.addedCount} questions to the database!`
        );
        // Automatically mark as synced in state
        setServerFiles((prev) =>
          prev.map((f) => {
            const wasSelected = selectedServerFiles.some(
              (sf) => sf.level === f.level && sf.subject === f.subject && sf.chapter === f.chapter
            );
            return wasSelected ? { ...f, isSynced: true } : f;
          })
        );
        setSelectedServerFiles([]);
      } else {
        setSyncError(payload.error?.message || "Sync failed.");
      }
    } catch {
      setSyncError("Could not connect to the server.");
    } finally {
      setSyncing(false);
    }
  }

  // Upload local computer JSON files direct to MongoDB
  async function handleLocalJsonUpload(e: React.FormEvent) {
    e.preventDefault();
    if (localFiles.length === 0) {
      setLocalError("Please select at least one JSON file.");
      return;
    }

    setLocalUploading(true);
    setLocalError("");
    setLocalSuccess("");

    try {
      const formData = new FormData();
      formData.append("level", localUploadLevel);
      formData.append("subject", localUploadSubject);
      for (const file of localFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/admin/practice-mcqs/db-upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        let msg = locale === "bn"
          ? `সফলভাবে ${payload.data.addedCount}টি প্রশ্ন আপলোড করা হয়েছে!`
          : `Successfully uploaded ${payload.data.addedCount} questions!`;
        if (payload.data.skippedCount > 0) {
          msg += locale === "bn"
            ? ` বাদ দেওয়া ফাইলসমূহ: ${payload.data.skippedFiles.join(", ")}`
            : ` Skipped ${payload.data.skippedCount} files: ${payload.data.skippedFiles.join(", ")}`;
        }
        setLocalSuccess(msg);
        setLocalFiles([]);
        fetchServerFiles(); // Refresh synced indicators
      } else {
        setLocalError(payload.error?.message || "Upload failed.");
      }
    } catch {
      setLocalError("Could not connect to the server.");
    } finally {
      setLocalUploading(false);
    }
  }

  // Toggle server files selection
  function toggleServerFile(level: "ssc" | "hsc", subject: string, chapter: string) {
    const exists = selectedServerFiles.some(
      (f) => f.level === level && f.subject === subject && f.chapter === chapter
    );
    if (exists) {
      setSelectedServerFiles((prev) =>
        prev.filter((f) => !(f.level === level && f.subject === subject && f.chapter === chapter))
      );
    } else {
      setSelectedServerFiles((prev) => [...prev, { level, subject, chapter }]);
    }
  }

  // Toggle select all server files
  function toggleSelectAllServerFiles() {
    const unsyncedFiles = serverFiles.filter((f) => !f.isSynced);
    if (selectedServerFiles.length === unsyncedFiles.length) {
      setSelectedServerFiles([]);
    } else {
      setSelectedServerFiles(
        unsyncedFiles.map((f) => ({ level: f.level, subject: f.subject, chapter: f.chapter }))
      );
    }
  }

  // Toggle SyncedChapter mark manually
  async function toggleMarkSync(
    level: "ssc" | "hsc",
    subject: string,
    chapter: string,
    currentMark: boolean
  ) {
    const newMark = !currentMark;
    try {
      const response = await fetch("/api/admin/practice-mcqs/mark-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, subject, chapter, mark: newMark }),
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        setServerFiles((prev) =>
          prev.map((f) =>
            f.level === level && f.subject === subject && f.chapter === chapter
              ? { ...f, isSynced: newMark }
              : f
          )
        );
        // If marked, deselect it from server sync list
        if (newMark) {
          setSelectedServerFiles((prev) =>
            prev.filter((f) => !(f.level === level && f.subject === subject && f.chapter === chapter))
          );
        }
      } else {
        setSyncError(payload.error?.message || "Failed to update synced mark.");
      }
    } catch {
      setSyncError("Could not connect to the server.");
    }
  }

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

      {/* ─── Upload MCQs ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
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
                onChange={(e) => setSelectedLevel(e.target.value as SchoolLevel)}
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
                onChange={(e) => setSelectedSubject(e.target.value as CourseSubject)}
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
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setContentType("text")}
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
                onClick={() => setContentType("file")}
                className={cn(
                  "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition",
                  contentType === "file"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted hover:border-primary/20"
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span>{locale === "bn" ? "টেক্সট ফাইল" : "Text File"}</span>
              </button>

              <button
                type="button"
                onClick={() => setContentType("image")}
                className={cn(
                  "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition",
                  contentType === "image"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted hover:border-primary/20"
                )}
              >
                <FileImage className="size-4 shrink-0" />
                <span>{locale === "bn" ? "ছবি আপলোড" : "Image File"}</span>
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
                {contentType === "image"
                  ? locale === "bn"
                    ? "এমসিকিউ প্রশ্ন সম্বলিত ছবি (.png, .jpg)"
                    : "Upload Question Image (.png, .jpg)"
                  : locale === "bn"
                    ? "এমসিকিউ টেক্সট ফাইল (.txt)"
                    : "Upload Text File (.txt)"}
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="file-input"
                  type="file"
                  accept={contentType === "image" ? "image/*" : ".txt,text/plain"}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-3 text-sm font-semibold text-muted hover:border-primary/30 hover:bg-secondary/40 transition"
                >
                  <Upload className="size-4" />
                  {selectedFile ? selectedFile.name : locale === "bn" ? "ফাইল নির্বাচন করুন" : "Choose File"}
                </button>
                {selectedFile && (
                  <span className="text-xs text-muted">
                    {Math.round(selectedFile.size / 1024)} KB
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action button & states */}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-xl"
            loading={submitting}
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Brain className="size-4 animate-pulse text-brand-yellow" />
                {locale === "bn" ? "জেমিনি এআই রূপান্তর করছে..." : "Gemini AI converting..."}
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
                  <div key={q.id} className="rounded-lg border border-border bg-surface p-3 text-sm space-y-2">
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

      {/* ─── Database Sync & Upload ─── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-6">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Database className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              {locale === "bn" ? "ডেটাবেজ সিঙ্ক ও আপলোড" : "Database Sync & Upload"}
            </h2>
            <p className="text-xs text-muted">
              {locale === "bn"
                ? "লোকাল ফাইল ডেটাবেজে যুক্ত করুন বা সরাসরি নতুন জেএসওএন আপলোড করুন।"
                : "Sync local files to MongoDB or upload JSON files directly."}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Server Sync */}
          <div className="border border-border rounded-xl p-4 bg-surface/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-primary flex items-center gap-2">
                <Server className="size-4 text-accent" />
                {locale === "bn" ? "সার্ভার ফাইল সিঙ্ক" : "Server Files Sync"}
              </h3>
              <button
                type="button"
                onClick={fetchServerFiles}
                className="text-xs text-muted hover:text-primary flex items-center gap-1 transition"
              >
                <RefreshCw className="size-3" />
                {locale === "bn" ? "রিফ্রেশ" : "Refresh"}
              </button>
            </div>

            {serverFilesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {locale === "bn" ? "ফাইল খোঁজা হচ্ছে..." : "Loading server files..."}
              </div>
            ) : serverFiles.length === 0 ? (
              <p className="text-xs text-muted py-8 text-center">
                {locale === "bn" ? "সার্ভারে কোনো অনুশীলন ফাইল পাওয়া যায়নি।" : "No practice files found on the server."}
              </p>
            ) : (
              <form onSubmit={handleServerSync} className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-muted border-b border-border pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedServerFiles.length === serverFiles.filter((f) => !f.isSynced).length &&
                        serverFiles.filter((f) => !f.isSynced).length > 0
                      }
                      onChange={toggleSelectAllServerFiles}
                      disabled={serverFiles.filter((f) => !f.isSynced).length === 0}
                      className="rounded border-border text-primary focus:ring-primary size-3.5 disabled:opacity-50"
                    />
                    <span>{locale === "bn" ? "সব নির্বাচন করুন" : "Select All"}</span>
                  </label>
                  <span>
                    {selectedServerFiles.length} / {serverFiles.length} {locale === "bn" ? "ফাইল নির্বাচিত" : "files selected"}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {serverFiles.map((file, idx) => {
                    const isSelected = selectedServerFiles.some(
                      (f) => f.level === file.level && f.subject === file.subject && f.chapter === file.chapter
                    );
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between rounded-lg border border-border bg-card p-2 text-xs transition",
                          file.isSynced ? "bg-secondary/20 opacity-80" : "hover:border-primary/30"
                        )}
                      >
                        <label
                          className={cn(
                            "flex items-start gap-3 font-medium flex-1 min-w-0",
                            file.isSynced ? "cursor-not-allowed text-muted" : "cursor-pointer"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={file.isSynced}
                            onChange={() => toggleServerFile(file.level, file.subject, file.chapter)}
                            className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5 disabled:opacity-50"
                          />
                          <div className="space-y-0.5 truncate">
                            <div className={cn("font-bold text-primary truncate", file.isSynced && "text-muted")}>
                              {file.chapter}
                            </div>
                            <div className="text-2xs text-muted flex items-center gap-2 flex-wrap">
                              <span className="uppercase font-bold text-accent">{file.level}</span>
                              <span>•</span>
                              <span>{file.subject}</span>
                              <span>•</span>
                              <span className="font-semibold text-emerald-600">
                                {file.questionCount} {locale === "bn" ? "টি প্রশ্ন" : "questions"}
                              </span>
                              {file.isSynced && (
                                <span className="font-bold text-emerald-700 bg-emerald-100/50 border border-emerald-200/50 px-1 rounded">
                                  {locale === "bn" ? "চিহ্নিত" : "Marked"}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>

                        {/* Mark/Unmark toggle */}
                        <button
                          type="button"
                          onClick={() => toggleMarkSync(file.level, file.subject, file.chapter, file.isSynced)}
                          className={cn(
                            "ml-3 rounded px-2 py-1 text-2xs font-bold transition shrink-0",
                            file.isSynced
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          )}
                        >
                          {file.isSynced
                            ? locale === "bn"
                              ? "আনমার্ক"
                              : "Unmark"
                            : locale === "bn"
                              ? "মার্ক করুন"
                              : "Mark Synced"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {syncError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>{syncError}</span>
                  </div>
                )}

                {syncSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                    <span>{syncSuccess}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  loading={syncing}
                  disabled={syncing || selectedServerFiles.length === 0}
                  className="w-full rounded-xl py-2 text-xs font-bold"
                >
                  <Server className="mr-1.5 size-3.5" />
                  {locale === "bn" ? "ডেটাবেজে সিঙ্ক করুন" : "Sync to Database"}
                </Button>
              </form>
            )}
          </div>

          {/* Local JSON Upload */}
          <div className="border border-border rounded-xl p-4 bg-surface/50 space-y-4">
            <h3 className="font-display text-sm font-bold text-primary flex items-center gap-2">
              <FileJson className="size-4 text-accent" />
              {locale === "bn" ? "সরাসরি JSON ফাইল আপলোড" : "Direct JSON Files Upload"}
            </h3>

            <form onSubmit={handleLocalJsonUpload} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="db-level-select" className="text-2xs">
                    {locale === "bn" ? "শ্রেণি স্তর" : "Class Level"}
                  </Label>
                  <select
                    id="db-level-select"
                    value={localUploadLevel}
                    onChange={(e) => setLocalUploadLevel(e.target.value as SchoolLevel)}
                    className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary outline-none focus:border-primary"
                  >
                    <option value="ssc">SSC (Class 9-10)</option>
                    <option value="hsc">HSC (Class 11-12)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="db-subject-select" className="text-2xs">
                    {locale === "bn" ? "বিষয়" : "Subject"}
                  </Label>
                  <select
                    id="db-subject-select"
                    value={localUploadSubject}
                    onChange={(e) => setLocalUploadSubject(e.target.value as CourseSubject)}
                    className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary outline-none focus:border-primary"
                  >
                    {localSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="db-json-input" className="text-2xs">
                  {locale === "bn" ? "JSON ফাইলসমূহ (.json)" : "Select MCQ JSON Files (.json)"}
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="db-json-input"
                    type="file"
                    multiple
                    accept=".json,application/json"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setLocalFiles(files);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById("db-json-input")?.click()}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:border-primary/30 hover:bg-secondary/40 transition"
                  >
                    <Upload className="size-3.5" />
                    {localFiles.length > 0
                      ? `${localFiles.length} ${locale === "bn" ? "টি ফাইল নির্বাচন করা হয়েছে" : "files selected"}`
                      : locale === "bn" ? "ফাইলসমূহ নির্বাচন করুন" : "Choose Files"}
                  </button>
                </div>
                {localFiles.length > 0 && (
                  <div className="text-2xs text-muted max-h-20 overflow-y-auto border border-border bg-card/50 rounded-lg p-2 font-mono">
                    {localFiles.map((f, i) => (
                      <div key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</div>
                    ))}
                  </div>
                )}
              </div>

              {localError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>{localError}</span>
                </div>
              )}

              {localSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  <span>{localSuccess}</span>
                </div>
              )}

              <Button
                type="submit"
                loading={localUploading}
                disabled={localUploading || localFiles.length === 0}
                className="w-full rounded-xl py-2 text-xs font-bold"
              >
                <Upload className="mr-1.5 size-3.5" />
                {locale === "bn" ? "ডেটাবেজে আপলোড করুন" : "Upload to Database"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
