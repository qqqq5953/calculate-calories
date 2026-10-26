import type { FoodCategory, MealType } from "@/lib/db/schema";

/**
 * postback data 的型別定義。用簡短的 query string 編碼（LINE 上限 300 字元）。
 * a = action，m = mealId，i = itemId，f = foodId，v = meal version
 */
export type Postback =
  | { a: "item"; m: string; i: string; v: number } // 點卡片某一列
  | { a: "qty"; i: string; q: number } // 設定份量
  | { a: "qty_menu"; i: string } // 打開份量選單（低信心項目用）
  | { a: "qty_other"; i: string } // 其他份量 → 等待輸入
  | { a: "swap"; i: string; f?: string; n?: string } // 換成候選（有 foodId 或只有名稱）
  | { a: "swap_other"; i: string } // 都不是 → 等待輸入食物名稱
  | { a: "del_item"; i: string }
  | { a: "add"; m: string } // 新增食物選單
  | { a: "add_cat"; m: string; c: FoodCategory }
  | { a: "add_food"; m: string; f?: string; n?: string }
  | { a: "add_other"; m: string } // 新增 → 等待輸入食物名稱
  | { a: "more"; m: string } // ⋯ 更多
  | { a: "meal_type"; m: string; t: MealType }
  | { a: "meal_time"; m: string } // datetimepicker 回傳
  | { a: "del_meal"; m: string }
  | { a: "undo_del_meal"; m: string }
  | { a: "show_meal"; m: string }
  | { a: "record" } // Rich Menu：記錄一餐
  | { a: "today" }; // Rich Menu：今日摘要

export const POSTBACK_MAX_LENGTH = 300;

const NUMERIC_KEYS = new Set(["v", "q"]);

export function encodePostback(p: Postback): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const s = params.toString();
  if (s.length > POSTBACK_MAX_LENGTH) {
    throw new Error(`postback data too long (${s.length}): ${s.slice(0, 50)}…`);
  }
  return s;
}

const ACTIONS = new Set<Postback["a"]>([
  "item", "qty", "qty_menu", "qty_other", "swap", "swap_other", "del_item", "add",
  "add_cat", "add_food", "add_other", "more", "meal_type", "meal_time", "del_meal",
  "undo_del_meal", "show_meal", "record", "today",
]);

/** 解析失敗回傳 undefined（例如舊版格式或被竄改的資料） */
export function decodePostback(data: string): Postback | undefined {
  const params = new URLSearchParams(data);
  const a = params.get("a");
  if (!a || !ACTIONS.has(a as Postback["a"])) return undefined;
  const obj: Record<string, string | number> = {};
  for (const [k, v] of params) {
    if (NUMERIC_KEYS.has(k)) {
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      obj[k] = n;
    } else {
      obj[k] = v;
    }
  }
  return obj as unknown as Postback;
}
