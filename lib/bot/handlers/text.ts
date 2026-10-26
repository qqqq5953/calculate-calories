import { recognizeText } from "@/lib/ai/recognize";
import { searchFoods } from "@/lib/db/queries/foods";
import { addItem, createMeal, getItem, replaceItemFood, setItemPortion } from "@/lib/db/queries/meals";
import { clearState, getState } from "@/lib/db/queries/state";
import { showLoading, text } from "@/lib/line/client";
import { foodChoices, portionItems, postbackItem, quickReply, recordMenu } from "@/lib/line/quickReplies";
import { parsePortion } from "@/lib/nutrition/parsePortion";
import { mealTypeAt } from "@/lib/time";
import type { BotContext } from "../context";
import { mealCardMessage, resolveChoice, resolveRecognition } from "../meal";
import { MSG } from "../messages";
import { replySummary } from "./summary";

const SUMMARY_KEYWORDS = /^(今日|今天|摘要|今日摘要|今天吃了什麼)$/;
const RECORD_KEYWORDS = /^(記錄|記錄一餐|拍照)$/;

export async function handleText(ctx: BotContext, input: string) {
  const user = ctx.requireUser();
  const t = input.trim();
  const state = await getState(user.id);

  if (state?.state === "awaiting_portion" && state.payload.itemId) {
    const portion = parsePortion(t);
    if (portion === undefined) {
      const found = await getItem(state.payload.itemId, user.id);
      await ctx.reply(text(MSG.badPortion, found ? quickReply(portionItems(found.item)) : undefined));
      return;
    }
    await clearState(user.id);
    const view = await setItemPortion(state.payload.itemId, user.id, portion);
    await ctx.reply(view ? await mealCardMessage(ctx, view) : text(MSG.noMeal));
    return;
  }

  if (state?.state === "awaiting_food_name") {
    await clearState(user.id);
    await handleFoodName(ctx, t, state.payload);
    return;
  }

  if (SUMMARY_KEYWORDS.test(t)) return replySummary(ctx);
  if (RECORD_KEYWORDS.test(t)) return ctx.reply(text(MSG.record, recordMenu()));

  // 沒有狀態：當作餐點描述交給 AI；AI 只會回 JSON，判斷不是食物就給固定回覆
  await showLoading(ctx.lineUserId);
  const rec = await recognizeText(t);
  if (rec.kind !== "meal" || rec.items.length === 0) {
    await ctx.reply(text(MSG.notFood, recordMenu()));
    return;
  }
  const now = new Date();
  const view = await createMeal(
    user.id,
    {
      eatenAt: now,
      mealType: mealTypeAt(now, ctx.tz),
      source: "text",
      aiRaw: rec,
      possiblyMissed: rec.possibly_missed.slice(0, 4),
    },
    await resolveRecognition(rec),
  );
  await ctx.reply(await mealCardMessage(ctx, view));
}

/** 使用者輸入食物名稱：先查資料庫給選項，查不到才問 AI */
async function handleFoodName(
  ctx: BotContext,
  name: string,
  payload: { mealId: string; itemId?: string; mode?: "replace" | "add" },
) {
  const user = ctx.requireUser();
  const replace = payload.mode === "replace" && payload.itemId;
  const candidates = await searchFoods(name, 5);

  if (candidates.length > 0) {
    const aiOption = postbackItem(
      `🤖 估算「${name}」`,
      replace ? { a: "swap", i: payload.itemId!, n: name } : { a: "add_food", m: payload.mealId, n: name },
    );
    await ctx.reply(
      text(
        MSG.pickFood(name),
        foodChoices(
          candidates,
          (f) => (replace ? { a: "swap", i: payload.itemId!, f: f.id } : { a: "add_food", m: payload.mealId, f: f.id }),
          [aiOption],
        ),
      ),
    );
    return;
  }

  await showLoading(ctx.lineUserId);
  const resolved = await resolveChoice({ name });
  if (!resolved) {
    await ctx.reply(text(MSG.notFood));
    return;
  }
  const view = replace
    ? await replaceItemFood(payload.itemId!, user.id, resolved)
    : await addItem(payload.mealId, user.id, resolved);
  await ctx.reply(view ? await mealCardMessage(ctx, view) : text(MSG.noMeal));
}
