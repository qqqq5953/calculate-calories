import type { messagingApi } from "@line/bot-sdk";
import { estimateFood } from "@/lib/ai/recognize";
import type { Recognition } from "@/lib/ai/schema";
import { bumpPopularity, getFood, insertAiFood, matchFood } from "@/lib/db/queries/foods";
import { daySummary, type MealView } from "@/lib/db/queries/meals";
import type { Food } from "@/lib/db/schema";
import { buildMealCard } from "@/lib/line/flex/mealCard";
import { foodPer100g, resolveItem, type ResolvedItem } from "@/lib/nutrition/resolve";
import { localDate } from "@/lib/time";
import type { BotContext } from "./context";

/** 整餐卡片（附今日進度），可另外掛 quick reply */
export async function mealCardMessage(
  ctx: BotContext,
  view: MealView,
  quickReply?: messagingApi.QuickReply,
): Promise<messagingApi.FlexMessage> {
  const user = ctx.requireUser();
  const day = await daySummary(user.id, localDate(view.meal.eatenAt, ctx.tz), ctx.tz);
  const card = buildMealCard({
    meal: view.meal,
    items: view.items,
    timeZone: ctx.tz,
    day: {
      kcal: day.totals.kcal,
      proteinG: day.totals.proteinG,
      targetKcal: user.targetKcal,
      targetProteinG: user.targetProteinG,
    },
  });
  return quickReply ? { ...card, quickReply } : card;
}

/** AI 辨識結果 → 每道菜比對資料庫 → 可存檔的項目 */
export async function resolveRecognition(rec: Recognition): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];
  for (const item of rec.items) {
    const food = await matchFood(item.name);
    resolved.push(resolveItem(item, food));
  }
  return resolved;
}

/** 營養標示 → 單一項目（1 份） */
export function resolveLabel(rec: Recognition): ResolvedItem | undefined {
  const label = rec.label;
  if (!label) return undefined;
  const grams = label.serving_grams > 0 ? label.serving_grams : 100;
  const scale = 100 / grams;
  return {
    foodId: null,
    name: label.product_name || "包裝食品",
    portion: 1,
    unit: "份",
    unitGrams: grams,
    per100g: {
      kcal: label.per_serving.kcal * scale,
      protein: label.per_serving.protein * scale,
      carb: label.per_serving.carb * scale,
      fat: label.per_serving.fat * scale,
    },
    category: "other",
    confidence: "high",
    alternatives: [],
  };
}

function fromFood(food: Food): ResolvedItem {
  return {
    foodId: food.id,
    name: food.name,
    portion: 1,
    unit: food.defaultUnit ?? "份",
    unitGrams: food.unitGrams ?? 100,
    per100g: foodPer100g(food),
    category: food.category,
    confidence: "high",
    alternatives: [],
  };
}

/**
 * 依 foodId 或名稱取得要加入／替換的食物：
 * foodId → 資料庫；名稱 → 先比對資料庫，沒有才請 AI 估算並存起來。
 * 回傳 undefined 表示不是食物。
 */
export async function resolveChoice(choice: { foodId?: string; name?: string }): Promise<ResolvedItem | undefined> {
  if (choice.foodId) {
    const food = await getFood(choice.foodId);
    if (food) {
      await bumpPopularity(food.id);
      return fromFood(food);
    }
  }
  const name = choice.name?.trim();
  if (!name) return undefined;

  const matched = await matchFood(name);
  if (matched && matched.defaultUnit) {
    await bumpPopularity(matched.id);
    return fromFood(matched);
  }

  const rec = await estimateFood(name);
  if (rec.kind === "not_food" || rec.items.length === 0) return undefined;
  const resolved = resolveItem(rec.items[0], matched);
  if (!resolved.foodId) {
    const saved = await insertAiFood(resolved);
    resolved.foodId = saved.id;
  }
  return { ...resolved, confidence: "high", alternatives: [] };
}
