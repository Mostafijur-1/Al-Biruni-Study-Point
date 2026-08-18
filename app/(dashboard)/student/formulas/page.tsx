import type { Metadata } from "next";

import { FormulaSprint } from "@/components/formulas/FormulaSprint";

export const metadata: Metadata = {
  title: "ফর্মুলা স্প্রিন্ট | ABSP",
  description:
    "প্রতিদিন পাঁচটি অভিযোজিত সূত্র কার্ড দিয়ে Physics, Chemistry ও Mathematics দ্রুত ঝালাই করো।",
};

export default function StudentFormulasPage() {
  return <FormulaSprint />;
}
