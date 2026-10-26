import type { messagingApi } from "@line/bot-sdk";
import type { Meal, MealItem } from "@/lib/db/schema";
import { liffUrl } from "@/lib/env";
import { macroPercents, sumNutrients, type Nutrients } from "@/lib/nutrition/calc";
import { formatPortion } from "@/lib/nutrition/parsePortion";
import { formatShort, MEAL_TYPE_EMOJI, MEAL_TYPE_LABEL } from "@/lib/time";
import { encodePostback } from "@/lib/line/postback";
import { COLORS, progressBar } from "./parts";

type FlexComponent = messagingApi.FlexComponent;

export type DayProgress = {
  kcal: number;
  proteinG: number;
  targetKcal: number;
  targetProteinG: number;
};

export type MealCardInput = {
  meal: Pick<Meal, "id" | "eatenAt" | "mealType" | "version" | "source">;
  items: MealItem[];
  day: DayProgress;
  timeZone?: string;
};

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function mealTotals(items: MealItem[]): Nutrients {
  return sumNutrients(items);
}

function macroBar(n: Nutrients): FlexComponent[] {
  const pct = macroPercents(n);
  const segments: [number, string][] = [
    [pct.carb, COLORS.carb],
    [pct.protein, COLORS.protein],
    [pct.fat, COLORS.fat],
  ];
  const bar: messagingApi.FlexBox = {
    type: "box",
    layout: "horizontal",
    height: "8px",
    cornerRadius: "4px",
    backgroundColor: COLORS.track,
    margin: "md",
    contents: segments
      .filter(([p]) => p > 0)
      .map(([p, color]) => ({
        type: "box",
        layout: "vertical",
        contents: [],
        width: `${p}%`,
        backgroundColor: color,
      })),
  };
  const label = (name: string, p: number, g: number, color: string): FlexComponent => ({
    type: "box",
    layout: "vertical",
    flex: 1,
    contents: [
      { type: "text", text: name, size: "xxs", color },
      { type: "text", text: `${p}% · ${fmtInt(g)}g`, size: "xs", color: COLORS.text },
    ],
  });
  return [
    bar,
    {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        label("碳水", pct.carb, n.carbG, COLORS.carb),
        label("蛋白質", pct.protein, n.proteinG, COLORS.protein),
        label("脂肪", pct.fat, n.fatG, COLORS.fat),
      ],
    },
  ];
}

function itemRow(meal: MealCardInput["meal"], item: MealItem, compact: boolean): FlexComponent {
  const low = item.confidence === "low";
  const size = compact ? "xs" : "sm";
  return {
    type: "box",
    layout: "horizontal",
    paddingTop: "8px",
    paddingBottom: "8px",
    action: {
      type: "postback",
      label: "調整",
      data: encodePostback({ a: "item", m: meal.id, i: item.id, v: meal.version }),
    },
    contents: [
      {
        type: "text",
        text: low ? `⚠️ ${item.name}?` : item.name,
        size,
        flex: 5,
        wrap: true,
        color: low ? COLORS.warn : COLORS.text,
      },
      {
        type: "text",
        text: `${formatPortion(item.portion)} ${item.unit}`,
        size,
        flex: 3,
        color: COLORS.sub,
        align: "end",
      },
      {
        type: "text",
        text: `${fmtInt(item.kcal)} ›`,
        size,
        flex: 2,
        align: "end",
        color: COLORS.text,
      },
    ],
  };
}

export function buildMealCard(input: MealCardInput): messagingApi.FlexMessage {
  const { meal, items, day } = input;
  const tz = input.timeZone;
  const totals = mealTotals(items);
  const compact = items.length > 10;

  const header: messagingApi.FlexBox = {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    contents: [
      {
        type: "text",
        text: `${MEAL_TYPE_EMOJI[meal.mealType]} ${MEAL_TYPE_LABEL[meal.mealType]} · ${formatShort(meal.eatenAt, tz)}`,
        size: "sm",
        color: COLORS.sub,
      },
      {
        type: "box",
        layout: "baseline",
        margin: "sm",
        contents: [
          { type: "text", text: fmtInt(totals.kcal), size: "3xl", weight: "bold", flex: 0 },
          { type: "text", text: " kcal", size: "sm", color: COLORS.sub, flex: 0 },
        ],
      },
      ...macroBar(totals),
    ],
  };

  const itemRows: FlexComponent[] =
    items.length > 0
      ? items.flatMap((item, idx) => {
          const row = itemRow(meal, item, compact);
          return idx === 0 ? [row] : [{ type: "separator", color: COLORS.track } as FlexComponent, row];
        })
      : [{ type: "text", text: "（沒有食物，點「新增食物」加入）", size: "sm", color: COLORS.sub }];

  const hasLow = items.some((i) => i.confidence === "low");
  const body: messagingApi.FlexBox = {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    paddingTop: "4px",
    contents: [
      ...(hasLow
        ? [
            {
              type: "text",
              text: "⚠️ 標記的項目不太確定，點一下可以選正確的食物",
              size: "xxs",
              color: COLORS.warn,
              wrap: true,
              margin: "sm",
            } as FlexComponent,
          ]
        : []),
      ...itemRows,
      { type: "separator", margin: "md" },
      dayProgress(day),
    ],
  };

  const footer: messagingApi.FlexBox = {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "12px",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: COLORS.primary,
            height: "sm",
            action: { type: "postback", label: "＋ 新增食物", data: encodePostback({ a: "add", m: meal.id }) },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "postback", label: "⋯ 更多", data: encodePostback({ a: "more", m: meal.id }) },
          },
        ],
      },
      {
        type: "button",
        style: "link",
        height: "sm",
        action: { type: "uri", label: "📊 儀表板", uri: liffUrl("/dashboard") || "https://line.me" },
      },
    ],
  };

  return {
    type: "flex",
    altText: `${MEAL_TYPE_LABEL[meal.mealType]} ${fmtInt(totals.kcal)} kcal`,
    contents: { type: "bubble", size: "mega", header, body, footer },
  };
}

function dayProgress(day: DayProgress): FlexComponent {
  const row = (label: string, value: number, target: number, unit: string, color: string): FlexComponent => ({
    type: "box",
    layout: "vertical",
    margin: "md",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: label, size: "xs", color: COLORS.sub, flex: 1 },
          {
            type: "text",
            text: `${fmtInt(value)} / ${fmtInt(target)} ${unit}`,
            size: "xs",
            color: COLORS.text,
            align: "end",
            flex: 2,
          },
        ],
      },
      progressBar(value / Math.max(target, 1), color),
    ],
  });
  return {
    type: "box",
    layout: "vertical",
    contents: [
      row("今日熱量", day.kcal, day.targetKcal, "kcal", day.kcal > day.targetKcal ? COLORS.warn : COLORS.primary),
      row("今日蛋白質", day.proteinG, day.targetProteinG, "g", COLORS.protein),
    ],
  };
}
