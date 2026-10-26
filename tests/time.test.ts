import { describe, expect, it } from "vitest";
import { dayRange, formatShort, lastNDates, localDate, mealTypeAt, zonedToUtc } from "@/lib/time";

describe("time helpers (Asia/Taipei)", () => {
  it("localDate crosses midnight correctly", () => {
    // UTC 16:30 = 台北隔天 00:30
    expect(localDate(new Date("2026-10-25T16:30:00Z"))).toBe("2026-10-26");
    expect(localDate(new Date("2026-10-25T15:30:00Z"))).toBe("2026-10-25");
  });

  it("mealTypeAt", () => {
    expect(mealTypeAt(new Date("2026-10-26T00:00:00Z"))).toBe("breakfast"); // 08:00
    expect(mealTypeAt(new Date("2026-10-26T04:30:00Z"))).toBe("lunch"); // 12:30
    expect(mealTypeAt(new Date("2026-10-26T07:00:00Z"))).toBe("snack"); // 15:00
    expect(mealTypeAt(new Date("2026-10-26T11:00:00Z"))).toBe("dinner"); // 19:00
    expect(mealTypeAt(new Date("2026-10-26T15:00:00Z"))).toBe("snack"); // 23:00
  });

  it("dayRange", () => {
    const [s, e] = dayRange("2026-10-26");
    expect(s.toISOString()).toBe("2026-10-25T16:00:00.000Z");
    expect(e.toISOString()).toBe("2026-10-26T16:00:00.000Z");
  });

  it("lastNDates spans months", () => {
    expect(lastNDates(3, "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("zonedToUtc", () => {
    expect(zonedToUtc("2026-10-26T12:30").toISOString()).toBe("2026-10-26T04:30:00.000Z");
  });

  it("formatShort", () => {
    expect(formatShort(new Date("2026-10-26T04:30:00Z"))).toBe("10/26 12:30");
  });
});
