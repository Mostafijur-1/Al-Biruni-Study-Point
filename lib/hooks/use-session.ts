"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, isApiSuccess } from "@/lib/api/client";
import type { MeResponseData } from "@/types/api";
import type { SessionUser } from "@/types";

type UseSessionOptions = {
  listenToAuthChanges?: boolean;
};

export function useSession(options?: UseSessionOptions) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  const loadSession = useCallback(async () => {
    setChecking(true);

    try {
      const { ok, payload } = await apiFetch<MeResponseData>("/api/auth/me");

      if (!ok || !isApiSuccess(payload)) {
        setUser(null);
        return;
      }

      setUser(payload.data.user);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    loadSession();

    if (!options?.listenToAuthChanges) {
      return;
    }

    window.addEventListener("absp-auth-changed", loadSession);
    return () => window.removeEventListener("absp-auth-changed", loadSession);
  }, [loadSession, options?.listenToAuthChanges]);

  return { user, checking, setUser, reload: loadSession };
}
