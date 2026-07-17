import { BatchesList } from "@/components/batches/BatchesList";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Batches",
  description: "Explore current ABSP batches for SSC and HSC science students.",
};

export default async function BatchesPage() {
  const dict = getDictionary();

  return <BatchesList dict={dict.home.batches} />;
}
