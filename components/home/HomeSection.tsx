const stats = [
  ["SSC", "Class 9-10 Science"],
  ["HSC", "Class 11-12 Science"],
  ["MCQ + CQ", "Exam and assignment system"],
];

export function HomeSection() {
  return (
    <section className="bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#fff8e6_100%)]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] lg:px-6">
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-wide text-accent">
            Bangla-first Science Coaching and LMS
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-primary md:text-6xl">
            ABSP - Al-Biruni Study Point
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            A premium coaching platform for SSC and HSC science students with
            online classes, offline batches, MCQ exams, CQ review, and progress
            tracking.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="rounded bg-primary px-5 py-3 text-center font-semibold text-primary-foreground" href="/bn/courses">
              Explore Courses
            </a>
            <a className="rounded border border-border bg-surface px-5 py-3 text-center font-semibold text-primary" href="/bn/register">
              Register Now
            </a>
          </div>
        </div>

        <div className="rounded border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">Platform modules</p>
          <div className="mt-5 grid gap-3">
            {stats.map(([title, description]) => (
              <div key={title} className="rounded border border-border bg-background p-4">
                <p className="text-xl font-bold text-primary">{title}</p>
                <p className="mt-1 text-sm text-muted">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
