"use client";

import { useCallback, useEffect, useState } from "react";

import { TargetClassPicker } from "@/components/content/TargetClassPicker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { formatClassList, STUDENT_CLASSES } from "@/lib/content/classes";
import type { StudentClass } from "@/types";

type VideoRow = {
  _id: string;
  title: string;
  subject?: string;
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
  subject?: string;
  totalMarks: number;
  targetClasses: StudentClass[];
};

const COURSE_SUBJECTS = ["Physics", "Chemistry", "Math", "Higher Math", "ICT"] as const;
type SupportedCourseSubject = (typeof COURSE_SUBJECTS)[number];

type TeacherScopeResponse = {
  subjects: Array<{ subject: string }>;
  domain: {
    isAll: boolean;
    classes: StudentClass[];
    subjects: string[];
  };
};

export function TeacherClassUploadPanel() {
  const locale = "bn";
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
  const [videoTargetClasses, setVideoTargetClasses] = useState<StudentClass[]>(["class-9"]);
  const [courseTargetClasses, setCourseTargetClasses] = useState<StudentClass[]>(["class-9"]);
  const [cqTargetClasses, setCqTargetClasses] = useState<StudentClass[]>(["class-9"]);
  const [allowedClasses, setAllowedClasses] = useState<StudentClass[]>([...STUDENT_CLASSES]);
  const [allowedCourseSubjects, setAllowedCourseSubjects] = useState<SupportedCourseSubject[]>([...COURSE_SUBJECTS]);
  const [allowedContentSubjects, setAllowedContentSubjects] = useState<string[]>([]);
  const [videoSubject, setVideoSubject] = useState("");
  const [cqSubject, setCqSubject] = useState("");
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

  const loadContent = useCallback(async () => {
    const [videosRes, coursesRes, assignmentsRes, scopeRes] = await Promise.all([
      apiFetch<{ videos: VideoRow[] }>("/api/videos"),
      apiFetch<{ courses: CourseRow[] }>("/api/courses"),
      apiFetch<{ assignments: AssignmentRow[] }>("/api/cq/assignments"),
      apiFetch<TeacherScopeResponse>("/api/teacher/subjects"),
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
    if (scopeRes.ok && isApiSuccess(scopeRes.payload)) {
      const domain = scopeRes.payload.data.domain;
      const contentSubjects = Array.from(
        new Set(scopeRes.payload.data.subjects.map((item) => item.subject)),
      );
      const nextClasses = domain.classes;
      const nextSubjects = domain.isAll
        ? [...COURSE_SUBJECTS]
        : COURSE_SUBJECTS.filter((subject) => domain.subjects.includes(subject));
      setAllowedClasses(nextClasses);
      setAllowedCourseSubjects(nextSubjects);
      setAllowedContentSubjects(contentSubjects);
      setVideoSubject((current) => contentSubjects.includes(current) ? current : (contentSubjects[0] ?? ""));
      setCqSubject((current) => contentSubjects.includes(current) ? current : (contentSubjects[0] ?? ""));
      const keepAllowed = (current: StudentClass[]) => {
        const kept = current.filter((item) => nextClasses.includes(item));
        return kept.length > 0 ? kept : nextClasses.slice(0, 1);
      };
      setVideoTargetClasses(keepAllowed);
      setCourseTargetClasses(keepAllowed);
      setCqTargetClasses(keepAllowed);
      setCourseSubject((current) =>
        nextSubjects.includes(current) ? current : (nextSubjects[0] ?? "Physics"),
      );
      setCourseLevel((current) => {
        const hasCurrentLevel = nextClasses.some((item) =>
          current === "SSC"
            ? item === "class-9" || item === "class-10"
            : item === "class-11" || item === "class-12",
        );
        return hasCurrentLevel
          ? current
          : nextClasses.some((item) => item === "class-9" || item === "class-10")
            ? "SSC"
            : "HSC";
      });
    }
    setListMessage("");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadContent().catch(() => setListMessage("Could not load content."));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadContent]);

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
        subject: videoSubject,
        videoUrl,
        targetClasses: videoTargetClasses,
        isPublished: true,
      }),
    });

    setIsSubmitting(false);

    if (!ok || !isApiSuccess(payload)) {
      setMessage(getApiErrorMessage(payload, "Could not upload class."));
      return;
    }

    setMessage(
      locale === "bn" ? "Class Content Save হয়েছে।" : "Class content saved successfully.",
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
        targetClasses: courseTargetClasses,
        isPublished: true,
      }),
    });

    setIsCourseSubmitting(false);

    if (!ok || !isApiSuccess(payload)) {
      setCourseMessage(getApiErrorMessage(payload, "Could not save course."));
      return;
    }

    setCourseMessage(locale === "bn" ? "Course Save হয়েছে।" : "Course saved successfully.");
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
        subject: cqSubject,
        targetClasses: cqTargetClasses,
        totalMarks: cqMarks,
        isPublished: true,
      }),
    });

    setIsCqSubmitting(false);

    if (!ok || !isApiSuccess(payload)) {
      setCqMessage(getApiErrorMessage(payload, "Could not save assignment."));
      return;
    }

    setCqMessage(locale === "bn" ? "CQ Save হয়েছে।" : "CQ assignment saved successfully.");
    setCqSuccess(true);
    setCqTitle("");
    setCqDescription("");
    await loadContent();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
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

        <div className="space-y-2">
          <Label htmlFor="video-subject">বিষয়</Label>
          <select
            id="video-subject"
            value={videoSubject}
            onChange={(event) => setVideoSubject(event.target.value)}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm"
            required
          >
            {allowedContentSubjects.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>

        <TargetClassPicker
          value={videoTargetClasses}
          onChange={setVideoTargetClasses}
          allowedClasses={allowedClasses}
          label={locale === "bn" ? "লক্ষ্য শ্রেণি" : "Target class(es)"}
        />

        {message && <Alert variant={isSuccess ? "success" : "destructive"}>{message}</Alert>}

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!videoSubject || videoTargetClasses.length === 0}
          className="w-full sm:w-auto"
        >
          {locale === "bn" ? "Video Save করুন" : "Save video"}
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
              onChange={(event) => {
                const nextLevel = event.target.value as "SSC" | "HSC";
                setCourseLevel(nextLevel);
                const levelClasses = allowedClasses.filter((item) =>
                  nextLevel === "SSC"
                    ? item === "class-9" || item === "class-10"
                    : item === "class-11" || item === "class-12",
                );
                setCourseTargetClasses((current) => {
                  const kept = current.filter((item) => levelClasses.includes(item));
                  return kept.length > 0 ? kept : levelClasses.slice(0, 1);
                });
              }}
              className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm"
            >
              {allowedClasses.some((item) => item === "class-9" || item === "class-10") && <option value="SSC">SSC</option>}
              {allowedClasses.some((item) => item === "class-11" || item === "class-12") && <option value="HSC">HSC</option>}
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
              {allowedCourseSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
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
          value={courseTargetClasses}
          onChange={setCourseTargetClasses}
          allowedClasses={allowedClasses.filter((item) =>
            courseLevel === "SSC"
              ? item === "class-9" || item === "class-10"
              : item === "class-11" || item === "class-12",
          )}
          label={locale === "bn" ? "লক্ষ্য শ্রেণি" : "Target class(es)"}
        />
        {courseMessage && (
          <Alert variant={courseSuccess ? "success" : "destructive"}>{courseMessage}</Alert>
        )}
        <Button
          type="submit"
          loading={isCourseSubmitting}
          disabled={allowedCourseSubjects.length === 0 || courseTargetClasses.length === 0}
          className="w-full sm:w-auto"
        >
          {locale === "bn" ? "Course Save করুন" : "Save course"}
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
        <div className="space-y-2">
          <Label htmlFor="cq-subject">বিষয়</Label>
          <select
            id="cq-subject"
            value={cqSubject}
            onChange={(event) => setCqSubject(event.target.value)}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm"
            required
          >
            {allowedContentSubjects.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>

        <TargetClassPicker
          value={cqTargetClasses}
          onChange={setCqTargetClasses}
          allowedClasses={allowedClasses}
          label={locale === "bn" ? "লক্ষ্য শ্রেণি" : "Target class(es)"}
        />
        {cqMessage && <Alert variant={cqSuccess ? "success" : "destructive"}>{cqMessage}</Alert>}
        <Button
          type="submit"
          loading={isCqSubmitting}
          disabled={!cqSubject || cqTargetClasses.length === 0}
          className="w-full sm:w-auto"
        >
          {locale === "bn" ? "CQ Save করুন" : "Save CQ"}
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
