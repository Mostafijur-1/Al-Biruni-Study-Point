"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PlayCircle,
} from "lucide-react";

import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";

type VideoLessonData = {
  video: {
    id: string;
    title: string;
    description?: string;
    videoUrl: string;
  };
  progress: {
    status: "started" | "completed";
    watchedSeconds: number;
    durationSeconds: number;
    progressPercent: number;
    lastWatchedAt: string;
  } | null;
};

type ProgressResult = {
  status: "started" | "completed";
  watchedSeconds: number;
  durationSeconds: number;
  progressPercent: number;
};

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ||
        parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg)(?:$|\?)/i.test(url) || url.includes("/video/upload/");
}

export function VideoLessonPlayer({ videoId }: { videoId: string }) {
  const [data, setData] = useState<VideoLessonData | null>(null);
  const [progress, setProgress] = useState<ProgressResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastSavedSecond = useRef(0);

  const saveProgress = useCallback(
    async (
      status: "started" | "completed",
      watchedSeconds = 0,
      durationSeconds = 0,
    ) => {
      const { ok, payload } = await apiFetch<ProgressResult>(
        `/api/learning/videos/${videoId}/progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, watchedSeconds, durationSeconds }),
        },
      );
      if (ok && isApiSuccess(payload)) {
        setProgress(payload.data);
        trackStudentEvent("student_video_progress_updated", "video_lesson", {
          video_id: videoId,
          status: payload.data.status,
          progress_percent: payload.data.progressPercent,
        });
      }
      return ok;
    },
    [videoId],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const { ok, payload } = await apiFetch<VideoLessonData>(
        `/api/learning/videos/${videoId}/progress`,
      );
      if (active && ok && isApiSuccess(payload)) {
        setData(payload.data);
        setProgress(payload.data.progress);
        lastSavedSecond.current = payload.data.progress?.watchedSeconds ?? 0;
        if (payload.data.progress?.status !== "completed") {
          void saveProgress("started");
        }
      } else if (active) {
        setError(getApiErrorMessage(payload, "ভিডিও ক্লাসটি লোড করা যায়নি।"));
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [saveProgress, videoId]);

  async function markCompleted() {
    setSaving(true);
    await saveProgress(
      "completed",
      progress?.durationSeconds || progress?.watchedSeconds || 0,
      progress?.durationSeconds || 0,
    );
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="grid min-h-72 place-items-center rounded-2xl bg-secondary/40">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!data || error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "ভিডিও ক্লাসটি পাওয়া যায়নি।"}
      </div>
    );
  }

  const embedUrl = youtubeEmbedUrl(data.video.videoUrl);
  const directVideo = isDirectVideo(data.video.videoUrl);
  const progressPercent = progress?.progressPercent ?? data.progress?.progressPercent ?? 0;
  const completed = progress?.status === "completed" || data.progress?.status === "completed";

  return (
    <section className="space-y-5">
      <Link
        href="/student/courses"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        সব ভিডিও ক্লাস
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-[var(--shadow-lg)]">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={data.video.title}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : directVideo ? (
          <video
            src={data.video.videoUrl}
            controls
            preload="metadata"
            className="aspect-video w-full"
            onTimeUpdate={(event) => {
              const current = Math.floor(event.currentTarget.currentTime);
              if (current - lastSavedSecond.current >= 15) {
                lastSavedSecond.current = current;
                void saveProgress(
                  "started",
                  current,
                  Math.floor(event.currentTarget.duration || 0),
                );
              }
            }}
            onEnded={(event) =>
              void saveProgress(
                "completed",
                Math.floor(event.currentTarget.duration || 0),
                Math.floor(event.currentTarget.duration || 0),
              )
            }
          />
        ) : (
          <div className="grid aspect-video place-items-center bg-gradient-to-br from-primary to-slate-900 p-6 text-center text-white">
            <div>
              <PlayCircle className="mx-auto size-14 text-brand-yellow" />
              <p className="mt-3 text-sm font-bold">
                এই ভিডিওটি মূল উৎসে খুলে দেখুন
              </p>
              <a
                href={data.video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-yellow px-4 py-2.5 text-sm font-black text-primary"
              >
                ভিডিও খুলুন
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-brand-blue">
              ভিডিও ক্লাস
            </p>
            <h1 className="mt-2 text-xl font-black text-primary sm:text-2xl">
              {data.video.title}
            </h1>
            {data.video.description && (
              <p className="mt-2 text-sm leading-6 text-muted">
                {data.video.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void markCompleted()}
            disabled={completed || saving}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:bg-emerald-100 disabled:text-emerald-800"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {completed ? "ক্লাস সম্পন্ন" : "দেখা শেষ হিসেবে চিহ্নিত করুন"}
          </button>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs font-bold text-muted">
            <span>দেখার অগ্রগতি</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
