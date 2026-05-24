const dashboardLinks = [
  "Overview",
  "Courses",
  "Classes",
  "Exams",
  "CQ Review",
  "Results",
  "Analytics",
];

export function Sidebar() {
  return (
    <aside className="hidden rounded border border-border bg-surface p-4 md:block">
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-accent">Dashboard</p>
      <nav className="space-y-1">
        {dashboardLinks.map((link) => (
          <span
            key={link}
            className="block rounded px-3 py-2 text-sm font-medium text-muted hover:bg-background hover:text-primary"
          >
            {link}
          </span>
        ))}
      </nav>
    </aside>
  );
}
