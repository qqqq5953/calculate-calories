import type { DailyTotal } from "@/lib/db/queries/meals";
import { macroPercents } from "./calc";

export type TrendDay = {
  date: string;
  logged: boolean;
  kcal: number;
  /** kcal − 目標；負數為赤字 */
  diff: number;
  proteinG: number;
  proteinMet: boolean;
  carbPct: number;
  proteinPct: number;
  fatPct: number;
};

export type TrendSummary = {
  loggedDays: number;
  deficitDays: number;
  surplusDays: number;
  avgDiff: number;
  avgKcal: number;
  proteinMetDays: number;
  avgProteinG: number;
  macroPct: { carb: number; protein: number; fat: number };
};

/** 沒有紀錄的日子不算赤字也不算盈餘（可能只是忘了記） */
export function buildTrend(
  dates: string[],
  totals: DailyTotal[],
  target: { kcal: number; proteinG: number },
): { days: TrendDay[]; summary: TrendSummary } {
  const byDate = new Map(totals.map((t) => [t.date, t]));
  const days = dates.map((date): TrendDay => {
    const t = byDate.get(date);
    if (!t || t.kcal <= 0) {
      return { date, logged: false, kcal: 0, diff: 0, proteinG: 0, proteinMet: false, carbPct: 0, proteinPct: 0, fatPct: 0 };
    }
    const pct = macroPercents(t);
    return {
      date,
      logged: true,
      kcal: t.kcal,
      diff: t.kcal - target.kcal,
      proteinG: t.proteinG,
      proteinMet: t.proteinG >= target.proteinG,
      carbPct: pct.carb,
      proteinPct: pct.protein,
      fatPct: pct.fat,
    };
  });

  const logged = days.filter((d) => d.logged);
  const n = logged.length;
  const sum = (f: (d: TrendDay) => number) => logged.reduce((s, d) => s + f(d), 0);
  const loggedTotals = totals.filter((t) => byDate.get(t.date) && t.kcal > 0 && dates.includes(t.date));

  return {
    days,
    summary: {
      loggedDays: n,
      deficitDays: logged.filter((d) => d.diff < 0).length,
      surplusDays: logged.filter((d) => d.diff > 0).length,
      avgDiff: n ? Math.round(sum((d) => d.diff) / n) : 0,
      avgKcal: n ? Math.round(sum((d) => d.kcal) / n) : 0,
      proteinMetDays: logged.filter((d) => d.proteinMet).length,
      avgProteinG: n ? Math.round(sum((d) => d.proteinG) / n) : 0,
      macroPct: macroPercents({
        carbG: loggedTotals.reduce((s, t) => s + t.carbG, 0),
        proteinG: loggedTotals.reduce((s, t) => s + t.proteinG, 0),
        fatG: loggedTotals.reduce((s, t) => s + t.fatG, 0),
      }),
    },
  };
}
