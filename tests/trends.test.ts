import { describe, expect, it } from "vitest";
import { buildTrend } from "@/lib/nutrition/trends";

describe("buildTrend", () => {
  const dates = ["2026-10-24", "2026-10-25", "2026-10-26"];
  const totals = [
    { date: "2026-10-24", kcal: 1500, proteinG: 110, carbG: 150, fatG: 50 },
    { date: "2026-10-26", kcal: 2300, proteinG: 80, carbG: 300, fatG: 80 },
  ];
  const { days, summary } = buildTrend(dates, totals, { kcal: 1800, proteinG: 100 });

  it("fills unlogged days without counting them", () => {
    expect(days.map((d) => d.logged)).toEqual([true, false, true]);
    expect(summary.loggedDays).toBe(2);
  });

  it("counts deficit and surplus days", () => {
    expect(days[0].diff).toBe(-300);
    expect(days[2].diff).toBe(500);
    expect(summary.deficitDays).toBe(1);
    expect(summary.surplusDays).toBe(1);
    expect(summary.avgDiff).toBe(100);
    expect(summary.avgKcal).toBe(1900);
  });

  it("tracks protein target", () => {
    expect(summary.proteinMetDays).toBe(1);
    expect(summary.avgProteinG).toBe(95);
  });

  it("macro percents add to 100", () => {
    const p = summary.macroPct;
    expect(p.carb + p.protein + p.fat).toBe(100);
  });
});
