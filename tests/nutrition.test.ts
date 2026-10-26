import { describe, expect, it } from "vitest";
import { computeItem, macroPercents, sumNutrients } from "@/lib/nutrition/calc";
import { bmr, computeTargets, tdee } from "@/lib/nutrition/targets";

describe("computeItem", () => {
  it("白飯 1 碗 200g", () => {
    const r = computeItem(1, 200, { kcal: 183, protein: 3.1, carb: 41, fat: 0.3 });
    expect(r).toEqual({ grams: 200, kcal: 366, proteinG: 6.2, carbG: 82, fatG: 0.6 });
  });

  it("scales with portion", () => {
    const r = computeItem(0.5, 200, { kcal: 100, protein: 10, carb: 10, fat: 10 });
    expect(r.kcal).toBe(100);
    expect(r.grams).toBe(100);
  });
});

describe("sumNutrients / macroPercents", () => {
  it("sums and splits to 100%", () => {
    const total = sumNutrients([
      { kcal: 300, proteinG: 10, carbG: 50, fatG: 5 },
      { kcal: 200, proteinG: 20, carbG: 0, fatG: 12 },
    ]);
    expect(total).toEqual({ kcal: 500, proteinG: 30, carbG: 50, fatG: 17 });
    const p = macroPercents(total);
    expect(p.carb + p.protein + p.fat).toBe(100);
    expect(p).toEqual({ carb: 42, protein: 25, fat: 33 });
  });

  it("handles empty", () => {
    expect(macroPercents({ proteinG: 0, carbG: 0, fatG: 0 })).toEqual({ carb: 0, protein: 0, fat: 0 });
  });
});

describe("targets", () => {
  const profile = {
    sex: "male" as const,
    age: 30,
    heightCm: 170,
    weightKg: 70,
    activityLevel: "moderate" as const,
    goal: "maintain" as const,
  };

  it("Mifflin-St Jeor BMR", () => {
    expect(bmr(profile)).toBe(1617.5);
    expect(bmr({ ...profile, sex: "female" })).toBe(1451.5);
  });

  it("TDEE", () => {
    expect(Math.round(tdee(profile))).toBe(2507);
  });

  it("targets add up to kcal", () => {
    const t = computeTargets(profile);
    expect(t.kcal).toBe(2507);
    expect(t.proteinG).toBe(84);
    const fromMacros = t.proteinG * 4 + t.carbG * 4 + t.fatG * 9;
    expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(10);
  });

  it("lose goal is a 15% deficit with higher protein", () => {
    const t = computeTargets({ ...profile, goal: "lose" });
    expect(t.kcal).toBe(Math.round(2507.125 * 0.85));
    expect(t.proteinG).toBe(112);
  });
});
