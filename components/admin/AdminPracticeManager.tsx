"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Atom,
  Beaker,
  Brain,
  Calculator,
  CheckCircle2,
  Cpu,
  FileImage,
  FileText,
  GraduationCap,
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

type SubjectStatus = {
  subject: string;
  chapters: string[];
  lastResult: any;
};

type ParsedQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

const SUBJECTS: CourseSubject[] = ["Physics", "Chemistry", "Math", "Higher Math", "ICT"];

export function AdminPracticeManager({ locale }: { locale: Locale }) {
  // Config states
  const [selectedLevel, setSelectedLevel] = useState<SchoolLevel>("ssc");
  const [selectedSubject, setSelectedSubject] = useState<CourseSubject>("Physics");
  
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

  // Reset selected chapter when level or subject changes
  useEffect(() => {
    const list = SYLLABUS[selectedLevel]?.[selectedSubject] || [];
    if (list.length > 0) {
      setSelectedChapter(list[0]);
    } else {
      setSelectedChapter("");
    }
  }, [selectedLevel, selectedSubject]);

  // Handle form submission
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
          getApiErrorMessage(payload, locale === "bn" ? "কনভার্ট করা ব্যর্থ হয়েছে।" : "Conversion failed.")
        );
        return;
      }

      setSuccessData(payload.data);
      setPastedText("");
      setSelectedFile(null);
    } catch (err) {
      setErrorMessage(
        locale === "bn"
          ? "সার্ভারের সাথে সংযোগ করা যায়নি।"
          : "Could not connect to the server."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {locale === "bn" ? "অনুশীলন এমসিকিউ আপলোড" : "Upload Practice MCQs"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "এমসিকিউ ধারণকারী টেক্সট বা ছবি আপলোড করুন, যা জেমিনি এআই দিয়ে স্বয়ংক্রিয়ভাবে প্র্যাকটিস ফাইলে যুক্ত হবে।"
            : "Upload text or images containing MCQs. Gemini AI will automatically parse and save them to the practice JSON store."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Form */}
        <form
          onSubmit={handleUpload}
          className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] space-y-5"
        >
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
              <Label htmlFor="subject-select">{locale === "bn" ? "বিষয়" : "Subject"}</Label>
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

          {/* Chapter Select (Selection Only) */}
          <div className="space-y-2">
            <Label htmlFor="chapter-select">{locale === "bn" ? "অধ্যায়" : "Chapter"}</Label>
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
                {locale === "bn" ? "অধ্যায় লোড করা যায়নি।" : "No chapters available."}
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
                    ? "১. ভৌত রাশির একক কোনটি?\nক) মিটার খ) সেকেন্ড গ) কেজি ঘ) সব কয়টি\nসঠিক উত্তর: ঘ\n\n(যেকোনো ফরম্যাটে লিখুন, এআই নিজে এটি সাজিয়ে নিবে!)"
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
                  ? "২. প্রতিটি এমসিকিউ এর অবশ্যই ৪টি অপশন থাকতে হবে। অপশন সংখ্যা কম হলে এআই নিজে থেকে প্রাসঙ্গিক অপশন তৈরি করে নিবে।"
                  : "2. Each MCQ must have exactly 4 options. If options are missing, the AI will generate plausible ones to ensure it has 4 choices."}
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
                    ? `সফলভাবে ${successData.addedCount}টি প্রশ্ন যুক্ত করা হয়েছে!`
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
    </div>
  );
}
