import { ContactSection } from "@/components/contact/ContactSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function ContactPage() {
  const dict = getDictionary();

  return <ContactSection contact={dict.contact} />;
}

