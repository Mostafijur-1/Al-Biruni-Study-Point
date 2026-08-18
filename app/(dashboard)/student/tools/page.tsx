import type { Metadata } from "next";
import Link from "next/link";
import {
  Compass,
  FlaskConical,
  Gamepad2,
  Map,
  NotebookPen,
  Sigma,
  Swords,
  Target,
  TimerReset,
  UserCircle,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "শেখার সরঞ্জাম | ABSP",
  description: "পড়াশোনার সহায়ক সরঞ্জাম, লক্ষ্য, ল্যাব ও চ্যালেঞ্জ এক জায়গায়।",
};

const toolGroups = [
  {
    title: "পড়াশোনার সহায়তা",
    items: [
      { href: "/student/coach", label: "স্টাডি কোচ", icon: Compass },
      { href: "/student/learning", label: "শেখার পরিকল্পনা", icon: Map },
      { href: "/student/mistakes", label: "ভুলের খাতা", icon: NotebookPen },
      { href: "/student/focus", label: "ফোকাস স্টুডিও", icon: TimerReset },
      { href: "/student/goals", label: "সাপ্তাহিক লক্ষ্য", icon: Target },
    ],
  },
  {
    title: "অনুশীলন ও অনুসন্ধান",
    items: [
      { href: "/student/labs", label: "সায়েন্স ল্যাব", icon: FlaskConical },
      { href: "/student/formulas", label: "ফর্মুলা স্প্রিন্ট", icon: Sigma },
      { href: "/student/challenge", label: "দৈনিক চ্যালেঞ্জ", icon: Swords },
      { href: "/student/game", label: "গেম হাব", icon: Gamepad2 },
      { href: "/student/community", label: "ক্লাস কমিউনিটি", icon: UsersRound },
    ],
  },
];

export default function StudentToolsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">শিক্ষার্থী</p>
        <h1 className="mt-2 text-2xl font-black text-primary sm:text-3xl">শেখার সরঞ্জাম</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          মূল পড়াশোনার বাইরে প্রয়োজন অনুযায়ী সহায়ক সরঞ্জাম বেছে নাও।
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
