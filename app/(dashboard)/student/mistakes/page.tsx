import type { Metadata } from "next";
import { Suspense } from "react";

import { MistakeNotebook } from "@/components/learning/MistakeNotebook";

export const metadata: Metadata = {
  title: "ভুলের খাতা | ABSP",
  description: "ভুল প্রশ্নগুলো সঠিক সময়ে পুনরায় অনুশীলন করো।",
};

export default function StudentMistakesPage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-secondary/60" />}>
      <MistakeNotebook />
    </Suspense>
  );
}
