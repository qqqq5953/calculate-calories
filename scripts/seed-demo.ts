/**
 * 本機開發用：替測試使用者（預設 Udev-local）塞 30 天的示範紀錄，方便看儀表板和跑 e2e 測試。
 * 用法：DATABASE_URL=... npx tsx scripts/seed-demo.ts
 */
import { closeDb } from "@/lib/db/client";
import { matchFood } from "@/lib/db/queries/foods";
import { createMeal } from "@/lib/db/queries/meals";
import { getOrCreateUser, updateUser } from "@/lib/db/queries/users";
import { resolveItem } from "@/lib/nutrition/resolve";

const menu: [string, number, string][][] = [
  [["白飯", 1, "碗"], ["滷雞腿", 1, "支"], ["滷豆干", 2, "塊"], ["炒高麗菜", 1, "份"]],
  [["蛋餅", 1, "份"], ["無糖豆漿", 1, "杯"]],
  [["牛肉麵", 1, "碗"], ["燙青菜", 1, "份"]],
  [["炸雞排", 1, "片"], ["珍珠奶茶", 1, "杯"]],
  [["五穀飯", 1, "碗"], ["烤鮭魚", 1, "塊"], ["炒青菜", 1, "份"], ["滷蛋", 1, "顆"]],
];

async function main() {
  const user = await getOrCreateUser("Udev-local", "開發者");
  await updateUser(user.id, { sex: "female", birthYear: 1994, heightCm: 162, weightKg: 58, activityLevel: "light", goal: "lose", targetKcal: 1580, targetProteinG: 93, targetCarbG: 178, targetFatG: 47 });
  const now = Date.now();
  for (let day = 29; day >= 0; day--) {
    if (day % 6 === 4) continue; // 留幾天沒記錄
    const meals = day === 0 ? [menu[1], menu[0]] : [menu[(day) % 5], menu[(day + 2) % 5], ...(day % 3 === 0 ? [menu[3]] : [])];
    for (const [idx, m] of meals.entries()) {
      const eatenAt = new Date(now - day * 86400000 - (meals.length - idx) * 4 * 3600000);
      const items = [];
      for (const [name, portion, unit] of m) {
        const f = await matchFood(name);
        items.push(resolveItem({ name, portion, unit, grams_per_unit: 100, confidence: name === "滷豆干" ? "low" : "high", alternatives: name === "滷豆干" ? ["滷蛋", "油豆腐"] : [], category: "other", est_per_100g: { kcal: 100, protein: 5, carb: 10, fat: 3 } }, f));
      }
      await createMeal(user.id, { eatenAt, mealType: idx === 0 ? "breakfast" : idx === 1 ? "lunch" : "dinner", source: "photo" }, items);
    }
  }
  console.log("demo data ok");
}
if (process.env.NODE_ENV === "production") {
  console.error("seed-demo 只能在開發環境使用");
  process.exit(1);
}
main().finally(closeDb);
