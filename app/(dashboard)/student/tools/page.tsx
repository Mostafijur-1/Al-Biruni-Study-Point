import type { Metadata } from "next";
import Link from "next/link";
import {
  FlaskConical,
  NotebookPen,
  UserCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Learning Resources | ABSP",
  description: "Mistake Recovery ও Science Lab—দুটি প্রয়োজনীয় শেখার সহায়ক এক জায়গায়।",
};

const toolGroups = [
  {
    title: "Learning Resources",
    items: [
      { href: "/student/mistakes", label: "Mistake Recovery", icon: NotebookPen },
      { href: "/student/labs", label: "Science Lab", icon: FlaskConical },
    ],
  },
];

export default function StudentToolsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">শিক্ষার্থী</p>
        <h1 className="mt-2 text-2xl font-black text-primary sm:text-3xl">Learning Resources</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          ভুল থেকে শেখো এবং হাতে-কলমে বিজ্ঞানের ধারণা অনুশীলন করো।
        </p>
      </header>

      {toolGroups.map((group, groupIndex) => {
        const headingId = `tool-group-${groupIndex}`;
        return (
          <section key={group.title} className="space-y-3" aria-labelledby={headingId}>
            <h2 id={headingId} className="text-lg font-bold text-primary">{group.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-4 font-bold text-primary shadow-sm transition hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <Link
        href="/student/profile"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-secondary"
      >
        <UserCircle className="size-4" aria-hidden />
        প্রোফাইল ও অ্যাকাউন্ট
      </Link>
    </div>
  );
}
