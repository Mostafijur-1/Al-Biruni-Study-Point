import Link from "next/link";
import { BookOpen, GraduationCap, Monitor, Users } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { subjectsForLevel } from "@/lib/data/subjects";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";
import type { CourseSubject } from "@/types";

type HomeSectionProps = {
  locale: Locale;
  dict: Dictionary["home"];
  brand: Dictionary["brand"];
};

function subjectLabel(dict: Dictionary["home"], subject: CourseSubject) {
  return dict.subjects[subject];
}

const featureColors = [
  "bg-brand-red/10 text-brand-red",
  "bg-brand-blue/15 text-brand-blue",
  "bg-brand-yellow/25 text-accent-foreground",
];

export function HomeSection({ locale, dict, brand }: HomeSectionProps) {
  const path = createLocalizedPath(locale);

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
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Link
                href={path("/courses")}
                className={cn(buttonVariants({ variant: "navy", size: "lg" }), "justify-center")}
              >
                {dict.hero.ctaCourses}
              </Link>
              <Link
                href={path("/register")}
                className={cn(buttonVariants({ size: "lg" }), "justify-center")}
              >
                {dict.hero.ctaRegister}
              </Link>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="overflow-hidden rounded-2xl border-2 border-brand-yellow bg-primary p-4 shadow-[var(--shadow-lg)] sm:p-6">
              <div className="mb-4 flex justify-center sm:justify-start">
                <Logo locale={locale} size="hero" priority link={false} />
              </div>
              <p className="text-center text-sm font-bold uppercase tracking-wide text-brand-yellow sm:text-left">
                {brand.tagline}
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  { icon: GraduationCap, label: "SSC", desc: dict.courses.ssc },
                  { icon: BookOpen, label: "HSC", desc: dict.courses.hsc },
                  {
                    icon: Monitor,
                    label: "MCQ + CQ",
                    desc: locale === "bn" ? "অটো ও শিক্ষক-মূল্যায়ন" : "Auto & teacher-graded",
                  },
                ].map(({ icon: Icon, label, desc }, index) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4"
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-lg",
                        featureColors[index],
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold text-white">{label}</p>
                      <p className="mt-0.5 text-sm text-white/75">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-t border-border bg-card py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">{dict.about.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            {dict.about.body}
          </p>
          <ul className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {dict.about.points.map((point, i) => (
              <li
                key={point}
                className={cn(
                  "rounded-xl border-l-4 px-4 py-3 text-sm font-medium text-foreground",
                  i === 0 && "border-brand-red bg-red-50/50",
                  i === 1 && "border-brand-blue bg-secondary",
                  i === 2 && "border-brand-yellow bg-brand-yellow/15",
                )}
              >
                {point}
              </li>
            ))}
          </ul>
          <Link
            href={path("/about")}
            className="mt-6 inline-block font-semibold text-primary hover:underline"
          >
            {dict.about.link} →
          </Link>
        </div>
      </section>

      <section id="courses" className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">
                {dict.courses.title}
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">{dict.courses.subtitle}</p>
            </div>
            <Link href={path("/courses")} className="font-semibold text-primary hover:underline">
              {dict.courses.link} →
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-2">
            {(["SSC", "HSC"] as const).map((level) => (
              <div
                key={level}
                className="rounded-2xl border-2 border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-6"
              >
                <h3 className="font-display text-lg font-bold text-primary sm:text-xl">
                  {level === "SSC" ? dict.courses.ssc : dict.courses.hsc}
                </h3>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {subjectsForLevel(level).map(({ subject, slug }) => (
                    <li key={slug}>
                      <Link
                        href={path(`/courses/${slug}`)}
                        className="block rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-secondary hover:text-primary sm:px-4"
                      >
                        {subjectLabel(dict, subject)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
            <Link href={path("/batches")} className="font-semibold text-primary hover:underline">
              {dict.batches.link} →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2">
            {dict.batches.sample.map((batch) => (
              <article
                key={batch.name}
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
                    {dict.batches.seats}: {batch.seats}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-foreground sm:text-lg">{batch.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {dict.batches.schedule}: {batch.schedule}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tutor" className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">{dict.tutor.title}</h2>
          <div className="mt-6 flex flex-col gap-6 rounded-2xl border-2 border-brand-yellow bg-card p-4 shadow-[var(--shadow-md)] sm:mt-8 sm:p-6 md:flex-row md:items-center md:p-8">
            <div
              className="mx-auto grid size-24 shrink-0 place-items-center rounded-2xl bg-primary text-brand-yellow sm:mx-0 md:size-32"
              aria-hidden
            >
              <Users className="size-12 md:size-14" />
            </div>
            <div className="text-center md:text-left">
              <h3 className="font-display text-xl font-bold text-primary sm:text-2xl">{dict.tutor.name}</h3>
              <p className="mt-1 font-semibold text-brand-red">{dict.tutor.role}</p>
              <p className="mt-2 text-sm font-medium text-primary sm:text-base">{dict.tutor.education}</p>
              <p className="mt-4 text-sm leading-7 text-muted sm:text-base">{dict.tutor.bio}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
