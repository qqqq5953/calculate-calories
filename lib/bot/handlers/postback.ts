import type { messagingApi } from "@line/bot-sdk";
import { foodsByCategory } from "@/lib/db/queries/foods";
import {
  addItem,
  deleteItem,
  getItem,
  getMealView,
  replaceItemFood,
  setItemPortion,
  updateMeal,
  type MealView,
} from "@/lib/db/queries/meals";
import { setState } from "@/lib/db/queries/state";
import { showLoading, text } from "@/lib/line/client";
import { decodePostback, type Postback } from "@/lib/line/postback";
import {
  addMenu,
  CATEGORY_LABEL,
  foodChoices,
  itemMenu,
  lowConfidenceMenu,
  moreMenu,
  portionItems,
  postbackItem,
  quickReply,
  recordMenu,
} from "@/lib/line/quickReplies";
import { zonedToUtc } from "@/lib/time";
import type { BotContext } from "../context";
import { mealCardMessage, resolveChoice } from "../meal";
import { MSG } from "../messages";
import { replySummary } from "./summary";

export async function handlePostback(ctx: BotContext, data: string, params?: Record<string, string>) {
  const p = decodePostback(data);
  if (!p) {
    console.warn("unknown postback", data);
    return;
  }
  await dispatch(ctx, p, params);
}

async function replyView(ctx: BotContext, view: MealView | undefined, qr?: messagingApi.QuickReply) {
  if (!view) return ctx.reply(text(MSG.noMeal));
  await ctx.reply(await mealCardMessage(ctx, view, qr));
}

async function dispatch(ctx: BotContext, p: Postback, params?: Record<string, string>) {
  const user = ctx.requireUser();

  switch (p.a) {
    case "record":
      return ctx.reply(text(MSG.record, recordMenu()));

    case "today":
      return replySummary(ctx);

    case "show_meal":
      return replyView(ctx, await getMealView(p.m, user.id));

    case "item": {
      const found = await getItem(p.i, user.id);
      if (!found) return ctx.reply(text(MSG.noMeal));
      const menu = found.item.confidence === "low" ? lowConfidenceMenu(found.item) : itemMenu(found.item);
      if (found.item.deletedAt || found.meal.version !== p.v) {
        // 舊卡片：先給最新的卡片；項目還在就照樣掛上選單（用 id 定位，不會改錯）
        const view = await getMealView(found.meal.id, user.id);
        if (!view) return ctx.reply(text(MSG.noMeal));
        const deleted = Boolean(found.item.deletedAt);
        return ctx.reply(
          text(deleted ? MSG.noItem : MSG.staleCard),
          await mealCardMessage(ctx, view, deleted ? undefined : menu),
        );
      }
      const label = found.item.confidence === "low"
        ? `「${found.item.name}」不太確定，是哪一個呢？`
        : `${found.item.name}要怎麼調整？`;
      return ctx.reply(text(label, menu));
    }

    case "qty":
      return replyView(ctx, await setItemPortion(p.i, user.id, p.q));

    case "qty_menu": {
      const found = await getItem(p.i, user.id);
      if (!found) return ctx.reply(text(MSG.noMeal));
      return ctx.reply(
        text(
          `${found.item.name}吃了多少？`,
          quickReply([
            ...portionItems(found.item),
            postbackItem("其他份量…", { a: "qty_other", i: p.i }, `${found.item.name} 其他份量`),
          ]),
        ),
      );
    }

    case "qty_other": {
      const found = await getItem(p.i, user.id);
      if (!found) return ctx.reply(text(MSG.noMeal));
      await setState(user.id, "awaiting_portion", { mealId: found.meal.id, itemId: p.i });
      return ctx.reply(text(`${MSG.askPortion}（單位：${found.item.unit}）`));
    }

    case "swap": {
      await showLoading(ctx.lineUserId);
      const resolved = await resolveChoice({ foodId: p.f, name: p.n });
      if (!resolved) return ctx.reply(text(MSG.notFood));
      return replyView(ctx, await replaceItemFood(p.i, user.id, resolved));
    }

    case "swap_other": {
      const found = await getItem(p.i, user.id);
      if (!found) return ctx.reply(text(MSG.noMeal));
      await setState(user.id, "awaiting_food_name", { mealId: found.meal.id, itemId: p.i, mode: "replace" });
      return ctx.reply(text(MSG.askFoodName));
    }

    case "del_item":
      return replyView(ctx, await deleteItem(p.i, user.id));

    case "add": {
      const view = await getMealView(p.m, user.id);
      if (!view) return ctx.reply(text(MSG.noMeal));
      return ctx.reply(text("要新增什麼？", addMenu(p.m, view.meal.possiblyMissed)));
    }

    case "add_cat": {
      const list = await foodsByCategory(p.c, user.id, 11);
      return ctx.reply(
        text(
          `${CATEGORY_LABEL[p.c]}：選一個（預設 1 份，加入後可以再調整）`,
          foodChoices(list, (f) => ({ a: "add_food", m: p.m, f: f.id }), [
            postbackItem("⌨️ 輸入名稱", { a: "add_other", m: p.m }, "輸入食物名稱"),
            postbackItem("↩ 返回", { a: "add", m: p.m }, "返回"),
          ]),
        ),
      );
    }

    case "add_food": {
      await showLoading(ctx.lineUserId);
      const resolved = await resolveChoice({ foodId: p.f, name: p.n });
      if (!resolved) return ctx.reply(text(MSG.notFood));
      return replyView(ctx, await addItem(p.m, user.id, resolved));
    }

    case "add_other":
      await setState(user.id, "awaiting_food_name", { mealId: p.m, mode: "add" });
      return ctx.reply(text(MSG.askFoodName));

    case "more":
      return ctx.reply(text("要改什麼？", moreMenu(p.m)));

    case "meal_type":
      return replyView(ctx, await updateMeal(p.m, user.id, { mealType: p.t }));

    case "meal_time": {
      const dt = params?.datetime;
      if (!dt) return;
      return replyView(ctx, await updateMeal(p.m, user.id, { eatenAt: zonedToUtc(dt, ctx.tz) }));
    }

    case "del_meal": {
      const view = await updateMeal(p.m, user.id, { deletedAt: new Date() });
      if (!view) return ctx.reply(text(MSG.noMeal));
      return ctx.reply(
        text(MSG.mealDeleted, quickReply([postbackItem("↩ 復原", { a: "undo_del_meal", m: p.m }, "復原")])),
      );
    }

    case "undo_del_meal": {
      const view = await updateMeal(p.m, user.id, { deletedAt: null });
      if (!view) return ctx.reply(text(MSG.noMeal));
      return ctx.reply(text(MSG.mealRestored), await mealCardMessage(ctx, view));
    }
  }
}
