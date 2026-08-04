import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Brain, CalendarDays, FileQuestion, LineChart, UserCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "শিক্ষক ড্যাশবোর্ড | ABSP",
  description: "ক্লাস কনটেন্ট, প্রশ্ন, পরীক্ষা ও ফলাফল ব্যবস্থাপনা।",
};

const teacherTasks = [
  {
    href: "/teacher/classes",
    title: "ক্লাস রুটিন ও সেশন",
    description: "সাপ্তাহিক রুটিন দেখুন এবং আজকের ক্লাস সেশন পরিচালনা করুন।",
    icon: CalendarDays,
  },
  {
    href: "/teacher/classes?view=content",
    title: "ক্লাস কনটেন্ট",
    description: "নির্ধারিত শ্রেণি ও বিষয়ের ভিডিও, কোর্স এবং কাজ তৈরি করুন।",
    icon: BookOpen,
  },
  {
    href: "/teacher/mcq-review",
    title: "MCQ প্রশ্ন পর্যালোচনা",
    description: "প্রশ্নব্যাংকের প্রশ্ন যাচাই ও মান উন্নত করুন।",
    icon: Brain,
  },
  {
    href: "/teacher/exams",
    title: "MCQ পরীক্ষা",
    description: "পরীক্ষা তৈরি, প্রকাশ এবং ফল প্রকাশ নিয়ন্ত্রণ করুন।",
    icon: FileQuestion,
  },
  {
    href: "/teacher/results",
    title: "শিক্ষার্থীর ফলাফল",
    description: "নির্ধারিত শিক্ষার্থীদের অগ্রগতি দেখুন এবং মন্তব্য দিন।",
    icon: LineChart,
  },
];

export default function TeacherDashboardPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">শিক্ষক ড্যাশবোর্ড</p>
        <h1 className="mt-2 text-2xl font-black text-primary sm:text-3xl">আজ কী করতে চান?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          আপনার নির্ধারিত শ্রেণি ও বিষয়ের কাজগুলো এখান থেকে শুরু করুন।
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="শিক্ষকের প্রধান কাজ">
        {teacherTasks.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-black text-primary">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          </Link>
        ))}
      </section>

      <Link
        href="/teacher/profile"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-secondary"
      >
        <UserCircle className="size-4" aria-hidden />
        প্রোফাইল ও দায়িত্বের পরিধি
      </Link>
    </div>
  );
}
