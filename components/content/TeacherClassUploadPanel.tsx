"use client";

import { useEffect, useState } from "react";

import { TargetClassPicker } from "@/components/content/TargetClassPicker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { formatClassList } from "@/lib/content/classes";
import type { Locale } from "@/lib/i18n";
import type { StudentClass } from "@/types";

type TeacherClassUploadPanelProps = {
  locale: Locale;
};

type VideoRow = {
  _id: string;
  title: string;
  videoUrl: string;
  targetClasses: StudentClass[];
  isPublished: boolean;
};

type CourseRow = {
  _id: string;
  title: string;
  titleBn?: string;
  subject: string;
  level: string;
  targetClasses: StudentClass[];
};

type AssignmentRow = {
  _id: string;
  title: string;
  totalMarks: number;
  targetClasses: StudentClass[];
};

export function TeacherClassUploadPanel({ locale }: TeacherClassUploadPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseTitleBn, setCourseTitleBn] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseLevel, setCourseLevel] = useState<"SSC" | "HSC">("SSC");
  const [courseSubject, setCourseSubject] = useState<
    "Physics" | "Chemistry" | "Math" | "Higher Math" | "ICT"
  >("Physics");
  const [cqTitle, setCqTitle] = useState("");
  const [cqDescription, setCqDescription] = useState("");
  const [cqMarks, setCqMarks] = useState(10);
  const [targetClasses, setTargetClasses] = useState<StudentClass[]>(["class-9"]);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseMessage, setCourseMessage] = useState<string | null>(null);
  const [courseSuccess, setCourseSuccess] = useState(false);
  const [isCourseSubmitting, setIsCourseSubmitting] = useState(false);
  const [cqMessage, setCqMessage] = useState<string | null>(null);
  const [cqSuccess, setCqSuccess] = useState(false);
  const [isCqSubmitting, setIsCqSubmitting] = useState(false);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [listMessage, setListMessage] = useState(
    locale === "bn" ? "লোড হচ্ছে..." : "Loading...",
  );

  async function loadContent() {
    const [videosRes, coursesRes, assignmentsRes] = await Promise.all([
      apiFetch<{ videos: VideoRow[] }>("/api/videos"),
      apiFetch<{ courses: CourseRow[] }>("/api/courses"),
      apiFetch<{ assignments: AssignmentRow[] }>("/api/cq/assignments"),
    ]);

    if (!videosRes.ok || !isApiSuccess(videosRes.payload)) {
      setListMessage(getApiErrorMessage(videosRes.payload, "Could not load content."));
      return;
    }

    setVideos(videosRes.payload.data.videos);
    setCourses(
      coursesRes.ok && isApiSuccess(coursesRes.payload) ? coursesRes.payload.data.courses : [],
    );
    setAssignments(
      assignmentsRes.ok && isApiSuccess(assignmentsRes.payload)
        ? assignmentsRes.payload.data.assignments
        : [],
    );
    setListMessage("");
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadContent().catch(() => setListMessage("Could not load content."));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setIsSuccess(false);
    setIsSubmitting(true);

    const { ok, payload } = await apiFetch<{ video: VideoRow }>("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        videoUrl,
        targetClasses,
        isPublished: true,
      }),
    });

    setIsSubmitting(false);

    if (!ok || !isApiSuccess(payload)) {
      setMessage(getApiErrorMessage(payload, "Could not upload class."));
      return;
    }

    setMessage(
      locale === "bn" ? "ক্লাস কন্টেন্ট সংরক্ষণ হয়েছে।" : "Class content saved successfully.",
    );
    setIsSuccess(true);
    setTitle("");
    setDescription("");
    setVideoUrl("");
    await loadContent();
  }

  async function onCourseSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCourseMessage(null);
    setCourseSuccess(false);
    setIsCourseSubmitting(true);

    const { ok, payload } = await apiFetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: courseTitle,
        titleBn: courseTitleBn || courseTitle,
        description: courseDescription,
        level: courseLevel,
        subject: courseSubject,
        targetClasses,
        isPublished: true,
      }),
    });

    setIsCourseSubmitting(false);

    if (!ok || !isApiSuccess(payload)) {
      setCourseMessage(getApiErrorMessage(payload, "Could not save course."));
      return;
    }

    setCourseMessage(locale === "bn" ? "কোর্স সংরক্ষণ হয়েছে।" : "Course saved successfully.");
    setCourseSuccess(true);
    setCourseTitle("");
    setCourseTitleBn("");
    setCourseDescription("");
    await loadContent();
  }

  async function onCqSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCqMessage(null);
    setCqSuccess(false);
    setIsCqSubmitting(true);

    const { ok, payload } = await apiFetch("/api/cq/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cqTitle,
        description: cqDescription,
        targetClasses,
        totalMarks: cqMarks,
        isPublished: true,
      }),
    });

    setIsCqSubmitting(false);

    if (!ok || !isApiSuccess(payload)) {
      setCqMessage(getApiErrorMessage(payload, "Could not save assignment."));
      return;
    }

    setCqMessage(locale === "bn" ? "CQ সংরক্ষণ হয়েছে।" : "CQ assignment saved successfully.");
    setCqSuccess(true);
    setCqTitle("");
    setCqDescription("");
    await loadContent();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Teacher panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {locale === "bn" ? "ক্লাস কন্টেন্ট আপলোড" : "Upload class content"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "ভিডিও আপলোডের সময় লক্ষ্য শ্রেণি নির্বাচন করুন। শুধু সেই শ্রেণির শিক্ষার্থীরা দেখতে পাবে।"
            : "Select target class(es) when uploading. Only students in those classes will see the content."}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
      >
        <h2 className="text-lg font-bold text-primary">
          {locale === "bn" ? "ভিডিও আপলোড" : "Upload video"}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="video-title">{locale === "bn" ? "শিরোনাম" : "Title"}</Label>
          <Input
            id="video-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-url">{locale === "bn" ? "ভিডিও লিংক" : "Video URL"}</Label>
          <Input
            id="video-url"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-desc">{locale === "bn" ? "বিবরণ" : "Description"}</Label>
          <textarea
            id="video-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-3 text-sm"
          />
        </div>

        <TargetClassPicker
          locale={locale}
          value={targetClasses}
          onChange={setTargetClasses}
          label={locale === "bn" ? "লক্ষ্য শ্রেণি" : "Target class(es)"}
        />

        {message && <Alert variant={isSuccess ? "success" : "destructive"}>{message}</Alert>}

        <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
          {locale === "bn" ? "ভিডিও সংরক্ষণ" : "Save video"}
        </Button>
      </form>

      <form
        onSubmit={onCourseSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
      >
        <h2 className="text-lg font-bold text-primary">
          {locale === "bn" ? "কোর্স তৈরি" : "Create course"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="course-title">{locale === "bn" ? "শিরোনাম (ইংরেজি)" : "Title (English)"}</Label>
            <Input
              id="course-title"
              value={courseTitle}
              onChange={(event) => setCourseTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-title-bn">{locale === "bn" ? "শিরোনাম (বাংলা)" : "Title (Bangla)"}</Label>
            <Input
              id="course-title-bn"
              value={courseTitleBn}
              onChange={(event) => setCourseTitleBn(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="course-level">{locale === "bn" ? "স্তর" : "Level"}</Label>
            <select
              id="course-level"
              value={courseLevel}
              onChange={(event) => setCourseLevel(event.target.value as "SSC" | "HSC")}
              className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm"
            >
              <option value="SSC">SSC</option>
              <option value="HSC">HSC</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-subject">{locale === "bn" ? "বিষয়" : "Subject"}</Label>
            <select
              id="course-subject"
              value={courseSubject}
              onChange={(event) =>
                setCourseSubject(
                  event.target.value as "Physics" | "Chemistry" | "Math" | "Higher Math" | "ICT",
                )
              }
              className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm"
            >
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Math">Math</option>
              <option value="Higher Math">Higher Math</option>
              <option value="ICT">ICT</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="course-desc">{locale === "bn" ? "বিবরণ" : "Description"}</Label>
          <textarea
            id="course-desc"
            value={courseDescription}
            onChange={(event) => setCourseDescription(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-3 text-sm"
          />
        </div>
        <TargetClassPicker
          locale={locale}
          value={targetClasses}
          onChange={setTargetClasses}
          label={locale === "bn" ? "লক্ষ্য শ্রেণি" : "Target class(es)"}
        />
        {courseMessage && (
          <Alert variant={courseSuccess ? "success" : "destructive"}>{courseMessage}</Alert>
        )}
        <Button type="submit" loading={isCourseSubmitting} className="w-full sm:w-auto">
          {locale === "bn" ? "কোর্স সংরক্ষণ" : "Save course"}
        </Button>
      </form>

      <form
        onSubmit={onCqSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
      >
        <h2 className="text-lg font-bold text-primary">
          {locale === "bn" ? "CQ অ্যাসাইনমেন্ট" : "CQ assignment"}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="cq-title">{locale === "bn" ? "শিরোনাম" : "Title"}</Label>
          <Input
            id="cq-title"
            value={cqTitle}
            onChange={(event) => setCqTitle(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cq-desc">{locale === "bn" ? "বিবরণ" : "Description"}</Label>
          <textarea
            id="cq-desc"
            value={cqDescription}
            onChange={(event) => setCqDescription(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cq-marks">{locale === "bn" ? "মোট নম্বর" : "Total marks"}</Label>
          <Input
            id="cq-marks"
            type="number"
            min={1}
            max={100}
            value={cqMarks}
            onChange={(event) => setCqMarks(Number(event.target.value))}
            required
          />
        </div>
        <TargetClassPicker
          locale={locale}
          value={targetClasses}
          onChange={setTargetClasses}
          label={locale === "bn" ? "লক্ষ্য শ্রেণি" : "Target class(es)"}
        />
        {cqMessage && <Alert variant={cqSuccess ? "success" : "destructive"}>{cqMessage}</Alert>}
        <Button type="submit" loading={isCqSubmitting} className="w-full sm:w-auto">
          {locale === "bn" ? "CQ সংরক্ষণ" : "Save CQ"}
        </Button>
      </form>

      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-lg font-bold text-primary">
          {locale === "bn" ? "আপনার কন্টেন্ট" : "Your content"}
        </h2>
        {listMessage ? (
          <p className="mt-3 text-sm text-muted">{listMessage}</p>
        ) : videos.length === 0 && courses.length === 0 && assignments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {locale === "bn" ? "এখনও কোনো কন্টেন্ট আপলোড করা হয়নি।" : "No content uploaded yet."}
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {videos.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-accent">
                  {locale === "bn" ? "ভিডিও" : "Videos"}
                </h3>
                <ul className="mt-2 space-y-2">
                  {videos.map((video) => (
                    <li key={video._id} className="rounded-lg border border-border bg-surface p-4">
                      <p className="font-semibold text-primary">{video.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatClassList(video.targetClasses, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courses.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-accent">
                  {locale === "bn" ? "কোর্স" : "Courses"}
                </h3>
                <ul className="mt-2 space-y-2">
                  {courses.map((course) => (
                    <li key={course._id} className="rounded-lg border border-border bg-surface p-4">
                      <p className="font-semibold text-primary">{course.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {course.subject} · {formatClassList(course.targetClasses, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {assignments.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-accent">CQ</h3>
                <ul className="mt-2 space-y-2">
                  {assignments.map((assignment) => (
                    <li
                      key={assignment._id}
                      className="rounded-lg border border-border bg-surface p-4"
                    >
                      <p className="font-semibold text-primary">{assignment.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {assignment.totalMarks} {locale === "bn" ? "নম্বর" : "marks"} ·{" "}
                        {formatClassList(assignment.targetClasses, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
