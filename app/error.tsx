"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("Unhandled route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-accent">Something went wrong</p>
      <h1 className="font-display text-3xl font-bold text-primary">পৃষ্ঠা লোড করা যায়নি</h1>
      <p className="text-muted">Please try again. If the problem continues, contact ABSP support.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </main>
  );
}

