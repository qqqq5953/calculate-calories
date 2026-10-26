import { validateSignature, type webhook } from "@line/bot-sdk";
import { after } from "next/server";
import { handleEvent } from "@/lib/bot/dispatch";
import { env } from "@/lib/env";

export const runtime = "nodejs";
// AI 辨識可能要十幾秒；背景處理需要足夠的執行時間
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  if (!validateSignature(body, env.lineChannelSecret(), signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let events: webhook.Event[] = [];
  try {
    events = (JSON.parse(body) as webhook.CallbackRequest).events ?? [];
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // 先回 200 避免 LINE 重送，實際處理放到背景
  after(async () => {
    const fresh = events.filter((e) => !e.deliveryContext?.isRedelivery);
    await Promise.all(fresh.map(handleEvent));
  });

  return new Response("ok");
}
