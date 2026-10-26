"use client";

import type { ApiError } from "./client-api";

const MESSAGES: Record<string, string> = {
  db_unavailable: "系統暫時無法使用，請稍後再試 🙏",
  network: "網路連線有問題，請確認網路後再試一次。",
  unauthorized: "登入已過期，請從 LINE 重新打開。",
};

export function ErrorScreen({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="card error-box" role="alert">
      <p style={{ fontSize: 40, margin: 0 }}>😵</p>
      <p>{MESSAGES[error.code] ?? "發生錯誤，請稍後再試。"}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          重試
        </button>
      )}
    </div>
  );
}

export function Loading() {
  return <p className="muted" style={{ textAlign: "center", padding: 32 }}>載入中…</p>;
}
