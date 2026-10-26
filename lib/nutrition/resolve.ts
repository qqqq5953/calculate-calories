import type { Food, FoodCategory } from "@/lib/db/schema";
import type { RecognizedItem } from "@/lib/ai/schema";
import { computeItem, type Per100g } from "./calc";

export type ResolvedItem = {
  foodId: string | null;
  name: string;
  portion: number;
  unit: string;
  unitGrams: number;
  per100g: Per100g;
  category: FoodCategory;
  confidence: "high" | "low";
  alternatives: string[];
};

export function foodPer100g(f: Pick<Food, "kcal100g" | "protein100g" | "carb100g" | "fat100g">): Per100g {
  return { kcal: f.kcal100g, protein: f.protein100g, carb: f.carb100g, fat: f.fat100g };
}

/**
 * 合併 AI 辨識結果與資料庫比對到的食物：
 * - 營養以資料庫為準（食藥署數值比 AI 估的可靠）
 * - 份量單位：資料庫有單位就用資料庫的，沒有（食藥署原始資料）就用 AI 的
 */
export function resolveItem(rec: RecognizedItem, food: Food | null): ResolvedItem {
  const aiUnitGrams = rec.grams_per_unit > 0 ? rec.grams_per_unit : 100;
  if (!food) {
    return {
      foodId: null,
      name: rec.name,
      portion: rec.portion > 0 ? rec.portion : 1,
      unit: rec.unit || "份",
      unitGrams: aiUnitGrams,
      per100g: rec.est_per_100g,
      category: rec.category,
      confidence: rec.confidence,
      alternatives: rec.alternatives.slice(0, 4),
    };
  }

  let portion = rec.portion > 0 ? rec.portion : 1;
  let unit = rec.unit || "份";
  let unitGrams = aiUnitGrams;
  if (food.defaultUnit && food.unitGrams) {
    if (food.defaultUnit !== unit) {
      // 單位不同：用 AI 估的總克數換算成資料庫的單位，取到 0.5 單位
      const grams = portion * aiUnitGrams;
      portion = Math.max(0.5, Math.round((grams / food.unitGrams) * 2) / 2);
    }
    unit = food.defaultUnit;
    unitGrams = food.unitGrams;
  }

  return {
    foodId: food.id,
    name: food.name,
    portion,
    unit,
    unitGrams,
    per100g: foodPer100g(food),
    category: food.category,
    confidence: rec.confidence,
    alternatives: rec.alternatives.slice(0, 4),
  };
}

export function itemValues(r: Pick<ResolvedItem, "portion" | "unitGrams" | "per100g">) {
  return computeItem(r.portion, r.unitGrams, r.per100g);
}
