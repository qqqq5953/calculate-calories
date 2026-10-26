import type { messagingApi } from "@line/bot-sdk";
import type { FoodCategory, MealItem, MealType } from "@/lib/db/schema";
import { encodePostback, type Postback } from "@/lib/line/postback";
import { formatPortion } from "@/lib/nutrition/parsePortion";
import { MEAL_TYPE_LABEL } from "@/lib/time";

type Item = messagingApi.QuickReplyItem;

// LINE 限制：quick reply 最多 13 個，label 最多 20 字
const MAX_ITEMS = 13;
const MAX_LABEL = 20;

const clip = (s: string) => (s.length > MAX_LABEL ? s.slice(0, MAX_LABEL - 1) + "…" : s);

function pb(label: string, data: Postback, displayText?: string): Item {
  return {
    type: "action",
    action: {
      type: "postback",
      label: clip(label),
      data: encodePostback(data),
      displayText: displayText ?? label,
    },
  };
}

export function quickReply(items: Item[]): messagingApi.QuickReply {
  return { items: items.slice(0, MAX_ITEMS) };
}

export const PORTION_PRESETS = [1 / 3, 0.5, 2 / 3, 1, 1.5, 2];

export function portionItems(item: Pick<MealItem, "id" | "name" | "unit">): Item[] {
  return PORTION_PRESETS.map((q) => {
    const rounded = Math.round(q * 100) / 100;
    const label = `${formatPortion(rounded)} ${item.unit}`;
    return pb(label, { a: "qty", i: item.id, q: rounded }, `${item.name} 改成 ${label}`);
  });
}

/** 點一般項目：份量 + 其他份量 + 換成別的 + 刪除 */
export function itemMenu(item: MealItem): messagingApi.QuickReply {
  return quickReply([
    ...portionItems(item),
    pb("其他份量…", { a: "qty_other", i: item.id }, `${item.name} 其他份量`),
    pb("換成別的", { a: "swap_other", i: item.id }, `${item.name} 換成別的`),
    pb("🗑 刪除", { a: "del_item", i: item.id }, `刪除 ${item.name}`),
  ]);
}

/** 點低信心項目：候選 + 都不是 + 改份量 + 刪除 */
export function lowConfidenceMenu(item: MealItem): messagingApi.QuickReply {
  const alts = item.alternatives.slice(0, 4);
  return quickReply([
    pb(`✓ ${item.name}`, { a: "qty", i: item.id, q: item.portion }, `是${item.name}沒錯`),
    ...alts.map((alt) =>
      pb(alt.name, { a: "swap", i: item.id, f: alt.foodId, n: alt.foodId ? undefined : alt.name }, `換成${alt.name}`),
    ),
    pb("都不是", { a: "swap_other", i: item.id }, "都不是"),
    pb("改份量", { a: "qty_menu", i: item.id }, `${item.name} 改份量`),
    pb("🗑 刪除", { a: "del_item", i: item.id }, `刪除 ${item.name}`),
  ]);
}

export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  staple: "🍚 主食",
  meat: "🍗 肉類",
  seafood: "🐟 海鮮",
  egg_bean: "🥚 蛋豆",
  veg: "🥬 蔬菜",
  fruit: "🍎 水果",
  soup: "🍲 湯",
  drink: "🧋 飲料",
  snack: "🍪 點心",
  other: "其他",
};

const ADD_MENU_CATEGORIES: FoodCategory[] = ["staple", "meat", "egg_bean", "veg", "soup", "drink", "snack"];

/** 新增食物：AI 猜漏掉的（≤4）+ 分類 + 輸入名稱 */
export function addMenu(mealId: string, possiblyMissed: string[]): messagingApi.QuickReply {
  return quickReply([
    ...possiblyMissed.slice(0, 4).map((name) => pb(`＋${name}`, { a: "add_food", m: mealId, n: name }, `新增${name}`)),
    ...ADD_MENU_CATEGORIES.map((c) => pb(CATEGORY_LABEL[c], { a: "add_cat", m: mealId, c })),
    pb("⌨️ 輸入名稱", { a: "add_other", m: mealId }, "輸入食物名稱"),
  ]);
}

export function foodChoices(
  foods: { id: string; name: string }[],
  make: (f: { id: string; name: string }) => Postback,
  extra: Item[] = [],
): messagingApi.QuickReply {
  return quickReply([...foods.slice(0, MAX_ITEMS - extra.length).map((f) => pb(f.name, make(f))), ...extra]);
}

export function moreMenu(mealId: string): messagingApi.QuickReply {
  const types: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  return quickReply([
    ...types.map((t) => pb(`改成${MEAL_TYPE_LABEL[t]}`, { a: "meal_type", m: mealId, t })),
    {
      type: "action",
      action: {
        type: "datetimepicker",
        label: "改日期時間",
        data: encodePostback({ a: "meal_time", m: mealId }),
        mode: "datetime",
      },
    },
    pb("🗑 刪除這餐", { a: "del_meal", m: mealId }),
  ]);
}

export function recordMenu(): messagingApi.QuickReply {
  return quickReply([
    { type: "action", action: { type: "camera", label: "📷 拍照" } },
    { type: "action", action: { type: "cameraRoll", label: "🖼 從相簿選" } },
  ]);
}

export function postbackItem(label: string, data: Postback, displayText?: string): Item {
  return pb(label, data, displayText);
}
