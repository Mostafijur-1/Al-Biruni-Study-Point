"use client";

import { useState, useEffect } from "react";
import { formatClassList } from "@/lib/content/classes";
import { useSession } from "@/lib/hooks/use-session";
import { AuthGateLink } from "@/components/auth/AuthGateLink";
import type { StudentClass } from "@/types";
import { useAppStore } from "@/stores/useAppStore";
import { apiFetch, isApiSuccess } from "@/lib/api/client";

type CourseRow = {
  _id: string;
  title: string;
  titleBn?: string;
  subject: string;
  level: string;
  targetClasses: StudentClass[];
};

type VideoRow = {
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;
  targetClasses: StudentClass[];
};

type Props = {
  level: "SSC" | "HSC";
};

export function StudentClassCourses({ level }: Props) {
  const locale = "bn";
  const { user, checking } = useSession({ listenToAuthChanges: true });
  const isGuest = !user;

  const { coursesCache, setCoursesCache, videosCache, setVideosCache } = useAppStore();

  const coursesUrl = checking
    ? ""
    : isGuest
      ? `/api/courses?scope=guest&level=${level}`
      : "/api/courses?scope=student";

  const videosUrl = checking
    ? ""
    : isGuest
      ? `/api/videos?scope=guest&level=${level}`
      : "/api/videos?scope=student";

  const coursesKey = checking ? "" : isGuest ? `courses_guest_${level}` : "courses_student";
  const videosKey = checking ? "" : isGuest ? `videos_guest_${level}` : "videos_student";

  const [courses, setCourses] = useState<CourseRow[]>(() => {
    return (coursesKey ? coursesCache[coursesKey] : null) || [];
  });
  const [videos, setVideos] = useState<VideoRow[]>(() => {
    return (videosKey ? videosCache[videosKey] : null) || [];
  });

  const [coursesLoading, setCoursesLoading] = useState(() => {
    return coursesKey ? !coursesCache[coursesKey] : true;
  });
  const [videosLoading, setVideosLoading] = useState(() => {
    return videosKey ? !videosCache[videosKey] : true;
  });

  const [coursesError, setCoursesError] = useState("");
  const [videosError, setVideosError] = useState("");

  useEffect(() => {
    if (checking || !coursesUrl || !coursesKey) return;

    async function loadCourses() {
      try {
        if (!coursesCache[coursesKey]) {
          setCoursesLoading(true);
        }
        setCoursesError("");
        const { ok, payload } = await apiFetch<{ courses: CourseRow[] }>(coursesUrl);
        if (ok && isApiSuccess(payload)) {
          setCourses(payload.data.courses);
          setCoursesCache(coursesKey, payload.data.courses);
        } else {
          if (!coursesCache[coursesKey]) {
            setCoursesError("কোর্স লোড করা যায়নি।");
          }
        }
      } catch {
        if (!coursesCache[coursesKey]) {
          setCoursesError("কোর্স লোড করা যায়নি।");
        }
      } finally {
        setCoursesLoading(false);
      }
    }
    loadCourses();
  }, [checking, coursesUrl, coursesKey, coursesCache, setCoursesCache]);

  useEffect(() => {
    if (checking || !videosUrl || !videosKey) return;

    async function loadVideos() {
      try {
        if (!videosCache[videosKey]) {
          setVideosLoading(true);
        }
        setVideosError("");
        const { ok, payload } = await apiFetch<{ videos: VideoRow[] }>(videosUrl);
        if (ok && isApiSuccess(payload)) {
          setVideos(payload.data.videos);
          setVideosCache(videosKey, payload.data.videos);
        } else {
          if (!videosCache[videosKey]) {
            setVideosError("ভিডিও লোড করা যায়নি।");
          }
        }
      } catch {
        if (!videosCache[videosKey]) {
          setVideosError("ভিডিও লোড করা যায়নি।");
        }
      } finally {
        setVideosLoading(false);
      }
    }
    loadVideos();
  }, [checking, videosUrl, videosKey, videosCache, setVideosCache]);

  const courseMessage = coursesLoading ? "কোর্স লোড হচ্ছে..." : coursesError ? coursesError : null;
  const videoMessage = videosLoading ? "ভিডিও লোড হচ্ছে..." : videosError ? videosError : null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-primary">
          {"আমার কোর্স"}
        </h2>
        {courseMessage ? (
          <p className="text-sm text-muted">{courseMessage}</p>
        ) : courses.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
            {"আপনার শ্রেণির জন্য এখনও কোনো কোর্স নেই।"}
          </p>
        ) : (
          <ul className="grid gap-3">
            {courses.map((course) => (
              <li key={course._id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-primary">
                  {course.titleBn ? course.titleBn : course.title}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {course.subject} · {course.level}
                </p>
                <p className="mt-1 text-xs text-muted">{formatClassList(course.targetClasses, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-primary">
          {"ক্লাস ভিডিও"}
        </h2>
        {videoMessage ? (
          <p className="text-sm text-muted">{videoMessage}</p>
        ) : videos.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
            {"আপনার শ্রেণির জন্য এখনও কোনো ভিডিও নেই।"}
          </p>
        ) : (
          <ul className="grid gap-3">
            {videos.map((video) => (
              <li key={video._id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-primary">{video.title}</p>
                {video.description && <p className="mt-1 text-sm text-muted">{video.description}</p>}
                {isGuest ? (
                  <AuthGateLink
                    href={video.videoUrl}
                    returnUrl={`/student/courses?level=${level}`}
                    className="mt-2 inline-block text-sm font-semibold text-brand-red hover:underline"
                  >
                    {"ভিডিও দেখুন"}
                  </AuthGateLink>
                ) : (
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-brand-red hover:underline"
                  >
                    {"ভিডিও দেখুন"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
