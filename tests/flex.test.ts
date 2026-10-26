import { describe, expect, it } from "vitest";
import type { MealItem } from "@/lib/db/schema";
import { buildMealCard } from "@/lib/line/flex/mealCard";
import { buildSummaryCard } from "@/lib/line/flex/summaryCard";
import { addMenu, itemMenu, lowConfidenceMenu, moreMenu } from "@/lib/line/quickReplies";

const item = (over: Partial<MealItem>): MealItem => ({
  id: "item00000001",
  mealId: "meal00000001",
  position: 0,
  foodId: null,
  name: "白飯",
  portion: 1,
  unit: "碗",
  unitGrams: 200,
  kcal100g: 183,
  protein100g: 3.1,
  carb100g: 41,
  fat100g: 0.3,
  grams: 200,
  kcal: 366,
  proteinG: 6.2,
  carbG: 82,
  fatG: 0.6,
  confidence: "high",
  alternatives: [],
  addedBy: "ai",
  deletedAt: null,
  ...over,
});

const meal = {
  id: "meal00000001",
  eatenAt: new Date("2026-10-26T04:30:00Z"),
  mealType: "lunch" as const,
  version: 2,
  source: "photo" as const,
};

const day = { kcal: 1250, proteinG: 60, targetKcal: 1800, targetProteinG: 100 };

describe("buildMealCard", () => {
  const items = [
    item({}),
    item({
      id: "item00000002",
      name: "滷豆干",
      portion: 2,
      unit: "塊",
      kcal: 90,
      proteinG: 9,
      carbG: 3,
      fatG: 5,
      confidence: "low",
      alternatives: [{ name: "滷蛋" }, { name: "油豆腐" }],
    }),
  ];
  const card = buildMealCard({ meal, items, day });
  const json = JSON.stringify(card);

  it("shows total kcal and header", () => {
    expect(card.type).toBe("flex");
    expect(card.altText).toBe("午餐 456 kcal");
    expect(json).toContain("🍱 午餐 · 10/26 12:30");
  });

  it("marks low-confidence items", () => {
    expect(json).toContain("⚠️ 滷豆干?");
    expect(json).toContain("不太確定");
  });

  it("each row carries a short postback with meal version", () => {
    expect(json).toContain("a=item&m=meal00000001&i=item00000002&v=2");
  });

  it("stays well under LINE's 30KB bubble limit", () => {
    const many = Array.from({ length: 15 }, (_, i) => item({ id: `item${String(i).padStart(8, "0")}` }));
    expect(JSON.stringify(buildMealCard({ meal, items: many, day })).length).toBeLessThan(30_000);
  });
});

const itemsOf = (qr: { items?: { action?: { type: string } }[] }) => qr.items ?? [];
const labelsOf = (qr: Parameters<typeof itemsOf>[0]) =>
  itemsOf(qr).map((i) => (i.action as unknown as { label: string }).label);

describe("quick replies", () => {
  it("item menu has presets, other, swap, delete within 13", () => {
    expect(itemsOf(itemMenu(item({})))).toHaveLength(9);
  });

  it("low-confidence menu lists alternatives", () => {
    const qr = lowConfidenceMenu(item({ confidence: "low", alternatives: [{ name: "滷蛋" }, { name: "油豆腐" }] }));
    expect(labelsOf(qr)).toEqual(["✓ 白飯", "滷蛋", "油豆腐", "都不是", "改份量", "🗑 刪除"]);
  });

  it("add menu caps possibly-missed at 4 and total at 13", () => {
    const qr = addMenu("meal00000001", ["湯", "醬料", "飲料", "水果", "甜點"]);
    expect(itemsOf(qr).length).toBeLessThanOrEqual(13);
    expect(labelsOf(qr)[0]).toBe("＋湯");
  });

  it("more menu includes datetimepicker", () => {
    expect(itemsOf(moreMenu("meal00000001")).some((i) => i.action?.type === "datetimepicker")).toBe(true);
  });
});

describe("buildSummaryCard", () => {
  it("shows remaining kcal", () => {
    const card = buildSummaryCard({
      date: "2026-10-26",
      totals: { kcal: 1250, proteinG: 60, carbG: 150, fatG: 40 },
      targets: { kcal: 1800, proteinG: 100, carbG: 220, fatG: 55 },
      meals: [{ id: "meal00000001", mealType: "lunch", kcal: 650 }],
    });
    expect(JSON.stringify(card)).toContain("還可以吃 550 kcal");
  });
});
