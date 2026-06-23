import { ResultHistory } from "@/components/exam/ResultHistory";

export default function StudentResultsPage() {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Results</h1>
      </div>
      <ResultHistory />
    </section>
  );
}
