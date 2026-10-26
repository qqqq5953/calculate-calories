import { and, desc, eq, sql } from "drizzle-orm";
import { withDb } from "@/lib/db/client";
import { foods, mealItems, meals, type Food, type FoodCategory } from "@/lib/db/schema";
import type { ResolvedItem } from "@/lib/nutrition/resolve";

// 有份量單位的資料（seed、使用者常用）優先於食藥署原始資料
const SOURCE_RANK = sql`case ${foods.source} when 'seed' then 0 when 'user' then 1 when 'tfda' then 2 else 3 end`;

/** 精確比對名稱或別名 → trigram 相似度 ≥ 0.4 */
export function matchFood(name: string): Promise<Food | null> {
  const n = name.trim();
  if (!n) return Promise.resolve(null);
  return withDb(async (db) => {
    const [exact] = await db
      .select()
      .from(foods)
      .where(sql`${foods.name} = ${n} or ${n} = any(${foods.aliases})`)
      .orderBy(SOURCE_RANK)
      .limit(1);
    if (exact) return exact;
    const [fuzzy] = await db
      .select()
      .from(foods)
      .where(sql`similarity(${foods.name}, ${n}) >= 0.4`)
      .orderBy(desc(sql`similarity(${foods.name}, ${n})`), SOURCE_RANK)
      .limit(1);
    return fuzzy ?? null;
  });
}

/** 使用者輸入名稱時的候選清單 */
export function searchFoods(query: string, limit = 5): Promise<Food[]> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return withDb((db) =>
    db
      .select()
      .from(foods)
      .where(
        sql`${foods.name} ilike ${"%" + q + "%"} or ${q} = any(${foods.aliases}) or similarity(${foods.name}, ${q}) >= 0.25`,
      )
      .orderBy(
        desc(sql`(${foods.name} = ${q} or ${q} = any(${foods.aliases}))`),
        desc(sql`similarity(${foods.name}, ${q})`),
        SOURCE_RANK,
        desc(foods.popularity),
      )
      .limit(limit),
  );
}

/** 分類選單：先排這個使用者常吃的，再排全體熱門的 */
export function foodsByCategory(category: FoodCategory, userId: string, limit = 10): Promise<Food[]> {
  return withDb(async (db) => {
    const mine = db
      .select({ foodId: mealItems.foodId, n: sql<number>`count(*)`.as("n") })
      .from(mealItems)
      .innerJoin(meals, eq(meals.id, mealItems.mealId))
      .where(and(eq(meals.userId, userId), sql`${mealItems.foodId} is not null`))
      .groupBy(mealItems.foodId)
      .as("mine");
    const rows = await db
      .select({ food: foods })
      .from(foods)
      .leftJoin(mine, eq(mine.foodId, foods.id))
      .where(and(eq(foods.category, category), sql`${foods.defaultUnit} is not null`))
      .orderBy(desc(sql`coalesce(${mine.n}, 0)`), desc(foods.popularity), SOURCE_RANK)
      .limit(limit);
    return rows.map((r) => r.food);
  });
}

export function getFood(id: string): Promise<Food | undefined> {
  return withDb(async (db) => {
    const [f] = await db.select().from(foods).where(eq(foods.id, id)).limit(1);
    return f;
  });
}

/** AI 估算的新食物存起來，下次就能直接比對到 */
export function insertAiFood(r: ResolvedItem): Promise<Food> {
  return withDb(async (db) => {
    const [f] = await db
      .insert(foods)
      .values({
        source: "ai",
        name: r.name,
        category: r.category,
        kcal100g: r.per100g.kcal,
        protein100g: r.per100g.protein,
        carb100g: r.per100g.carb,
        fat100g: r.per100g.fat,
        defaultUnit: r.unit,
        unitGrams: r.unitGrams,
      })
      .returning();
    return f;
  });
}

export function bumpPopularity(foodId: string): Promise<void> {
  return withDb(async (db) => {
    await db
      .update(foods)
      .set({ popularity: sql`${foods.popularity} + 1` })
      .where(eq(foods.id, foodId));
  });
}
