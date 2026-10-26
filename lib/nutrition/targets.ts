import type { ActivityLevel, Goal } from "@/lib/db/schema";

export type Profile = {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
};

export type Targets = { kcal: number; proteinG: number; carbG: number; fatG: number };

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_FACTOR: Record<Goal, number> = { lose: 0.85, maintain: 1, gain: 1.1 };
const PROTEIN_PER_KG: Record<Goal, number> = { lose: 1.6, maintain: 1.2, gain: 1.6 };
const FAT_RATIO = 0.27;

/** Mifflin-St Jeor */
export function bmr(p: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTOR[p.activityLevel];
}

export function computeTargets(p: Profile): Targets {
  const kcal = Math.round(tdee(p) * GOAL_FACTOR[p.goal]);
  const proteinG = Math.round(p.weightKg * PROTEIN_PER_KG[p.goal]);
  const fatG = Math.round((kcal * FAT_RATIO) / 9);
  const carbG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, proteinG, carbG, fatG };
}
