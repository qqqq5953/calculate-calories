import { getSessionUserId } from "@/lib/auth/session";
import { notifyAdminDbDown } from "@/lib/admin";
import { DbUnavailableError, withDb } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/**
 * API route 的共用外殼：統一處理未登入、DB 連不上（回 503 讓前端顯示重試畫面）、其他錯誤。
 */
export function api<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.code }, { status: err.status });
      }
      if (err instanceof DbUnavailableError) {
        console.error("API: db unavailable", err.cause ?? err);
        await notifyAdminDbDown("儀表板 API");
        return Response.json({ error: "db_unavailable" }, { status: 503 });
      }
      console.error("API error", err);
      return Response.json({ error: "internal" }, { status: 500 });
    }
  };
}

export async function requireUser(): Promise<User> {
  const userId = await getSessionUserId();
  if (!userId) throw new HttpError(401, "unauthorized");
  const user = await withDb(async (db) => {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return u;
  });
  if (!user) throw new HttpError(401, "unauthorized");
  return user;
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "bad_json");
  }
}
