import { notifyAdminDbDown } from "@/lib/admin";
import { pingDb } from "@/lib/db/client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron 每 5 天呼叫一次（vercel.json），打一次真正的 DB 查詢，
 * 避免 Supabase 免費方案因為 7 天沒有請求而暫停專案。
 */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    await pingDb();
    console.log("keepalive: db ok");
    return Response.json({ db: "ok", at: new Date().toISOString() });
  } catch (err) {
    console.error("keepalive: db unavailable", err);
    await notifyAdminDbDown("keepalive cron");
    return Response.json({ db: "unavailable" }, { status: 503 });
  }
}
