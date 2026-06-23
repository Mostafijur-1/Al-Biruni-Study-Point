import type { Locale } from "@/lib/i18n";

import bn from "@/messages/bn.json";

export type Dictionary = typeof bn;

const dictionaries: Record<Locale, Dictionary> = { bn };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.bn;
}
