import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-accent">404</p>
      <h1 className="font-display text-3xl font-bold text-primary">পৃষ্ঠা পাওয়া যায়নি</h1>
      <p className="text-muted">The page you are looking for may have moved or no longer be available.</p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
      >
        Go to home page
      </Link>
    </main>
  );
}

