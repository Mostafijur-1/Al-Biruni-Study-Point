"use client";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { formatClassList } from "@/lib/content/classes";
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

export function StudentClassCourses({ locale }: { locale: Locale }) {
  const { data: courseData, message: courseMessage } = useApiQuery<{ courses: CourseRow[] }>(
    "/api/courses?scope=student",
    {
      loadingMessage: locale === "bn" ? "কোর্স লোড হচ্ছে..." : "Loading courses...",
      errorMessage: locale === "bn" ? "কোর্স লোড করা যায়নি।" : "Could not load courses.",
    },
  );

  const { data: videoData, message: videoMessage } = useApiQuery<{ videos: VideoRow[] }>(
    "/api/videos?scope=student",
    {
      loadingMessage: locale === "bn" ? "ভিডিও লোড হচ্ছে..." : "Loading videos...",
      errorMessage: locale === "bn" ? "ভিডিও লোড করা যায়নি।" : "Could not load videos.",
    },
  );

  const courses = courseData?.courses ?? [];
  const videos = videoData?.videos ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-primary">
          {locale === "bn" ? "আমার কোর্স" : "My courses"}
        </h2>
        {courseMessage ? (
          <p className="text-sm text-muted">{courseMessage}</p>
        ) : courses.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
            {locale === "bn"
              ? "আপনার শ্রেণির জন্য এখনও কোনো কোর্স নেই।"
              : "No courses are available for your class yet."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {courses.map((course) => (
              <li key={course._id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-primary">
                  {locale === "bn" && course.titleBn ? course.titleBn : course.title}
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
          {locale === "bn" ? "ক্লাস ভিডিও" : "Class videos"}
        </h2>
        {videoMessage ? (
          <p className="text-sm text-muted">{videoMessage}</p>
        ) : videos.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
            {locale === "bn"
              ? "আপনার শ্রেণির জন্য এখনও কোনো ভিডিও নেই।"
              : "No class videos are available for your class yet."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {videos.map((video) => (
              <li key={video._id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-primary">{video.title}</p>
                {video.description && <p className="mt-1 text-sm text-muted">{video.description}</p>}
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-brand-red hover:underline"
                >
                  {locale === "bn" ? "ভিডিও দেখুন" : "Watch video"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
