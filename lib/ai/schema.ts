import { z } from "zod/v4";

const per100g = z.object({
  kcal: z.number(),
  protein: z.number(),
  carb: z.number(),
  fat: z.number(),
});

export const recognizedItemSchema = z.object({
  name: z.string().describe("台灣常用的繁體中文食物名稱，例如「滷雞腿」「炒高麗菜」"),
  portion: z.number().describe("份量數字，以 unit 為單位"),
  unit: z.string().describe("份量單位：碗、支、塊、片、顆、份、杯、盤、條"),
  grams_per_unit: z.number().describe("一個 unit 大約幾克（可食部分）"),
  confidence: z.enum(["high", "low"]).describe("看不清楚或可能是其他食物時填 low"),
  alternatives: z.array(z.string()).describe("confidence 為 low 時，最多 4 個其他可能的食物名稱；high 時為空陣列"),
  category: z.enum(["staple", "meat", "seafood", "egg_bean", "veg", "fruit", "soup", "drink", "snack", "other"]),
  est_per_100g: per100g.describe("這道菜每 100 克的估計營養（含烹調用油）"),
});

export const recognitionSchema = z.object({
  kind: z
    .enum(["meal", "nutrition_label", "not_food"])
    .describe("meal：餐點或食物；nutrition_label：包裝上的營養標示；not_food：與食物無關"),
  items: z.array(recognizedItemSchema).describe("kind 為 meal 時列出每一道菜；其他情況為空陣列"),
  possibly_missed: z
    .array(z.string())
    .describe("可能被遮住或容易漏掉的食物（例如湯、醬料、飲料），最多 4 個"),
  label: z
    .object({
      product_name: z.string(),
      serving_grams: z.number().describe("每份幾克或毫升；不明時填 0"),
      servings_per_package: z.number().describe("本包裝含幾份；不明時填 1"),
      per_serving: per100g.describe("每份的熱量與營養素"),
    })
    .nullable()
    .describe("kind 為 nutrition_label 時填寫，否則為 null"),
});

export type Recognition = z.infer<typeof recognitionSchema>;
export type RecognizedItem = z.infer<typeof recognizedItemSchema>;
