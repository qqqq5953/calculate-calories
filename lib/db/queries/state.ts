import { and, eq, gt } from "drizzle-orm";
import { withDb } from "@/lib/db/client";
import {
  conversationStates,
  type ConversationPayload,
  type ConversationStateName,
} from "@/lib/db/schema";

const TTL_MS = 10 * 60 * 1000;

export function setState(userId: string, state: ConversationStateName, payload: ConversationPayload) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  return withDb(async (db) => {
    await db
      .insert(conversationStates)
      .values({ userId, state, payload, expiresAt })
      .onConflictDoUpdate({ target: conversationStates.userId, set: { state, payload, expiresAt } });
  });
}

export function getState(userId: string) {
  return withDb(async (db) => {
    const [s] = await db
      .select()
      .from(conversationStates)
      .where(and(eq(conversationStates.userId, userId), gt(conversationStates.expiresAt, new Date())))
      .limit(1);
    return s;
  });
}

export function clearState(userId: string) {
  return withDb(async (db) => {
    await db.delete(conversationStates).where(eq(conversationStates.userId, userId));
  });
}
