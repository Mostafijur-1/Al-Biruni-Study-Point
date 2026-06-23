import bn from "@/messages/bn.json";

export type Dictionary = typeof bn;

export function getDictionary(): Dictionary {
  return bn;
}

