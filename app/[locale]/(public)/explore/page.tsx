import { Suspense } from "react";

import { GuestExploreHub } from "@/components/explore/GuestExploreHub";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n";

type ExplorePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale as Locale);

  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-12 text-muted">{dict.explore.loading}</p>}>
      <GuestExploreHub locale={locale as Locale} copy={dict.explore} />
    </Suspense>
  );
}
