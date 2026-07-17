import { RoutePlaceholder } from "@/components/shared/RoutePlaceholder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Al-Biruni Study Point and its academic approach for SSC and HSC students.",
};

export default function AboutPage() {
  return (
    <RoutePlaceholder
      eyebrow="Public website"
      title="About ABSP"
      description="Institute story, academic values, tutor credibility, and Bangla-first trust content will live here."
    />
  );
}
