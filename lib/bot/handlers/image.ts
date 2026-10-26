import { prepareImage } from "@/lib/ai/image";
import { recognizeImage } from "@/lib/ai/recognize";
import { createMeal } from "@/lib/db/queries/meals";
import { downloadMessageContent, showLoading, text } from "@/lib/line/client";
import { addMenu, recordMenu } from "@/lib/line/quickReplies";
import { uploadMealPhoto } from "@/lib/storage";
import { mealTypeAt } from "@/lib/time";
import type { BotContext } from "../context";
import { mealCardMessage, resolveLabel, resolveRecognition } from "../meal";
import { MSG } from "../messages";

export async function handleImage(ctx: BotContext, messageId: string) {
  const user = ctx.requireUser();
  await showLoading(ctx.lineUserId);

  const original = await downloadMessageContent(messageId);
  const jpeg = await prepareImage(original);
  // 上傳和辨識同時進行
  const [photoPath, rec] = await Promise.all([uploadMealPhoto(user.id, jpeg), recognizeImage(jpeg)]);

  if (rec.kind === "not_food") {
    await ctx.reply(text(MSG.notFood, recordMenu()));
    return;
  }

  const now = new Date();
  const label = rec.kind === "nutrition_label" ? resolveLabel(rec) : undefined;
  const items = label ? [label] : await resolveRecognition(rec);

  const view = await createMeal(
    user.id,
    {
      eatenAt: now,
      mealType: mealTypeAt(now, ctx.tz),
      source: label ? "label" : "photo",
      photoPath,
      aiRaw: rec,
      possiblyMissed: rec.possibly_missed.slice(0, 4),
    },
    items,
  );

  const card = await mealCardMessage(ctx, view);
  if (view.items.length === 0) {
    await ctx.reply(card, text(MSG.emptyMeal, addMenu(view.meal.id, view.meal.possiblyMissed)));
  } else {
    await ctx.reply(card);
  }
}
