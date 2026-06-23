import { BookOpen } from "lucide-react";

import { subjectsForLevel } from "@/lib/data/subjects";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { CourseLevel, CourseSubject } from "@/types";

type CoursesCatalogProps = {
  home: Dictionary["home"];
};

function subjectLabel(home: Dictionary["home"], subject: CourseSubject) {
  return home.subjects[subject as keyof typeof home.subjects] ?? subject;
}

export function CoursesCatalog({ home }: CoursesCatalogProps) {
  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4 sm:py-12 lg:py-16">
      {/* Premium Header */}
      <div className="text-center rounded-3xl border border-border/80 bg-gradient-to-b from-card to-card/50 p-6 shadow-[var(--shadow-md)] sm:p-8 md:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{home.courses.title}</p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-primary sm:text-4xl md:text-5xl tracking-tight">
          {home.courses.title}
        </h1>
        <p className="mt-4 mx-auto max-w-xl text-sm text-muted leading-relaxed sm:text-base">
          {home.courses.subtitle}
        </p>
      </div>

      {/* Centered Courses List Card */}
      <div className="mt-8">
        {(["HSC"] as CourseLevel[]).map((level) => (
          <section
            key={level}
            className="rounded-3xl border-2 border-border bg-card p-6 shadow-[var(--shadow-md)] sm:p-8"
          >
            <div className="flex items-center gap-3 border-b border-border/60 pb-4">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <BookOpen className="size-5 shrink-0" />
              </div>
              <h2 className="font-display text-xl font-bold text-primary sm:text-2xl">
                {home.courses.hsc}
              </h2>
            </div>
            
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {subjectsForLevel(level).map(({ subject, slug }) => (
                <li key={slug}>
                  <div
                    className="flex min-h-[4.5rem] items-center rounded-2xl border border-border/80 bg-secondary/10 px-5 py-3.5 shadow-xs"
                  >
                    <span className="font-bold text-foreground text-sm sm:text-base">
                      {subjectLabel(home, subject)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
