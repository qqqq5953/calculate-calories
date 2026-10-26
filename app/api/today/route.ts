import { api, requireUser } from "@/lib/api";
import { mealsOnDate } from "@/lib/db/queries/meals";
import { sumNutrients } from "@/lib/nutrition/calc";
import { localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = api(async (req: Request) => {
  const user = await requireUser();
  const param = new URL(req.url).searchParams.get("date");
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : localDate(new Date(), user.timezone);
  const views = await mealsOnDate(user.id, date, user.timezone);
  const meals = views.map(({ meal, items }) => ({
    id: meal.id,
    mealType: meal.mealType,
    eatenAt: meal.eatenAt.toISOString(),
    totals: sumNutrients(items),
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      portion: i.portion,
      unit: i.unit,
      kcal: i.kcal,
      proteinG: i.proteinG,
      carbG: i.carbG,
      fatG: i.fatG,
      confidence: i.confidence,
    })),
  }));
  return Response.json({
    date,
    totals: sumNutrients(meals.map((m) => m.totals)),
    targets: { kcal: user.targetKcal, proteinG: user.targetProteinG, carbG: user.targetCarbG, fatG: user.targetFatG },
    meals,
  });
});
