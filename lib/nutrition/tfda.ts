import type { FoodCategory } from "@/lib/db/schema";

/**
 * 解析食藥署「食品營養成分資料集」CSV。
 *
 * 官方檔案是「長格式」：每一列是一個食品的一個分析項，例如
 *   整合編號, 食品分類, 樣品名稱, 俗名, 分析項分類, 分析項, 含量單位, 每100克含量, ...
 * 也支援「寬格式」（每列一個食品，熱量／粗蛋白／粗脂肪／總碳水化合物各一欄）。
 * 欄位名稱用關鍵字比對，容許「修正熱量(kcal)」這類帶單位的寫法。
 */
export type TfdaFood = {
  code: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

type Row = Record<string, string>;

const NUTRIENT_KEYS = {
  kcal: ["修正熱量", "熱量"],
  protein: ["粗蛋白", "蛋白質"],
  fat: ["粗脂肪", "脂肪"],
  carb: ["總碳水化合物", "碳水化合物"],
} as const;

type NutrientKey = keyof typeof NUTRIENT_KEYS;

const CATEGORY_RULES: [RegExp, FoodCategory][] = [
  [/穀物|澱粉/, "staple"],
  [/肉類/, "meat"],
  [/魚貝|海鮮/, "seafood"],
  [/蛋類|豆類/, "egg_bean"],
  [/蔬菜|菇類|藻類/, "veg"],
  [/水果/, "fruit"],
  [/飲料|乳品/, "drink"],
  [/糕餅|點心|零食|糖/, "snack"],
];

export function mapCategory(raw: string): FoodCategory {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(raw)) return cat;
  return "other";
}

const stripUnit = (h: string) => h.replace(/[（(].*?[)）]/g, "").trim();

function findColumn(headers: string[], ...candidates: string[]): string | undefined {
  const cleaned = headers.map((h) => [h, stripUnit(h)] as const);
  for (const c of candidates) {
    const exact = cleaned.find(([, s]) => s === c);
    if (exact) return exact[0];
  }
  for (const c of candidates) {
    const partial = cleaned.find(([, s]) => s.includes(c));
    if (partial) return partial[0];
  }
  return undefined;
}

function toNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function splitAliases(v: string | undefined, name: string): string[] {
  if (!v) return [];
  return [...new Set(v.split(/[、,，;；/]/).map((s) => s.trim()).filter((s) => s && s !== name))];
}

function nutrientOf(analysisName: string): NutrientKey | undefined {
  const n = stripUnit(analysisName);
  for (const key of Object.keys(NUTRIENT_KEYS) as NutrientKey[]) {
    if ((NUTRIENT_KEYS[key] as readonly string[]).includes(n)) return key;
  }
  return undefined;
}

export function parseTfdaRows(rows: Row[]): TfdaFood[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const codeCol = findColumn(headers, "整合編號", "食品編號", "編號");
  const nameCol = findColumn(headers, "樣品名稱", "食品名稱", "名稱");
  const aliasCol = findColumn(headers, "俗名");
  const catCol = findColumn(headers, "食品分類", "分類");
  if (!codeCol || !nameCol) {
    throw new Error(`找不到編號或名稱欄位，CSV 欄位為：${headers.join(", ")}`);
  }

  const itemCol = findColumn(headers, "分析項");
  const valueCol = findColumn(headers, "每100克含量", "每100g含量", "含量");
  const isLong = Boolean(itemCol && valueCol);

  const byCode = new Map<string, Partial<TfdaFood> & { kcalSource?: string }>();

  for (const r of rows) {
    const code = r[codeCol]?.trim();
    const name = r[nameCol]?.trim();
    if (!code || !name) continue;
    const food = byCode.get(code) ?? {
      code,
      name,
      aliases: splitAliases(aliasCol ? r[aliasCol] : undefined, name),
      category: mapCategory(catCol ? (r[catCol] ?? "") : ""),
    };

    if (isLong) {
      const item = r[itemCol!] ?? "";
      const key = nutrientOf(item);
      const value = toNum(r[valueCol!]);
      if (key && value !== undefined) {
        // 熱量優先用「修正熱量」
        if (key === "kcal") {
          const isCorrected = stripUnit(item) === "修正熱量";
          if (food.kcal === undefined || isCorrected) food.kcal = value;
        } else {
          food[key] = value;
        }
      }
    } else {
      for (const key of Object.keys(NUTRIENT_KEYS) as NutrientKey[]) {
        const col = findColumn(headers, ...NUTRIENT_KEYS[key]);
        const value = col ? toNum(r[col]) : undefined;
        if (value !== undefined) food[key] = value;
      }
    }
    byCode.set(code, food);
  }

  return [...byCode.values()]
    .filter((f): f is TfdaFood => f.kcal !== undefined)
    .map((f) => ({
      code: f.code,
      name: f.name,
      aliases: f.aliases,
      category: f.category,
      kcal: f.kcal,
      protein: f.protein ?? 0,
      carb: f.carb ?? 0,
      fat: f.fat ?? 0,
    }));
}
