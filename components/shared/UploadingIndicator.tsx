"use client";

import { useEffect, useState } from "react";
import { Brain, Cpu, Database, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadingIndicatorProps {
  isUploading: boolean;
  locale?: string;
  className?: string;
}

const STEPS_BN = [
  { text: "File সার্ভারে আপলোড করা হচ্ছে...", icon: FileText },
  { text: "Gemini AI প্রশ্নগুলো Analyze করছে...", icon: Brain },
  { text: "MCQ-এর Structure ও Options সাজানো হচ্ছে...", icon: Cpu },
  { text: "গাণিতিক প্রতীক ও Text সংশোধন করা হচ্ছে...", icon: Sparkles },
  { text: "Database-এ সেভ করা হচ্ছে... প্রায় শেষ!", icon: Database },
];

export function UploadingIndicator({
  isUploading,
  locale = "bn",
  className,
}: UploadingIndicatorProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(5);
  const steps = STEPS_BN;

  useEffect(() => {
    if (!isUploading) {
      setProgress(5);
      setStepIndex(0);
      return;
    }

    // Cycle through messages every 6 seconds
    const messageInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev; // hold on the last step
      });
    }, 6000);

    // Simulate progress bar increase
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 50) {
          return prev + Math.floor(Math.random() * 8) + 4; // fast growth at first
        } else if (prev < 80) {
          return prev + Math.floor(Math.random() * 4) + 2; // slow down
        } else if (prev < 95) {
          return prev + Math.floor(Math.random() * 2) + 1; // very slow near the end
        }
        return prev; // hold at 95%
      });
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [isUploading, steps.length]);

  if (!isUploading) return null;

  const CurrentIcon = steps[stepIndex].icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-card/70 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 space-y-4",
        className
      )}
    >
      {/* Background radial glow */}
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />

      <div className="relative flex flex-col md:flex-row items-center gap-4">
        {/* Animated Icon Circle */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] relative">
          <CurrentIcon className="h-7 w-7 animate-pulse" />
          <Loader2 className="absolute h-12 w-12 border-2 border-primary/30 border-t-transparent rounded-full animate-spin pointer-events-none" />
        </div>

        {/* Text descriptions */}
        <div className="flex-1 text-center md:text-left space-y-1.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-primary font-mono">
              AI Conversion চলমান
            </span>
            <span className="text-2xs font-bold text-muted font-sans">
              আনুমানিক Progress: {progress}%
            </span>
          </div>

          <h4 className="font-display text-sm font-semibold text-foreground transition-all duration-300">
            {steps[stepIndex].text}
          </h4>

          <p className="text-3xs md:text-2xs text-muted font-medium">
            ⚠️ দয়া করে Page রিফ্রেশ বা Window বন্ধ করবেন না। AI processing সম্পন্ন হতে ৩০-৬০ সেকেন্ড সময় লাগতে পারে।
          </p>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50 border border-secondary/30 relative font-sans">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]"
          style={{ width: `${progress}%` }}
        />
        {/* Animated Shimmer Over Progress Bar */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.15)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
      </div>
    </div>
  );
}
