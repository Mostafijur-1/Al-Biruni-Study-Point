"use client";

import { useEffect, useState } from "react";

import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";

type UseApiQueryOptions = {
  enabled?: boolean;
  loadingMessage?: string;
  errorMessage?: string;
};

export function useApiQuery<T>(url: string, options?: UseApiQueryOptions) {
  const enabled = options?.enabled ?? true;
  const loadingMessage = options?.loadingMessage;
  const errorMessage = options?.errorMessage;
  const [data, setData] = useState<T | null>(null);
  const [message, setMessage] = useState(loadingMessage ?? "Loading...");
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    async function load() {
      setIsLoading(true);
      if (loadingMessage) {
        setMessage(loadingMessage);
      }

      try {
        const { ok, payload } = await apiFetch<T>(url);

        if (!active) {
          return;
        }

        if (!ok || !isApiSuccess(payload)) {
          setData(null);
          setMessage(getApiErrorMessage(payload, errorMessage ?? "Request failed."));
          return;
        }

        setData(payload.data);
        setMessage("");
      } catch {
        if (active) {
          setData(null);
          setMessage(errorMessage ?? "Request failed.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [url, enabled, loadingMessage, errorMessage]);

  return { data, message, isLoading, setData, setMessage };
}
