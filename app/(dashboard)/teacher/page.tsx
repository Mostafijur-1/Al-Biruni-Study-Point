import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Brain, FileQuestion, LineChart, UserCircle } from "lucide-react";

import { RoutineDashboard } from "@/components/routine/RoutineDashboard";

export const metadata: Metadata = { title: "শিক্ষক ড্যাশবোর্ড | ABSP", description: "আজকের ক্লাস, সাপ্তাহিক রুটিন এবং শিক্ষকের কাজ।" };

const teacherTasks = [
  { href: "/teacher/classes", title: "ক্লাস কনটেন্ট", description: "নির্ধারিত শ্রেণি ও বিষয়ের ভিডিও, কোর্স এবং কাজ তৈরি করুন।", icon: BookOpen },
  { href: "/teacher/mcq-review", title: "MCQ প্রশ্ন পর্যালোচনা", description: "প্রশ্নব্যাংকের প্রশ্ন যাচাই ও মান উন্নত করুন।", icon: Brain },
  { href: "/teacher/exams", title: "MCQ পরীক্ষা", description: "পরীক্ষা তৈরি, প্রকাশ এবং ফল প্রকাশ নিয়ন্ত্রণ করুন।", icon: FileQuestion },
  { href: "/teacher/results", title: "শিক্ষার্থীর ফলাফল", description: "নির্ধারিত শিক্ষার্থীদের অগ্রগতি দেখুন এবং মন্তব্য দিন।", icon: LineChart },
];

export default function TeacherDashboardPage() {
  return <div className="space-y-6">
    <RoutineDashboard />
    <section><div className="mb-3"><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">দ্রুত কাজ</p><h1 className="mt-1 text-xl font-black text-primary">শিক্ষক কর্মক্ষেত্র</h1></div><div className="grid gap-4 sm:grid-cols-2">{teacherTasks.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white"><Icon className="size-5" /></span><h2 className="mt-4 text-lg font-black text-primary">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></Link>)}</div></section>
    <Link href="/teacher/profile" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-primary hover:bg-secondary"><UserCircle className="size-4" /> প্রোফাইল ও দায়িত্বের পরিধি</Link>
  </div>;
}
