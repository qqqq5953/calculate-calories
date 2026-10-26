/**
 * 整合測試：需要一個已跑過 migration 和 seed 的 Postgres。
 * TEST_DATABASE_URL=postgres://... npx vitest run tests/db.integration.test.ts
 * 沒設定 TEST_DATABASE_URL 時自動略過。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database queries", async () => {
  process.env.DATABASE_URL = url;
  const { closeDb } = await import("@/lib/db/client");
  const foodsQ = await import("@/lib/db/queries/foods");
  const mealsQ = await import("@/lib/db/queries/meals");
  const stateQ = await import("@/lib/db/queries/state");
  const { getOrCreateUser } = await import("@/lib/db/queries/users");
  const { resolveItem } = await import("@/lib/nutrition/resolve");
  const { localDate } = await import("@/lib/time");

  let userId: string;
  const lineUserId = `Utest${Date.now()}`;

  beforeAll(async () => {
    userId = (await getOrCreateUser(lineUserId, "測試")).id;
  });
  afterAll(closeDb);

  it("getOrCreateUser is idempotent", async () => {
    expect((await getOrCreateUser(lineUserId)).id).toBe(userId);
  });

  it("matchFood prefers seed foods with units for exact alias", async () => {
    const f = await foodsQ.matchFood("白米飯");
    expect(f?.name).toBe("白飯");
    expect(f?.source).toBe("seed");
  });

  it("matchFood falls back to trigram similarity", async () => {
    expect((await foodsQ.matchFood("滷雞腿肉"))?.name).toBe("滷雞腿");
    expect(await foodsQ.matchFood("完全不存在的東西xyz")).toBeNull();
  });

  it("searchFoods returns candidates", async () => {
    const names = (await foodsQ.searchFoods("豆干")).map((f) => f.name);
    expect(names).toContain("滷豆干");
  });

  it("meal lifecycle: create → portion → swap → add → delete → summaries", async () => {
    const rice = await foodsQ.matchFood("白飯");
    const rec = {
      name: "白飯", portion: 1, unit: "碗", grams_per_unit: 200, confidence: "high" as const,
      alternatives: [], category: "staple" as const,
      est_per_100g: { kcal: 180, protein: 3, carb: 40, fat: 0.3 },
    };
    const tofu = {
      ...rec, name: "滷豆干", portion: 2, unit: "塊", grams_per_unit: 35, confidence: "low" as const,
      alternatives: ["滷蛋", "油豆腐"], category: "egg_bean" as const,
    };
    const eatenAt = new Date();
    const view = await mealsQ.createMeal(
      userId,
      { eatenAt, mealType: "lunch", source: "photo", possiblyMissed: ["湯"] },
      [resolveItem(rec, rice), resolveItem(tofu, await foodsQ.matchFood("滷豆干"))],
    );
    expect(view.items).toHaveLength(2);
    expect(view.items[0].kcal).toBe(366);
    expect(view.items[1].confidence).toBe("low");
    expect(view.items[1].alternatives).toEqual([{ name: "滷蛋" }, { name: "油豆腐" }]);

    const halved = await mealsQ.setItemPortion(view.items[0].id, userId, 0.5);
    expect(halved?.items[0].kcal).toBe(183);
    expect(halved?.meal.version).toBe(2);

    const egg = await foodsQ.matchFood("滷蛋");
    const swapped = await mealsQ.replaceItemFood(view.items[1].id, userId, resolveItem({ ...tofu, name: "滷蛋" }, egg));
    expect(swapped?.items[1].name).toBe("滷蛋");
    expect(swapped?.items[1].confidence).toBe("high");

    const added = await mealsQ.addItem(view.meal.id, userId, resolveItem({ ...rec, name: "味噌湯" }, await foodsQ.matchFood("味噌湯")));
    expect(added?.items.map((i) => i.name)).toEqual(["白飯", "滷蛋", "味噌湯"]);

    const afterDelete = await mealsQ.deleteItem(added!.items[2].id, userId);
    expect(afterDelete?.items).toHaveLength(2);

    // 別人不能改這餐
    const stranger = await getOrCreateUser(`${lineUserId}x`);
    expect(await mealsQ.setItemPortion(view.items[0].id, stranger.id, 3)).toBeUndefined();

    const today = localDate(eatenAt);
    const day = await mealsQ.daySummary(userId, today, "Asia/Taipei");
    expect(day.meals).toHaveLength(1);
    expect(day.totals.kcal).toBe(afterDelete!.items.reduce((s, i) => s + i.kcal, 0));

    const totals = await mealsQ.dailyTotals(userId, today, today, "Asia/Taipei");
    expect(totals).toEqual([expect.objectContaining({ date: today, kcal: day.totals.kcal })]);

    await mealsQ.updateMeal(view.meal.id, userId, { deletedAt: new Date() });
    expect((await mealsQ.daySummary(userId, today, "Asia/Taipei")).meals).toHaveLength(0);
  });

  it("foodsByCategory ranks the user's own foods first", async () => {
    const list = await foodsQ.foodsByCategory("egg_bean", userId, 5);
    expect(list[0].name).toBe("滷蛋");
  });

  it("conversation state expires", async () => {
    await stateQ.setState(userId, "awaiting_portion", { mealId: "m", itemId: "i" });
    expect((await stateQ.getState(userId))?.state).toBe("awaiting_portion");
    await stateQ.clearState(userId);
    expect(await stateQ.getState(userId)).toBeUndefined();
  });
});
