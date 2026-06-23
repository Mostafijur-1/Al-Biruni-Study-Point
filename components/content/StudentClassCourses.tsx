"use client";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { formatClassList } from "@/lib/content/classes";
import { useSession } from "@/lib/hooks/use-session";
import { AuthGateLink } from "@/components/auth/AuthGateLink";
import type { Locale } from "@/lib/i18n";
import type { StudentClass } from "@/types";

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

  const { data: courseData, message: courseMessage } = useApiQuery<{ courses: CourseRow[] }>(
    coursesUrl,
    {
      enabled: !checking,
      loadingMessage: "কোর্স লোড হচ্ছে...",
      errorMessage: "কোর্স লোড করা যায়নি।",
    },
  );

  const { data: videoData, message: videoMessage } = useApiQuery<{ videos: VideoRow[] }>(
    videosUrl,
    {
      enabled: !checking,
      loadingMessage: "ভিডিও লোড হচ্ছে...",
      errorMessage: "ভিডিও লোড করা যায়নি।",
    },
  );

  const courses = courseData?.courses ?? [];
  const videos = videoData?.videos ?? [];

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
