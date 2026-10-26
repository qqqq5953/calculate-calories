import type { MealType } from "@/lib/db/schema";

export const DEFAULT_TZ = "Asia/Taipei";

/** 取得某時間點在指定時區的各個欄位 */
export function zonedParts(date: Date, timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** YYYY-MM-DD（使用者時區） */
export function localDate(date: Date, timeZone = DEFAULT_TZ): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** 依當地時間判斷餐別 */
export function mealTypeAt(date: Date, timeZone = DEFAULT_TZ): MealType {
  const { hour } = zonedParts(date, timeZone);
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 14) return "lunch";
  if (hour >= 17 && hour < 21) return "dinner";
  return "snack";
}

/** 時區相對 UTC 的偏移（分鐘），例如台北為 +480 */
function offsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** 某個當地日期（YYYY-MM-DD）的 [開始, 隔天開始) UTC 時間 */
export function dayRange(date: string, timeZone = DEFAULT_TZ): [Date, Date] {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
  const nextGuess = new Date(Date.UTC(y, m - 1, d + 1));
  const end = new Date(nextGuess.getTime() - offsetMinutes(nextGuess, timeZone) * 60000);
  return [start, end];
}

/** 把使用者時區的當地時間（YYYY-MM-DDTHH:mm，例如 datetimepicker 的回傳值）轉成 Date */
export function zonedToUtc(local: string, timeZone = DEFAULT_TZ): Date {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error(`invalid local datetime: ${local}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
}

/** 從 date（含）往前 n 天的日期字串清單，舊到新 */
export function lastNDates(n: number, today: string): string[] {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d - (n - 1 - i)));
    return dt.toISOString().slice(0, 10);
  });
}

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "點心",
};

export const MEAL_TYPE_EMOJI: Record<MealType, string> = {
  breakfast: "🍳",
  lunch: "🍱",
  dinner: "🍲",
  snack: "🍪",
};

/** 10/26 12:30（使用者時區） */
export function formatShort(date: Date, timeZone = DEFAULT_TZ): string {
  const p = zonedParts(date, timeZone);
  return `${p.month}/${p.day} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
