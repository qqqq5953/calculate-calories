import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { withDb, type Db } from "@/lib/db/client";
import { mealItems, meals, type Meal, type MealItem, type MealType } from "@/lib/db/schema";
import { computeItem, sumNutrients, type Nutrients } from "@/lib/nutrition/calc";
import { itemValues, type ResolvedItem } from "@/lib/nutrition/resolve";
import { dayRange } from "@/lib/time";

export type MealView = { meal: Meal; items: MealItem[] };

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

/** 一道菜的食物與營養欄位（不含所屬的餐、順序） */
function itemFields(r: ResolvedItem) {
  return {
    foodId: r.foodId,
    name: r.name,
    portion: r.portion,
    unit: r.unit,
    unitGrams: r.unitGrams,
    kcal100g: r.per100g.kcal,
    protein100g: r.per100g.protein,
    carb100g: r.per100g.carb,
    fat100g: r.per100g.fat,
    ...itemValues(r),
    confidence: r.confidence,
    alternatives: r.alternatives.map((name) => ({ name })),
  };
}

function itemInsert(mealId: string, position: number, r: ResolvedItem, addedBy: "ai" | "user") {
  return { mealId, position, addedBy, ...itemFields(r) };
}

export function createMeal(
  userId: string,
  meta: {
    eatenAt: Date;
    mealType: MealType;
    source: Meal["source"];
    photoPath?: string | null;
    aiRaw?: unknown;
    possiblyMissed?: string[];
  },
  items: ResolvedItem[],
): Promise<MealView> {
  return withDb((db) =>
    db.transaction(async (tx) => {
      const [meal] = await tx
        .insert(meals)
        .values({
          userId,
          eatenAt: meta.eatenAt,
          mealType: meta.mealType,
          source: meta.source,
          photoPath: meta.photoPath ?? null,
          aiRaw: meta.aiRaw ?? null,
          possiblyMissed: meta.possiblyMissed ?? [],
        })
        .returning();
      const inserted = items.length
        ? await tx
            .insert(mealItems)
            .values(items.map((r, idx) => itemInsert(meal.id, idx, r, "ai")))
            .returning()
        : [];
      return { meal, items: inserted };
    }),
  );
}

async function loadView(db: Exec, mealId: string, userId: string): Promise<MealView | undefined> {
  const [meal] = await db
    .select()
    .from(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)))
    .limit(1);
  if (!meal) return undefined;
  const items = await db
    .select()
    .from(mealItems)
    .where(and(eq(mealItems.mealId, mealId), isNull(mealItems.deletedAt)))
    .orderBy(asc(mealItems.position));
  return { meal, items };
}

export function getMealView(mealId: string, userId: string): Promise<MealView | undefined> {
  return withDb((db) => loadView(db, mealId, userId));
}

/** 取得項目並確認屬於這個使用者 */
export function getItem(itemId: string, userId: string): Promise<{ item: MealItem; meal: Meal } | undefined> {
  return withDb(async (db) => {
    const [row] = await db
      .select({ item: mealItems, meal: meals })
      .from(mealItems)
      .innerJoin(meals, eq(meals.id, mealItems.mealId))
      .where(and(eq(mealItems.id, itemId), eq(meals.userId, userId)))
      .limit(1);
    return row;
  });
}

async function bumpVersion(db: Exec, mealId: string) {
  await db
    .update(meals)
    .set({ version: sql`${meals.version} + 1` })
    .where(eq(meals.id, mealId));
}

/** 修改一道菜後回傳最新的整餐 */
async function mutateItem(
  itemId: string,
  userId: string,
  fn: (db: Exec, item: MealItem) => Promise<void>,
): Promise<MealView | undefined> {
  return withDb((db) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select({ item: mealItems })
        .from(mealItems)
        .innerJoin(meals, eq(meals.id, mealItems.mealId))
        .where(and(eq(mealItems.id, itemId), eq(meals.userId, userId)))
        .limit(1);
      if (!row) return undefined;
      await fn(tx, row.item);
      await bumpVersion(tx, row.item.mealId);
      return loadView(tx, row.item.mealId, userId);
    }),
  );
}

export function setItemPortion(itemId: string, userId: string, portion: number) {
  return mutateItem(itemId, userId, async (db, item) => {
    const v = computeItem(portion, item.unitGrams, {
      kcal: item.kcal100g,
      protein: item.protein100g,
      carb: item.carb100g,
      fat: item.fat100g,
    });
    // 使用者確認過份量，就不再標記為不確定
    await db
      .update(mealItems)
      .set({ portion, ...v, confidence: "high", deletedAt: null })
      .where(eq(mealItems.id, item.id));
  });
}

export function replaceItemFood(itemId: string, userId: string, r: ResolvedItem) {
  return mutateItem(itemId, userId, async (db, item) => {
    // 換食物時保留原本的份量感：沿用原來的克數換算新單位
    const grams = item.grams;
    const portion = r.unitGrams > 0 ? Math.max(0.5, Math.round((grams / r.unitGrams) * 2) / 2) : r.portion;
    const resolved = { ...r, portion, confidence: "high" as const, alternatives: [] };
    await db.update(mealItems).set(itemFields(resolved)).where(eq(mealItems.id, item.id));
  });
}

export function deleteItem(itemId: string, userId: string) {
  return mutateItem(itemId, userId, async (db, item) => {
    await db.update(mealItems).set({ deletedAt: new Date() }).where(eq(mealItems.id, item.id));
  });
}

export function addItem(mealId: string, userId: string, r: ResolvedItem): Promise<MealView | undefined> {
  return withDb((db) =>
    db.transaction(async (tx) => {
      const view = await loadView(tx, mealId, userId);
      if (!view) return undefined;
      const [{ max }] = await tx
        .select({ max: sql<number>`coalesce(max(${mealItems.position}), -1)` })
        .from(mealItems)
        .where(eq(mealItems.mealId, mealId));
      await tx.insert(mealItems).values(itemInsert(mealId, Number(max) + 1, { ...r, confidence: "high" }, "user"));
      await bumpVersion(tx, mealId);
      return loadView(tx, mealId, userId);
    }),
  );
}

export function updateMeal(
  mealId: string,
  userId: string,
  patch: Partial<Pick<Meal, "mealType" | "eatenAt" | "deletedAt">>,
): Promise<MealView | undefined> {
  return withDb((db) =>
    db.transaction(async (tx) => {
      const res = await tx
        .update(meals)
        .set({ ...patch, version: sql`${meals.version} + 1` })
        .where(and(eq(meals.id, mealId), eq(meals.userId, userId)))
        .returning({ id: meals.id });
      if (res.length === 0) return undefined;
      return loadView(tx, mealId, userId);
    }),
  );
}

export type DaySummary = {
  totals: Nutrients;
  meals: { id: string; mealType: MealType; eatenAt: Date; kcal: number }[];
};

export function daySummary(userId: string, date: string, timeZone: string): Promise<DaySummary> {
  const [start, end] = dayRange(date, timeZone);
  return withDb(async (db) => {
    const rows = await db
      .select({
        mealId: meals.id,
        mealType: meals.mealType,
        eatenAt: meals.eatenAt,
        kcal: mealItems.kcal,
        proteinG: mealItems.proteinG,
        carbG: mealItems.carbG,
        fatG: mealItems.fatG,
      })
      .from(meals)
      .leftJoin(mealItems, and(eq(mealItems.mealId, meals.id), isNull(mealItems.deletedAt)))
      .where(
        and(eq(meals.userId, userId), isNull(meals.deletedAt), gte(meals.eatenAt, start), lt(meals.eatenAt, end)),
      )
      .orderBy(asc(meals.eatenAt));

    const byMeal = new Map<string, DaySummary["meals"][number]>();
    const nutrients: Nutrients[] = [];
    for (const r of rows) {
      const m = byMeal.get(r.mealId) ?? { id: r.mealId, mealType: r.mealType, eatenAt: r.eatenAt, kcal: 0 };
      if (r.kcal !== null) {
        m.kcal += r.kcal;
        nutrients.push({ kcal: r.kcal, proteinG: r.proteinG ?? 0, carbG: r.carbG ?? 0, fatG: r.fatG ?? 0 });
      }
      byMeal.set(r.mealId, m);
    }
    return { totals: sumNutrients(nutrients), meals: [...byMeal.values()] };
  });
}

export type DailyTotal = Nutrients & { date: string };

/** 每日加總（使用者時區），只回有紀錄的日子 */
export function dailyTotals(userId: string, fromDate: string, toDate: string, timeZone: string): Promise<DailyTotal[]> {
  const [start] = dayRange(fromDate, timeZone);
  const [, end] = dayRange(toDate, timeZone);
  return withDb(async (db) => {
    const day = sql<string>`to_char(${meals.eatenAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;
    const rows = await db
      .select({
        date: day,
        kcal: sql<number>`coalesce(sum(${mealItems.kcal}), 0)`,
        proteinG: sql<number>`coalesce(sum(${mealItems.proteinG}), 0)`,
        carbG: sql<number>`coalesce(sum(${mealItems.carbG}), 0)`,
        fatG: sql<number>`coalesce(sum(${mealItems.fatG}), 0)`,
      })
      .from(meals)
      .innerJoin(mealItems, and(eq(mealItems.mealId, meals.id), isNull(mealItems.deletedAt)))
      .where(
        and(eq(meals.userId, userId), isNull(meals.deletedAt), gte(meals.eatenAt, start), lt(meals.eatenAt, end)),
      )
      // 用欄位序號：時區是參數，重複寫運算式時 Postgres 會視為不同的運算式
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    return rows.map((r) => ({
      date: r.date,
      kcal: Math.round(Number(r.kcal)),
      proteinG: Math.round(Number(r.proteinG) * 10) / 10,
      carbG: Math.round(Number(r.carbG) * 10) / 10,
      fatG: Math.round(Number(r.fatG) * 10) / 10,
    }));
  });
}

export function mealsOnDate(userId: string, date: string, timeZone: string): Promise<MealView[]> {
  const [start, end] = dayRange(date, timeZone);
  return withDb(async (db) => {
    const ms = await db
      .select()
      .from(meals)
      .where(
        and(eq(meals.userId, userId), isNull(meals.deletedAt), gte(meals.eatenAt, start), lt(meals.eatenAt, end)),
      )
      .orderBy(asc(meals.eatenAt));
    const views: MealView[] = [];
    for (const m of ms) {
      const items = await db
        .select()
        .from(mealItems)
        .where(and(eq(mealItems.mealId, m.id), isNull(mealItems.deletedAt)))
        .orderBy(asc(mealItems.position));
      views.push({ meal: m, items });
    }
    return views;
  });
}
