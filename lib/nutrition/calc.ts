export type Per100g = { kcal: number; protein: number; carb: number; fat: number };
export type Nutrients = { kcal: number; proteinG: number; carbG: number; fatG: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 依份量和每單位克數，算出一道菜的克數與營養 */
export function computeItem(portion: number, unitGrams: number, per100g: Per100g) {
  const grams = portion * unitGrams;
  const f = grams / 100;
  return {
    grams: round1(grams),
    kcal: Math.round(per100g.kcal * f),
    proteinG: round1(per100g.protein * f),
    carbG: round1(per100g.carb * f),
    fatG: round1(per100g.fat * f),
  };
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  const total = items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      proteinG: acc.proteinG + i.proteinG,
      carbG: acc.carbG + i.carbG,
      fatG: acc.fatG + i.fatG,
    }),
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );
  return {
    kcal: Math.round(total.kcal),
    proteinG: round1(total.proteinG),
    carbG: round1(total.carbG),
    fatG: round1(total.fatG),
  };
}

/** 三大營養素佔熱量的百分比（碳水、蛋白質 4 kcal/g，脂肪 9 kcal/g），合計為 100 */
export function macroPercents(n: Pick<Nutrients, "proteinG" | "carbG" | "fatG">) {
  const carb = n.carbG * 4;
  const protein = n.proteinG * 4;
  const fat = n.fatG * 9;
  const total = carb + protein + fat;
  if (total <= 0) return { carb: 0, protein: 0, fat: 0 };
  const c = Math.round((carb / total) * 100);
  const p = Math.round((protein / total) * 100);
  return { carb: c, protein: p, fat: 100 - c - p };
}
