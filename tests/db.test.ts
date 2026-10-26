import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DbUnavailableError, isConnectionError, pingDb, withDb } from "@/lib/db/client";

describe("isConnectionError", () => {
  const withCode = (code: string) => Object.assign(new Error("x"), { code });

  it.each(["ECONNREFUSED", "ENOTFOUND", "CONNECT_TIMEOUT", "08006", "57P03"])("detects %s", (code) => {
    expect(isConnectionError(withCode(code))).toBe(true);
  });

  it("detects paused Supabase pooler message", () => {
    expect(isConnectionError(new Error("Tenant or user not found"))).toBe(true);
  });

  it("detects nested cause", () => {
    expect(isConnectionError(new Error("wrapped", { cause: withCode("ECONNRESET") }))).toBe(true);
  });

  it("ignores query errors", () => {
    expect(isConnectionError(withCode("23505"))).toBe(false); // unique_violation
    expect(isConnectionError("nope")).toBe(false);
  });
});

describe("withDb against an unreachable database", () => {
  const original = process.env.DATABASE_URL;
  beforeAll(() => {
    // port 1 不會有 Postgres：模擬 Supabase 暫停或網路斷線
    process.env.DATABASE_URL = "postgres://u:p@127.0.0.1:1/db";
  });
  afterAll(() => {
    process.env.DATABASE_URL = original;
  });

  it("throws DbUnavailableError instead of crashing", async () => {
    await expect(pingDb()).rejects.toBeInstanceOf(DbUnavailableError);
  });

  it("passes through non-connection errors", async () => {
    await expect(
      withDb(async () => {
        throw new TypeError("bug");
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
