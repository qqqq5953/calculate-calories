import { getOrCreateUser } from "@/lib/db/queries/users";
import { liffUrl } from "@/lib/env";
import { lineClient, text } from "@/lib/line/client";
import { encodePostback } from "@/lib/line/postback";
import { recordMenu } from "@/lib/line/quickReplies";
import type { BotContext } from "../context";
import { MSG } from "../messages";

export async function handleFollow(ctx: BotContext) {
  let displayName: string | undefined;
  try {
    displayName = (await lineClient().getProfile(ctx.lineUserId)).displayName;
  } catch {
    // 取不到暱稱不影響使用
  }
  ctx.user = await getOrCreateUser(ctx.lineUserId, displayName);

  await ctx.reply(text(MSG.welcome(displayName)), {
    type: "template",
    altText: "設定我的目標",
    template: {
      type: "buttons",
      text: "要先設定目標嗎？也可以先記錄，之後再設定。",
      actions: [
        { type: "uri", label: "⚙️ 設定我的目標", uri: liffUrl("/settings") || "https://line.me" },
        { type: "postback", label: "📷 先記錄一餐", data: encodePostback({ a: "record" }), displayText: "記錄一餐" },
      ],
    },
    quickReply: recordMenu(),
  });
}
