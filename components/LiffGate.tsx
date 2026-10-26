"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "./client-api";
import { ErrorScreen, Loading } from "./ErrorScreen";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

async function login(): Promise<"done" | "redirecting"> {
  if (!LIFF_ID) {
    // 本機開發沒有 LIFF：用測試帳號登入（伺服器端需 ALLOW_DEV_LOGIN=1）
    await apiFetch("/api/auth", { method: "POST", body: JSON.stringify({ devLineUserId: "Udev-local" }) });
    return "done";
  }
  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return "redirecting";
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new ApiError(401, "unauthorized");
  await apiFetch("/api/auth", { method: "POST", body: JSON.stringify({ idToken }) });
  return "done";
}

/** 確認已登入（session cookie 有效），否則透過 LIFF 取得 ID token 登入 */
export function LiffGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "ready" | ApiError>("checking");

  const run = useCallback(async () => {
    setState("checking");
    try {
      await apiFetch("/api/me");
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        try {
          if ((await login()) === "done") setState("ready");
        } catch (e) {
          setState(e instanceof ApiError ? e : new ApiError(401, "unauthorized"));
        }
      } else {
        setState(err instanceof ApiError ? err : new ApiError(0, "unknown"));
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 掛載時檢查登入
    void run();
  }, [run]);

  if (state === "checking") return <Loading />;
  if (state instanceof ApiError) return <ErrorScreen error={state} onRetry={run} />;
  return <>{children}</>;
}
