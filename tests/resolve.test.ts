import { describe, expect, it } from "vitest";
import type { RecognizedItem } from "@/lib/ai/schema";
import type { Food } from "@/lib/db/schema";
import { itemValues, resolveItem } from "@/lib/nutrition/resolve";

const rec: RecognizedItem = {
  name: "白米飯",
  portion: 1,
  unit: "碗",
  grams_per_unit: 180,
  confidence: "high",
  alternatives: [],
  category: "staple",
  est_per_100g: { kcal: 170, protein: 3, carb: 38, fat: 0.5 },
};

const food = (over: Partial<Food>): Food => ({
  id: "food1",
  source: "seed",
  tfdaCode: null,
  name: "白飯",
  aliases: ["白米飯"],
  category: "staple",
  kcal100g: 183,
  protein100g: 3.1,
  carb100g: 41,
  fat100g: 0.3,
  defaultUnit: "碗",
  unitGrams: 200,
  popularity: 0,
  createdAt: new Date(),
  ...over,
});

describe("resolveItem", () => {
  it("uses AI estimate when no food matched", () => {
    const r = resolveItem(rec, null);
    expect(r.foodId).toBeNull();
    expect(r.unitGrams).toBe(180);
    expect(itemValues(r).kcal).toBe(306);
  });

  it("uses DB nutrition and DB unit when matched", () => {
    const r = resolveItem(rec, food({}));
    expect(r.name).toBe("白飯");
    expect(r.unitGrams).toBe(200);
    expect(r.portion).toBe(1);
    expect(itemValues(r).kcal).toBe(366);
  });

  it("keeps AI unit when DB food has no unit (TFDA raw data)", () => {
    const r = resolveItem(rec, food({ defaultUnit: null, unitGrams: null, source: "tfda" }));
    expect(r.unit).toBe("碗");
    expect(r.unitGrams).toBe(180);
    expect(r.per100g.kcal).toBe(183);
  });

  it("converts portion when units differ", () => {
    const r = resolveItem({ ...rec, name: "雞腿", unit: "份", portion: 2, grams_per_unit: 120 }, food({ defaultUnit: "支", unitGrams: 120 }));
    expect(r.unit).toBe("支");
    expect(r.portion).toBe(2);
  });
});
