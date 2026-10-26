/**
 * 匯入常見台灣餐點（含份量單位）。可以重複執行：同名的 seed 食物會更新，不會重複新增。
 * 用法：DATABASE_URL=... npx tsx scripts/seed-units.ts
 */
import { and, eq } from "drizzle-orm";
import { SEED_FOODS } from "@/data/seed-foods";
import { closeDb, withDb } from "@/lib/db/client";
import { foods } from "@/lib/db/schema";

async function main() {
  let inserted = 0;
  let updated = 0;
  await withDb(async (db) => {
    for (const [name, aliases, category, kcal, protein, carb, fat, unit, unitGrams] of SEED_FOODS) {
      const values = {
        source: "seed" as const,
        name,
        aliases,
        category,
        kcal100g: kcal,
        protein100g: protein,
        carb100g: carb,
        fat100g: fat,
        defaultUnit: unit,
        unitGrams,
      };
      const [existing] = await db
        .select({ id: foods.id })
        .from(foods)
        .where(and(eq(foods.source, "seed"), eq(foods.name, name)))
        .limit(1);
      if (existing) {
        await db.update(foods).set(values).where(eq(foods.id, existing.id));
        updated++;
      } else {
        await db.insert(foods).values(values);
        inserted++;
      }
    }
  });
  console.log(`seed foods: ${inserted} inserted, ${updated} updated`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
