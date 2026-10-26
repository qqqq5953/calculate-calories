import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "cc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const key = () => new TextEncoder().encode(env.sessionSecret());

/** 向 LINE 驗證 LIFF 的 ID token，回傳 LINE userId 和暱稱 */
export async function verifyLineIdToken(idToken: string): Promise<{ lineUserId: string; name?: string }> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env.lineLoginChannelId() }),
  });
  if (!res.ok) throw new Error(`LINE id token verify failed: ${res.status}`);
  const data = (await res.json()) as { sub?: string; name?: string };
  if (!data.sub) throw new Error("LINE id token has no sub");
  return { lineUserId: data.sub, name: data.name };
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** 回傳登入中的使用者 id；沒有或無效的 session 回傳 undefined */
export async function getSessionUserId(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub;
  } catch {
    return undefined;
  }
}
