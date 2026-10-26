import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { newId } from "@/lib/id";

// 主鍵一律用 12 碼 nanoid：postback data 有 300 字元上限，uuid 太長
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => newId());

// numeric 欄位在 JS 端以 number 處理
const num = (name: string) => numeric(name, { mode: "number" });

export const users = pgTable("users", {
  id: id(),
  lineUserId: text("line_user_id").notNull().unique(),
  displayName: text("display_name"),
  sex: text("sex").$type<"male" | "female">(),
  birthYear: smallint("birth_year"),
  heightCm: num("height_cm"),
  weightKg: num("weight_kg"),
  activityLevel: text("activity_level").$type<ActivityLevel>(),
  goal: text("goal").$type<Goal>(),
  targetKcal: integer("target_kcal").notNull().default(2000),
  targetProteinG: integer("target_protein_g").notNull().default(75),
  targetCarbG: integer("target_carb_g").notNull().default(260),
  targetFatG: integer("target_fat_g").notNull().default(60),
  timezone: text("timezone").notNull().default("Asia/Taipei"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foods = pgTable(
  "foods",
  {
    id: id(),
    source: text("source").$type<"tfda" | "ai" | "user" | "seed">().notNull(),
    tfdaCode: text("tfda_code").unique(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    category: text("category").$type<FoodCategory>().notNull().default("other"),
    kcal100g: num("kcal_100g").notNull(),
    protein100g: num("protein_100g").notNull(),
    carb100g: num("carb_100g").notNull(),
    fat100g: num("fat_100g").notNull(),
    // 食藥署資料沒有份量單位；null 時改用 AI 估的單位與克數
    defaultUnit: text("default_unit"),
    unitGrams: num("unit_grams"),
    popularity: integer("popularity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("foods_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
    index("foods_aliases_idx").using("gin", t.aliases),
    index("foods_category_idx").on(t.category, t.popularity),
  ],
);

export const meals = pgTable(
  "meals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eatenAt: timestamp("eaten_at", { withTimezone: true }).notNull().defaultNow(),
    mealType: text("meal_type").$type<MealType>().notNull(),
    source: text("source").$type<"photo" | "label" | "text">().notNull(),
    photoPath: text("photo_path"),
    version: integer("version").notNull().default(1),
    // AI 原始回應，除錯與評估辨識準確度用
    aiRaw: jsonb("ai_raw"),
    possiblyMissed: text("possibly_missed").array().notNull().default(sql`'{}'::text[]`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meals_user_eaten_idx").on(t.userId, t.eatenAt)],
);

export const mealItems = pgTable(
  "meal_items",
  {
    id: id(),
    mealId: text("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    foodId: text("food_id").references(() => foods.id, { onDelete: "set null" }),
    // 以下為快照：食物資料庫之後更新也不影響過去的紀錄
    name: text("name").notNull(),
    portion: num("portion").notNull(),
    unit: text("unit").notNull(),
    unitGrams: num("unit_grams").notNull(),
    kcal100g: num("kcal_100g").notNull(),
    protein100g: num("protein_100g").notNull(),
    carb100g: num("carb_100g").notNull(),
    fat100g: num("fat_100g").notNull(),
    grams: num("grams").notNull(),
    kcal: num("kcal").notNull(),
    proteinG: num("protein_g").notNull(),
    carbG: num("carb_g").notNull(),
    fatG: num("fat_g").notNull(),
    confidence: text("confidence").$type<"high" | "low">().notNull().default("high"),
    alternatives: jsonb("alternatives").$type<ItemAlternative[]>().notNull().default([]),
    addedBy: text("added_by").$type<"ai" | "user">().notNull().default("ai"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("meal_items_meal_idx").on(t.mealId)],
);

export const conversationStates = pgTable("conversation_states", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  state: text("state").$type<ConversationStateName>().notNull(),
  payload: jsonb("payload").$type<ConversationPayload>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type FoodCategory =
  | "staple"
  | "meat"
  | "seafood"
  | "egg_bean"
  | "veg"
  | "fruit"
  | "soup"
  | "drink"
  | "snack"
  | "other";
export type ItemAlternative = { name: string; foodId?: string };
export type ConversationStateName = "awaiting_portion" | "awaiting_food_name";
export type ConversationPayload = {
  mealId: string;
  itemId?: string;
  mode?: "replace" | "add";
};

export type User = typeof users.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type MealItem = typeof mealItems.$inferSelect;
