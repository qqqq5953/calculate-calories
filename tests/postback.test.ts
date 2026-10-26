import { describe, expect, it } from "vitest";
import { decodePostback, encodePostback, type Postback } from "@/lib/line/postback";

describe("postback codec", () => {
  const cases: Postback[] = [
    { a: "item", m: "abcdefghijkl", i: "mnopqrstuvwx", v: 3 },
    { a: "qty", i: "mnopqrstuvwx", q: 0.67 },
    { a: "swap", i: "mnopqrstuvwx", n: "滷蛋" },
    { a: "add_cat", m: "abcdefghijkl", c: "meat" },
    { a: "meal_type", m: "abcdefghijkl", t: "dinner" },
    { a: "today" },
  ];

  it.each(cases)("round-trips %j", (p) => {
    const s = encodePostback(p);
    expect(s.length).toBeLessThan(300);
    expect(decodePostback(s)).toEqual(p);
  });

  it("rejects unknown action and bad numbers", () => {
    expect(decodePostback("a=hack")).toBeUndefined();
    expect(decodePostback("")).toBeUndefined();
    expect(decodePostback("a=qty&i=x&q=abc")).toBeUndefined();
  });

  it("throws when too long", () => {
    expect(() => encodePostback({ a: "swap", i: "x", n: "很".repeat(200) })).toThrow();
  });
});
