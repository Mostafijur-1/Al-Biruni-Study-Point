import { HomeSection } from "@/components/home/HomeSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function HomePage() {
  const dict = getDictionary();

  return <HomeSection dict={dict.home} brand={dict.brand} />;
}

