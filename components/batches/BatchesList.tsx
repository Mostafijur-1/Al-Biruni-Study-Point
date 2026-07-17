"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Users, Video, MapPin, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

type Batch = {
  name: string;
  mode: string;
  schedule: string;
  seats: string;
};

type BatchesListProps = {
    dict: {
    title: string;
    subtitle: string;
    offline: string;
    online: string;
    seats: string;
    schedule: string;
    sample: Batch[];
  };
};

export function BatchesList({ dict }: BatchesListProps) {
    const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const filteredBatches = dict.sample.filter(
    (batch) => filter === "all" || batch.mode === filter
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 lg:px-6 lg:py-16">
      {/* Premium Header */}
      <div className="rounded-xl border border-border border-t-4 border-t-brand-yellow bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          {"ব্যাচসমূহ"}
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
          {dict.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-lg">
          {dict.subtitle}
        </p>
      </div>

      {/* Mode Filters */}
      <div className="mt-8 flex justify-center sm:justify-start gap-2">
        {(["all", "online", "offline"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 border border-border",
              filter === mode
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-surface text-muted hover:border-primary/40"
            )}
          >
            {mode === "all"
              ? "সব ব্যাচ"
              : mode === "online"
              ? dict.online
              : dict.offline}
          </button>
        ))}
      </div>

      {/* Batches Grid */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredBatches.length === 0 ? (
          <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-muted">
            {"কোনো ব্যাচ পাওয়া যায়নি।"}
          </p>
        ) : (
          filteredBatches.map((batch) => (
            <article
              key={batch.name}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                      batch.mode === "online"
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : "bg-amber-50 text-amber-700 border border-amber-100"
                    )}
                  >
                    {batch.mode === "online" ? (
                      <Video className="size-3 shrink-0" />
                    ) : (
                      <MapPin className="size-3 shrink-0" />
                    )}
                    {batch.mode === "online" ? dict.online : dict.offline}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                    <Users className="size-3.5" />
                    {dict.seats}: {batch.seats}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {batch.name}
                </h3>

                <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
                  <div className="flex items-start gap-2 text-sm text-muted">
                    <Calendar className="size-4 shrink-0 mt-0.5 text-primary" />
                    <div>
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">
                        {dict.schedule}
                      </span>
                      <span className="mt-0.5 block">{batch.schedule}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href={"/contact"}
                  className={cn(
                    buttonVariants({ variant: "navy", size: "default" }),
                    "w-full justify-center gap-1.5 rounded-xl font-bold"
                  )}
                >
                  {"ভর্তি হতে যোগাযোগ করুন"}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
