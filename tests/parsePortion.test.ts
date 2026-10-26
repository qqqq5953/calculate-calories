import { describe, expect, it } from "vitest";
import { formatPortion, parsePortion } from "@/lib/nutrition/parsePortion";

describe("parsePortion", () => {
  it.each([
    ["0.7", 0.7],
    [".5", 0.5],
    ["2/3", 0.67],
    ["2／3", 0.67],
    ["1 1/2", 1.5],
    ["70%", 0.7],
    ["⅔", 0.67],
    ["1½", 1.5],
    ["半", 0.5],
    ["半碗", 0.5],
    ["一碗半", 1.5],
    ["三分之二", 0.67],
    ["2碗", 2],
    ["２", 2],
    ["兩", 2],
    ["十二", 12],
  ])("%s → %s", (input, expected) => {
    expect(parsePortion(input)).toBe(expected);
  });

  it.each(["", "abc", "0", "-1", "1/0", "100", "很多", "好吃"])("rejects %j", (input) => {
    expect(parsePortion(input)).toBeUndefined();
  });
});

describe("formatPortion", () => {
  it.each([
    [1, "1"],
    [0.5, "½"],
    [0.67, "⅔"],
    [1.5, "1½"],
    [0.33, "⅓"],
    [0.7, "0.7"],
    [2, "2"],
  ])("%s → %s", (input, expected) => {
    expect(formatPortion(input)).toBe(expected);
  });
});
