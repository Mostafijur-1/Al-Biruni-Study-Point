"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "absp-guest-level";

export type GuestLevel = "SSC" | "HSC";

function readStoredLevel(): GuestLevel | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored === "HSC" || stored === "SSC" ? stored : null;
}

function persistLevel(level: GuestLevel) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, level);
  }
}

/** Guest browsing level from URL (?level=) with sessionStorage fallback. */
export function useGuestLevel(): GuestLevel {
  const searchParams = useSearchParams();
  const paramLevel = searchParams.get("level");

  return useMemo(() => {
    if (paramLevel === "HSC" || paramLevel === "SSC") {
      persistLevel(paramLevel);
      return paramLevel;
    }

    return readStoredLevel() ?? "SSC";
  }, [paramLevel]);
}

export function guestLevelQuery(level: GuestLevel) {
  return `?level=${level}`;
}
