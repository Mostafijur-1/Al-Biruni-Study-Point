"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";

import { apiFetch, isApiSuccess } from "@/lib/api/client";
import type { MeResponseData } from "@/types/api";
import type { SessionUser } from "@/types";

type UseSessionOptions = {
  listenToAuthChanges?: boolean;
};

interface SessionState {
  user: SessionUser | null;
  checking: boolean;
  initialized: boolean;
  setUser: (
    user: SessionUser | null | ((prev: SessionUser | null) => SessionUser | null)
  ) => void;
  setChecking: (checking: boolean) => void;
  setInitialized: (initialized: boolean) => void;
}

const useSessionStore = create<SessionState>((set) => ({
  user: null,
  checking: true,
  initialized: false,
  setUser: (user) =>
    set((state) => ({
      user: typeof user === "function" ? user(state.user) : user,
    })),
  setChecking: (checking) => set({ checking }),
  setInitialized: (initialized) => set({ initialized }),
}));

// Module-level cache to deduplicate active /api/auth/me network requests
let activeFetchPromise: Promise<SessionUser | null> | null = null;

async function fetchSessionUser(): Promise<SessionUser | null> {
  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const { ok, payload } = await apiFetch<MeResponseData>("/api/auth/me");
      if (ok && isApiSuccess(payload)) {
        return payload.data.user;
      }
      return null;
    } catch {
      return null;
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}

export function useSession(options?: UseSessionOptions) {
  const user = useSessionStore((state) => state.user);
  const checking = useSessionStore((state) => state.checking);
  const initialized = useSessionStore((state) => state.initialized);
  const setUser = useSessionStore((state) => state.setUser);
  const setChecking = useSessionStore((state) => state.setChecking);
  const setInitialized = useSessionStore((state) => state.setInitialized);

  const loadSession = useCallback(
    async (force = false) => {
      // If not forced and we are already checking, just await the active promise
      if (!force && activeFetchPromise) {
        await activeFetchPromise;
        return;
      }

      // If not forced and already initialized, do not trigger a new network fetch
      if (!force && initialized) {
        return;
      }

      setChecking(true);
      const fetchedUser = await fetchSessionUser();
      setUser(fetchedUser);
      setChecking(false);
      setInitialized(true);
    },
    [initialized, setUser, setChecking, setInitialized]
  );

  // Initial fetch on mount if not initialized
  useEffect(() => {
    if (!initialized && !activeFetchPromise) {
      loadSession();
    }
  }, [initialized, loadSession]);

  // Listen to auth changes
  useEffect(() => {
    if (!options?.listenToAuthChanges) {
      return;
    }

    const handleAuthChanged = () => {
      loadSession(true);
    };

    window.addEventListener("absp-auth-changed", handleAuthChanged);
    return () => {
      window.removeEventListener("absp-auth-changed", handleAuthChanged);
    };
  }, [loadSession, options?.listenToAuthChanges]);

  return {
    user,
    checking,
    setUser,
    reload: useCallback(() => loadSession(true), [loadSession]),
  };
}
