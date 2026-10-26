import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/** 資料庫連不上（Supabase 被暫停、網路問題、逾時）時拋出 */
export class DbUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Database unavailable", { cause });
    this.name = "DbUnavailableError";
  }
}

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "57014", // query_canceled（statement_timeout）
]);

export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  if (code && (CONNECTION_ERROR_CODES.has(code) || code.startsWith("08"))) return true;
  // Supabase 專案暫停後，pooler 會回這個訊息
  if (/tenant or user not found/i.test(err.message)) return true;
  return err.cause !== undefined && isConnectionError(err.cause);
}

let instance: { db: Db; sql: postgres.Sql } | undefined;

function getInstance() {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new DbUnavailableError(new Error("DATABASE_URL is not set"));
    const sql = postgres(url, {
      max: 3,
      connect_timeout: 5,
      idle_timeout: 20,
      // Supabase transaction pooler 不支援 prepared statements
      prepare: false,
      connection: { statement_timeout: 5000 },
    });
    instance = { db: drizzle(sql, { schema }), sql };
  }
  return instance;
}

/**
 * 所有 DB 存取都包在這裡：連線類錯誤轉成 DbUnavailableError，
 * 讓 webhook 和 API 可以統一回「暫時無法使用」而不是整個掛掉。
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  try {
    return await fn(getInstance().db);
  } catch (err) {
    if (err instanceof DbUnavailableError) throw err;
    if (isConnectionError(err)) throw new DbUnavailableError(err);
    throw err;
  }
}

/** 真正打一次 DB，keepalive cron 和健康檢查用 */
export async function pingDb(): Promise<void> {
  await withDb(async () => {
    await getInstance().sql`select 1`;
  });
}

/** 腳本結束時關閉連線 */
export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.sql.end({ timeout: 5 });
    instance = undefined;
  }
}
