import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { mapCategory, parseTfdaRows } from "@/lib/nutrition/tfda";

describe("parseTfdaRows", () => {
  it("parses long format, prefers 修正熱量, skips rows without kcal", () => {
    const rows: Record<string, string>[] = parse(readFileSync("tests/fixtures/tfda-long.csv"), { columns: true, bom: true });
    const foods = parseTfdaRows(rows);
    expect(foods).toHaveLength(2);
    expect(foods[0]).toEqual({
      code: "A0101",
      name: "白米飯",
      aliases: ["飯", "白飯"],
      category: "staple",
      kcal: 182,
      protein: 3.1,
      carb: 41,
      fat: 0.3,
    });
    expect(foods[1]).toMatchObject({ code: "B0202", category: "meat", kcal: 120, protein: 20.1, fat: 0 });
  });

  it("parses wide format with unit suffixes", () => {
    const foods = parseTfdaRows([
      { 整合編號: "X1", 樣品名稱: "豆漿", "修正熱量(kcal)": "35", "粗蛋白(g)": "3.5", "粗脂肪(g)": "1.8", "總碳水化合物(g)": "1.5", 食品分類: "豆類" },
    ]);
    expect(foods[0]).toMatchObject({ name: "豆漿", kcal: 35, protein: 3.5, fat: 1.8, carb: 1.5, category: "egg_bean" });
  });

  it("throws a readable error when columns are missing", () => {
    expect(() => parseTfdaRows([{ foo: "1" }])).toThrow(/找不到編號或名稱欄位/);
  });

  it("maps categories", () => {
    expect(mapCategory("魚貝類")).toBe("seafood");
    expect(mapCategory("加工調理食品及其他類")).toBe("other");
  });
});
