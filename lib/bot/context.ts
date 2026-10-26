import type { messagingApi } from "@line/bot-sdk";
import type { User } from "@/lib/db/schema";
import { reply } from "@/lib/line/client";

/**
 * 每個事件的處理環境。reply token 只能用一次，
 * 所以透過 ctx.reply 送出並記錄，錯誤處理時才知道還能不能回覆。
 */
export class BotContext {
  replied = false;
  user?: User;

  constructor(
    readonly lineUserId: string,
    readonly replyToken: string | undefined,
  ) {}

  get tz() {
    return this.user?.timezone ?? "Asia/Taipei";
  }

  requireUser(): User {
    if (!this.user) throw new Error("user not loaded");
    return this.user;
  }

  async reply(...messages: messagingApi.Message[]) {
    if (this.replied || !this.replyToken) return;
    this.replied = true;
    await reply(this.replyToken, messages);
  }
}
