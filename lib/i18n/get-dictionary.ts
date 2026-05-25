import type { Locale } from "@/lib/i18n";

import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

export type Dictionary = typeof bn;

const dictionaries: Record<Locale, Dictionary> = { bn, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.bn;
}
