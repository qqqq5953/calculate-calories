/**
 * 匯入食藥署「食品營養成分資料集」。
 *
 * 1. 到 政府資料開放平臺（data.gov.tw）搜尋「食品營養成分資料集」下載 CSV
 * 2. 放到 data/tfda/foods.csv（或用參數指定路徑）
 * 3. DATABASE_URL=... npx tsx scripts/import-tfda.ts [path/to/file.csv]
 *
 * 以「整合編號」為鍵，可以重複執行（更新既有資料）。找不到檔案時會略過，不視為錯誤。
 */
import { existsSync, readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import { closeDb, withDb } from "@/lib/db/client";
import { foods } from "@/lib/db/schema";
import { parseTfdaRows } from "@/lib/nutrition/tfda";

const BATCH = 500;

async function main() {
  const path = process.argv[2] ?? "data/tfda/foods.csv";
  if (!existsSync(path)) {
    console.log(`找不到 ${path}，略過食藥署資料匯入（只使用內建的常見餐點）。`);
    return;
  }
  const rows = parse(readFileSync(path), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  const parsed = parseTfdaRows(rows);
  console.log(`讀取 ${rows.length} 列，解析出 ${parsed.length} 種食物`);

  await withDb(async (db) => {
    for (let i = 0; i < parsed.length; i += BATCH) {
      const chunk = parsed.slice(i, i + BATCH).map((f) => ({
        source: "tfda" as const,
        tfdaCode: f.code,
        name: f.name,
        aliases: f.aliases,
        category: f.category,
        kcal100g: f.kcal,
        protein100g: f.protein,
        carb100g: f.carb,
        fat100g: f.fat,
      }));
      await db
        .insert(foods)
        .values(chunk)
        .onConflictDoUpdate({
          target: foods.tfdaCode,
          set: {
            name: sql`excluded.name`,
            aliases: sql`excluded.aliases`,
            category: sql`excluded.category`,
            kcal100g: sql`excluded.kcal_100g`,
            protein100g: sql`excluded.protein_100g`,
            carb100g: sql`excluded.carb_100g`,
            fat100g: sql`excluded.fat_100g`,
          },
        });
    }
  });
  console.log("食藥署資料匯入完成");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
