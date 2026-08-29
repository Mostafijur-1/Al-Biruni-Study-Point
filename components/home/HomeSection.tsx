"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Calculator, Calendar, CheckCircle2, FlaskConical, GraduationCap, Monitor, Percent } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button-variants";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

type HomeSectionProps = {
    dict: Dictionary["home"];
  brand: Dictionary["brand"];
};

type PublicBatch = {
  id: string;
  name: string;
  mode: "online" | "offline";
  defaultFeeTk: number;
  capacity?: number;
  activeEnrollmentCount: number;
  startsAt?: string;
  subjects: Array<{ id: string; name: string; nameBn?: string }>;
};

export function HomeSection({ dict, brand }: HomeSectionProps) {
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [publicBatches, setPublicBatches] = useState<PublicBatch[]>([]);
    const [batchesLoading, setBatchesLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    void fetch("/api/public/batches?limit=4", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Batch request failed");
        return response.json() as Promise<{ success: true; data: { batches: PublicBatch[] } }>;
      })
      .then((payload) => setPublicBatches(payload.data.batches))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPublicBatches([]);
      })
      .finally(() => setBatchesLoading(false));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, []);

  return (
    <>
      <section style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:gap-10 sm:py-14 md:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-20">
          <div className="order-2 md:order-1">
            <p className="mb-3 inline-block rounded-full bg-brand-yellow/30 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground sm:mb-4 sm:text-sm">
              {dict.hero.eyebrow}
            </p>
            <h1 className="font-display max-w-3xl text-3xl font-bold leading-tight text-primary sm:text-4xl md:text-5xl lg:text-6xl">
              {dict.hero.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:mt-5 sm:text-lg sm:leading-8">
              {dict.hero.subtitle}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 max-w-2xl">
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-xs transition duration-200 hover:border-brand-blue/30 hover:bg-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-red/10 text-brand-red">
                  <Calendar className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-muted/80">{dict.hero.classStartLabel}</p>
                  <p className="text-sm font-bold text-primary">{dict.hero.classStartVal}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-xs transition duration-200 hover:border-brand-yellow/40 hover:bg-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-yellow/15 text-accent-foreground">
                  <Percent className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-muted/80">{dict.hero.specialOfferLabel}</p>
                  <p className="text-sm font-bold text-primary">{dict.hero.specialOfferVal}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <Link
                href={"/student/practice?level=SSC"}
                className={cn(buttonVariants({ variant: "navy", size: "lg" }), "justify-center")}
              >
                {dict.hero.ctaExplore}
              </Link>
              {/* <Link
                href={"/courses"}
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "justify-center")}
              >
                {dict.hero.ctaCourses}
              </Link> */}
              <Link
                href={"/contact"}
                className={cn(buttonVariants({ size: "lg" }), "justify-center")}
              >
                {dict.hero.ctaRegister}
              </Link>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="overflow-hidden rounded-2xl border-2 border-brand-yellow bg-navy p-4 shadow-[var(--shadow-lg)] sm:p-6">
              <div className="mb-4 flex justify-center sm:justify-start">
                <Logo size="hero" link={false} />
              </div>
              <p className="text-center text-sm font-bold uppercase tracking-wide text-brand-yellow sm:text-left mb-4">
                {brand.tagline}
              </p>

              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-[var(--shadow-md)]">
                <div className="relative aspect-video w-full">
                  <iframe
                    className="w-full h-full border-0"
                    src="https://www.youtube.com/embed/N2DQmxN0alo?si=OuXu62shYZ9ZGYpW"
                    title="HSC 2028 Offline Batch"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    loading="lazy"
                    onLoad={() => setVideoLoaded(true)}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 z-10 transition-opacity duration-500",
                      videoLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                  >
                    <Image
                      src="/hsc2028-thumbnail.jpg"
                      alt="HSC 2028 Offline Batch"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="courses" className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="text-center md:text-left">
            <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl lg:text-4xl">
              {dict.hsc2028.title}
            </h2>
            <p className="mt-2 text-sm text-muted sm:text-base max-w-2xl">{dict.hsc2028.subtitle}</p>
          </div>

          {/* Cards for each subject */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: dict.hsc2028.physics.title,
                schedule: dict.hsc2028.physics.schedule,
                fee: dict.hsc2028.physics.fee,
                icon: BookOpen,
                color: "border-brand-blue/30 bg-brand-blue/5 hover:border-brand-blue hover:bg-brand-blue/[0.08] text-brand-blue",
                badgeBg: "bg-brand-blue/15 text-brand-blue",
              },
              {
                title: dict.hsc2028.chemistry.title,
                schedule: dict.hsc2028.chemistry.schedule,
                fee: dict.hsc2028.chemistry.fee,
                icon: FlaskConical,
                color: "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/[0.08] text-emerald-600",
                badgeBg: "bg-emerald-500/15 text-emerald-600",
              },
              {
                title: dict.hsc2028.math.title,
                schedule: dict.hsc2028.math.schedule,
                fee: dict.hsc2028.math.fee,
                icon: Calculator,
                color: "border-violet-500/30 bg-violet-500/5 hover:border-violet-500 hover:bg-violet-500/[0.08] text-violet-600",
                badgeBg: "bg-violet-500/15 text-violet-600",
              },
              {
                title: dict.hsc2028.ict.title,
                schedule: dict.hsc2028.ict.schedule,
                fee: dict.hsc2028.ict.fee,
                icon: Monitor,
                color: "border-brand-yellow/30 bg-brand-yellow/5 hover:border-brand-yellow hover:bg-brand-yellow/[0.08] text-accent-foreground",
                badgeBg: "bg-brand-yellow/20 text-accent-foreground",
              },
            ].map((subject) => {
              const Icon = subject.icon;
              return (
                <div
                  key={subject.title}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border-2 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
                    subject.color,
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={cn("grid size-11 place-items-center rounded-xl", subject.badgeBg)}>
                        <Icon className="size-5.5" />
                      </span>
                      <span className="rounded-full bg-surface/60 border border-border/60 px-2.5 py-0.5 text-[10px] font-bold shadow-2xs uppercase tracking-wider text-muted-foreground">
                        HSC 2028
                      </span>
                    </div>
                    <h3 className="font-display mt-4 text-lg font-bold text-primary">
                      {subject.title}
                    </h3>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {subject.schedule}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-dashed border-muted/20">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">মাসিক ফি</p>
                    <p className="text-lg font-black text-primary mt-0.5">
                      {subject.fee} <span className="text-[10px] font-bold text-muted">/ মাস</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Special Combo Package Card */}
          <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-[1.65rem] border-2 border-brand-yellow bg-primary shadow-[0_24px_55px_-24px_rgba(11,37,69,0.65)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_65px_-24px_rgba(220,38,38,0.5)]">
            <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
              <section className="relative overflow-hidden bg-linear-to-br from-[#071d38] via-primary to-[#0b315a] p-6 text-white sm:p-8" aria-label="Combo package subjects">
                <span className="absolute -bottom-16 -right-16 size-44 rounded-full bg-sky-300/10 blur-xl" aria-hidden />
                <p className="relative font-display text-2xl font-black leading-none sm:text-3xl">
                  <span className="block text-white">স্মার্ট</span>
                  <span className="mt-1.5 block text-brand-yellow">কম্বো অফার</span>
                </p>
                <ul className="relative mt-6 space-y-2.5 text-sm font-bold" aria-label="Included subjects">
                  {["Physics", "Chemistry", "Higher Math", "ICT FREE"].map((subject, index) => (
                    <li key={subject} className={cn("flex items-center gap-2", index === 3 && "text-brand-yellow")}>
                      <CheckCircle2 className="size-4 shrink-0" strokeWidth={3} />
                      <span>{subject}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="relative flex flex-col items-center justify-center overflow-hidden bg-linear-to-br from-red-600 via-brand-red to-[#f12a12] p-6 text-center text-white sm:p-8" aria-label="Combo offer price">
                <span className="absolute -right-14 -top-14 size-40 rounded-full bg-white/10" aria-hidden />
                <p className="relative text-xs font-bold">নিয়মিত ফি</p>
                <p className="relative mt-0.5 text-2xl font-black line-through decoration-2 decoration-white/80">{dict.hsc2028.combo.regularFee}</p>
                <div className="relative my-3 w-full border-t border-dashed border-white/60" />
                <p className="relative text-xs font-bold">অফার মূল্য</p>
                <p className="relative mt-1 text-5xl font-black leading-none tracking-tight sm:text-6xl">{dict.hsc2028.combo.offerFee}</p>
                <p className="relative mt-1 text-base font-bold">প্রতি মাসে</p>
              </section>
            </div>

            <footer className="grid items-center gap-3 bg-brand-yellow px-5 py-3 text-primary sm:grid-cols-[1fr_auto] sm:px-7">
              <p className="flex items-center justify-center gap-2 text-sm font-black sm:justify-start">
                <Percent className="size-5" strokeWidth={3} />
                সাশ্রয় 500 ৳ প্রতি মাসে!
              </p>
              <Link href={"/contact"} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-black text-primary-foreground shadow-md transition hover:scale-[1.02] hover:bg-primary/90">
                অফার চলবে 10 October পর্যন্ত
              </Link>
            </footer>
          </div>

        </div>
      </section>

      <section id="batches" className="border-t-4 border-brand-yellow bg-secondary/50 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">
                {dict.batches.title}
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">{dict.batches.subtitle}</p>
            </div>
            <Link href={"/batches"} className="font-semibold text-primary hover:underline">
              {dict.batches.link} →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2">
            {batchesLoading ? (
              [0, 1].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-card" />)
            ) : publicBatches.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted md:col-span-2">এখন কোনো সক্রিয় ব্যাচ নেই।</p>
            ) : publicBatches.map((batch) => (
              <article
                key={batch.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                      batch.mode === "online"
                        ? "bg-primary/10 text-primary"
                        : "bg-brand-yellow/35 text-accent-foreground",
                    )}
                  >
                    {batch.mode === "online" ? dict.batches.online : dict.batches.offline}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {dict.batches.seats}: {batch.capacity ? `${batch.activeEnrollmentCount}/${batch.capacity}` : batch.activeEnrollmentCount}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-foreground sm:text-lg">{batch.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {dict.batches.schedule}: {batch.startsAt ? new Date(batch.startsAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "শিগগির জানানো হবে"}
                </p>
                <p className="mt-2 text-sm font-bold text-primary">{batch.defaultFeeTk.toLocaleString("en-US")} ৳ / মাস</p>
                {batch.subjects.length > 0 && <p className="mt-1 text-xs text-muted">{batch.subjects.map((subject) => subject.nameBn || subject.name).join(" • ")}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tutor" className="py-12 sm:py-16 lg:py-20 relative overflow-hidden">
        {/* Subtle decorative background blur gradients */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 size-72 rounded-full bg-brand-yellow/10 blur-3xl -z-10" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2 size-72 rounded-full bg-brand-blue/10 blur-3xl -z-10" />

        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="text-center md:text-left">
            <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl lg:text-4xl">
              {dict.tutor.title}
            </h2>
          </div>

          <div className="group relative mt-6 flex flex-col gap-6 sm:gap-8 rounded-3xl border-2 border-brand-yellow bg-card p-6 shadow-[var(--shadow-md)] transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:border-brand-blue/40 sm:mt-8 sm:p-8 md:flex-row md:items-center">
            
            {/* Styled Image Frame Container */}
            <div className="relative mx-auto shrink-0 sm:mx-0 group/tutor-img">
              {/* Animated/glowing gradient border underframe */}
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-brand-yellow via-brand-red to-brand-blue opacity-35 blur-xs transition duration-300 group-hover/tutor-img:opacity-60 group-hover/tutor-img:blur-md" />
              
              {/* Main image container */}
              <div className="relative size-28 overflow-hidden rounded-2xl border-4 border-border bg-card shadow-md transition-all duration-300 sm:size-32 md:size-36 group-hover/tutor-img:scale-[1.02] group-hover/tutor-img:shadow-lg">
                <Image
                  src="/lead-tutor.png"
                  alt={dict.tutor.name}
                  fill
                  sizes="(max-width: 768px) 112px, 144px"
                  className="object-cover object-top transition duration-500 group-hover/tutor-img:scale-105"
                  priority
                />
              </div>
            </div>

            {/* Tutor Information */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col items-center md:items-start">
                <h3 className="font-display text-xl font-bold text-primary sm:text-2xl lg:text-3xl">
                  {dict.tutor.name}
                </h3>
                
                <p className="mt-1 text-sm font-bold uppercase tracking-wider text-brand-red">
                  {dict.tutor.role}
                </p>
                
                {/* Highlighted Education Section */}
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-blue/10 border border-brand-blue/20 px-3.5 py-2 text-sm font-bold text-primary shadow-xs transition duration-200 hover:bg-brand-blue/15">
                  <GraduationCap className="size-5 text-brand-blue shrink-0 animate-bounce" style={{ animationDuration: '3s' }} />
                  <span className="tracking-wide">{dict.tutor.education}</span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-muted sm:text-base sm:leading-8 max-w-3xl">
                {dict.tutor.bio}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
