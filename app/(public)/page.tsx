import { HomeSection } from "@/components/home/HomeSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Science Coaching and Learning Support",
  description: "ABSP provides science coaching and learning support for SSC and HSC students.",
};

export default async function HomePage() {
  const dict = getDictionary();

  return <HomeSection dict={dict.home} brand={dict.brand} />;
}
