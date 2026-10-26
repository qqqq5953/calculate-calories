import type { webhook } from "@line/bot-sdk";
import { AiRecognitionError } from "@/lib/ai/recognize";
import { notifyAdminDbDown } from "@/lib/admin";
import { DbUnavailableError } from "@/lib/db/client";
import { getOrCreateUser } from "@/lib/db/queries/users";
import { text } from "@/lib/line/client";
import { BotContext } from "./context";
import { handleFollow } from "./handlers/follow";
import { handleImage } from "./handlers/image";
import { handlePostback } from "./handlers/postback";
import { handleText } from "./handlers/text";
import { MSG } from "./messages";

/**
 * 處理單一事件。所有錯誤都在這裡收掉：
 * 一個事件失敗不影響其他事件，使用者也一定會收到回覆而不是石沉大海。
 */
export async function handleEvent(event: webhook.Event): Promise<void> {
  if (event.source?.type !== "user" || !event.source.userId) return;
  // 只在 1 對 1 聊天中運作
  const replyToken = "replyToken" in event ? (event.replyToken as string | undefined) : undefined;
  const ctx = new BotContext(event.source.userId, replyToken);

  try {
    await route(ctx, event);
  } catch (err) {
    await handleError(ctx, err);
  }
}

async function route(ctx: BotContext, event: webhook.Event) {
  if (event.type === "follow") return handleFollow(ctx);
  if (event.type !== "message" && event.type !== "postback") return;

  ctx.user = await getOrCreateUser(ctx.lineUserId);

  if (event.type === "postback") {
    return handlePostback(ctx, event.postback.data, event.postback.params);
  }
  const msg = event.message;
  if (msg.type === "image") return handleImage(ctx, msg.id);
  if (msg.type === "text") return handleText(ctx, msg.text);
  await ctx.reply(text(MSG.notFood));
}

export async function handleError(ctx: BotContext, err: unknown) {
  if (err instanceof DbUnavailableError) {
    console.error("DB unavailable while handling event", err.cause ?? err);
    await safeReply(ctx, MSG.dbUnavailable);
    await notifyAdminDbDown("LINE webhook");
    return;
  }
  if (err instanceof AiRecognitionError) {
    console.error("AI recognition failed", err.cause ?? err);
    await safeReply(ctx, MSG.aiFailed);
    return;
  }
  console.error("Unhandled bot error", err);
  await safeReply(ctx, MSG.genericError);
}

async function safeReply(ctx: BotContext, message: string) {
  try {
    await ctx.reply(text(message));
  } catch (err) {
    console.error("failed to send error reply", err);
  }
}
