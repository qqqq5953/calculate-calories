export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export const MEAL_LABEL: Record<string, string> = {
  breakfast: "🍳 早餐",
  lunch: "🍱 午餐",
  dinner: "🍲 晚餐",
  snack: "🍪 點心",
};

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  });
}
