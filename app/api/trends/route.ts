import { api, requireUser } from "@/lib/api";
import { dailyTotals } from "@/lib/db/queries/meals";
import { buildTrend } from "@/lib/nutrition/trends";
import { lastNDates, localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = api(async (req: Request) => {
  const user = await requireUser();
  const days = new URL(req.url).searchParams.get("days") === "30" ? 30 : 7;
  const today = localDate(new Date(), user.timezone);
  const dates = lastNDates(days, today);
  const totals = await dailyTotals(user.id, dates[0], today, user.timezone);
  const trend = buildTrend(dates, totals, { kcal: user.targetKcal, proteinG: user.targetProteinG });
  return Response.json({
    range: days,
    target: { kcal: user.targetKcal, proteinG: user.targetProteinG },
    ...trend,
  });
});
