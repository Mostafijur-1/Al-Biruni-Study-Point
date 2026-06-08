import Link from "next/link";

import { subjectsForLevel } from "@/lib/data/subjects";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { CourseLevel, CourseSubject } from "@/types";

type CoursesCatalogProps = {
  locale: Locale;
  home: Dictionary["home"];
};

function subjectLabel(home: Dictionary["home"], subject: CourseSubject) {
  return home.subjects[subject as keyof typeof home.subjects] ?? subject;
}

export function CoursesCatalog({ locale, home }: CoursesCatalogProps) {
  const path = createLocalizedPath(locale);

  return (
    <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4 sm:py-12 lg:px-6 lg:py-16">
      <div className="rounded-xl border border-border border-t-4 border-t-brand-yellow bg-card p-4 shadow-[var(--shadow-sm)] sm:p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{home.courses.title}</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
          {home.courses.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-lg">{home.courses.subtitle}</p>
      </div>

      <div className="mt-8 grid gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-2">
        {(["SSC", "HSC"] as CourseLevel[]).map((level) => (
          <section
            key={level}
            className="rounded-2xl border-2 border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-6"
          >
            <h2 className="font-display text-lg font-bold text-primary sm:text-xl">
              {level === "SSC" ? home.courses.ssc : home.courses.hsc}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-3">
              {subjectsForLevel(level).map(({ subject, slug }) => (
                <li key={slug}>
                  <Link
                    href={path(`/courses/${slug}`)}
                    className="flex min-h-[4rem] flex-col justify-center rounded-xl border border-border bg-secondary/40 px-3 py-3 transition hover:border-primary hover:bg-secondary hover:shadow-sm sm:px-4 sm:py-4"
                  >
                    <span className="font-bold text-foreground">{subjectLabel(home, subject)}</span>
                    <span className="mt-1 text-xs text-muted">
                      {locale === "bn" ? "ভিডিও · MCQ · CQ" : "Video · MCQ · CQ"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
