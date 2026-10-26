import { eq } from "drizzle-orm";
import { withDb } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";

export function getUserByLineId(lineUserId: string): Promise<User | undefined> {
  return withDb(async (db) => {
    const [u] = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
    return u;
  });
}

export function getOrCreateUser(lineUserId: string, displayName?: string): Promise<User> {
  return withDb(async (db) => {
    const [existing] = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({ lineUserId, displayName })
      .onConflictDoUpdate({ target: users.lineUserId, set: { lineUserId } })
      .returning();
    return created;
  });
}

export type ProfileUpdate = Partial<
  Pick<
    User,
    | "displayName"
    | "sex"
    | "birthYear"
    | "heightCm"
    | "weightKg"
    | "activityLevel"
    | "goal"
    | "targetKcal"
    | "targetProteinG"
    | "targetCarbG"
    | "targetFatG"
  >
>;

export function updateUser(userId: string, patch: ProfileUpdate): Promise<User> {
  return withDb(async (db) => {
    const [u] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
    return u;
  });
}
