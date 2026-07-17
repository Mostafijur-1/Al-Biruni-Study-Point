import { ContactSection } from "@/components/contact/ContactSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Al-Biruni Study Point for course, batch, and academic support information.",
};

export default async function ContactPage() {
  const dict = getDictionary();

  return <ContactSection contact={dict.contact} />;
}
