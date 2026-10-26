"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "./client-api";

export function useApi<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 重新載入時顯示 loading
    setLoading(true);
    apiFetch<T>(url)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e : new ApiError(0, "unknown"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
