import { RoutePlaceholder } from "@/components/shared/RoutePlaceholder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Find answers to common questions about ABSP courses, batches, and learning support.",
};

export default function FaqPage() {
  return (
    <RoutePlaceholder
      eyebrow="FAQ"
      title="Common Student and Guardian Questions"
      description="Admissions, fees, online classes, exams, course access, and support policies."
    />
  );
}
