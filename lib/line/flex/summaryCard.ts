import type { messagingApi } from "@line/bot-sdk";
import { liffUrl } from "@/lib/env";
import { MEAL_TYPE_EMOJI, MEAL_TYPE_LABEL } from "@/lib/time";
import type { MealType } from "@/lib/db/schema";
import { encodePostback } from "@/lib/line/postback";
import { COLORS, progressBar } from "./parts";

export type SummaryInput = {
  date: string;
  totals: { kcal: number; proteinG: number; carbG: number; fatG: number };
  targets: { kcal: number; proteinG: number; carbG: number; fatG: number };
  meals: { id: string; mealType: MealType; kcal: number }[];
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function buildSummaryCard(s: SummaryInput): messagingApi.FlexMessage {
  const remaining = s.targets.kcal - s.totals.kcal;
  const metric = (label: string, v: number, t: number, unit: string, color: string): messagingApi.FlexComponent => ({
    type: "box",
    layout: "vertical",
    margin: "md",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: label, size: "sm", color: COLORS.sub },
          { type: "text", text: `${fmt(v)} / ${fmt(t)} ${unit}`, size: "sm", align: "end" },
        ],
      },
      progressBar(v / Math.max(t, 1), color),
    ],
  });

  const mealRows: messagingApi.FlexComponent[] = s.meals.length
    ? s.meals.map((m) => ({
        type: "box",
        layout: "horizontal",
        paddingTop: "6px",
        paddingBottom: "6px",
        action: { type: "postback", label: "查看", data: encodePostback({ a: "show_meal", m: m.id }) },
        contents: [
          { type: "text", text: `${MEAL_TYPE_EMOJI[m.mealType]} ${MEAL_TYPE_LABEL[m.mealType]}`, size: "sm" },
          { type: "text", text: `${fmt(m.kcal)} kcal ›`, size: "sm", align: "end", color: COLORS.sub },
        ],
      }))
    : [{ type: "text", text: "今天還沒有記錄，傳一張餐點照片試試看！", size: "sm", color: COLORS.sub, wrap: true }];

  return {
    type: "flex",
    altText: `今日 ${fmt(s.totals.kcal)} / ${fmt(s.targets.kcal)} kcal`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          { type: "text", text: `📋 今日摘要 · ${s.date.slice(5).replace("-", "/")}`, size: "sm", color: COLORS.sub },
          {
            type: "text",
            text: remaining >= 0 ? `還可以吃 ${fmt(remaining)} kcal` : `已超過 ${fmt(-remaining)} kcal`,
            size: "xl",
            weight: "bold",
            margin: "sm",
            color: remaining >= 0 ? COLORS.primary : COLORS.warn,
          },
          metric("熱量", s.totals.kcal, s.targets.kcal, "kcal", remaining >= 0 ? COLORS.primary : COLORS.warn),
          metric("蛋白質", s.totals.proteinG, s.targets.proteinG, "g", COLORS.protein),
          metric("碳水", s.totals.carbG, s.targets.carbG, "g", COLORS.carb),
          metric("脂肪", s.totals.fatG, s.targets.fatG, "g", COLORS.fat),
          { type: "separator", margin: "lg" },
          { type: "box", layout: "vertical", margin: "md", contents: mealRows },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: { type: "uri", label: "📊 看趨勢", uri: liffUrl("/dashboard/trends") || "https://line.me" },
          },
        ],
      },
    },
  };
}
