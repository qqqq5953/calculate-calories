import { z } from "zod/v4";
import { api, HttpError, readJson, requireUser } from "@/lib/api";
import { updateUser } from "@/lib/db/queries/users";
import type { User } from "@/lib/db/schema";
import { computeTargets } from "@/lib/nutrition/targets";

function toProfile(u: User) {
  return {
    displayName: u.displayName,
    sex: u.sex,
    birthYear: u.birthYear,
    heightCm: u.heightCm,
    weightKg: u.weightKg,
    activityLevel: u.activityLevel,
    goal: u.goal,
    targets: { kcal: u.targetKcal, proteinG: u.targetProteinG, carbG: u.targetCarbG, fatG: u.targetFatG },
  };
}

export const GET = api(async () => Response.json(toProfile(await requireUser())));

const thisYear = new Date().getFullYear();
const updateSchema = z.object({
  sex: z.enum(["male", "female"]),
  birthYear: z.number().int().min(thisYear - 110).max(thisYear - 5),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(20).max(300),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  // 有填就用手動目標，沒填就自動計算
  targets: z
    .object({
      kcal: z.number().int().min(800).max(6000),
      proteinG: z.number().int().min(0).max(400),
      carbG: z.number().int().min(0).max(1000),
      fatG: z.number().int().min(0).max(400),
    })
    .nullable()
    .optional(),
});

export const PUT = api(async (req: Request) => {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "bad_request");
  const p = parsed.data;
  const targets =
    p.targets ??
    computeTargets({
      sex: p.sex,
      age: thisYear - p.birthYear,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      activityLevel: p.activityLevel,
      goal: p.goal,
    });
  const updated = await updateUser(user.id, {
    sex: p.sex,
    birthYear: p.birthYear,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    activityLevel: p.activityLevel,
    goal: p.goal,
    targetKcal: targets.kcal,
    targetProteinG: targets.proteinG,
    targetCarbG: targets.carbG,
    targetFatG: targets.fatG,
  });
  return Response.json(toProfile(updated));
});
