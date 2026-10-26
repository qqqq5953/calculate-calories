import type { messagingApi } from "@line/bot-sdk";

export const COLORS = {
  primary: "#2E9E5B",
  warn: "#B45309", // 不確定項目的文字（搭配 ⚠️）
  over: "#D03B3B", // 熱量超標
  text: "#222222",
  sub: "#888888",
  track: "#EEEEEE",
  // 三大營養素配色經色盲模擬驗證（dataviz validate_palette）
  carb: "#C98500",
  protein: "#2A78D6",
  fat: "#EB6834",
};

/** 進度條：ratio 0–1（超過 1 以滿格顯示） */
export function progressBar(ratio: number, color: string): messagingApi.FlexBox {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return {
    type: "box",
    layout: "vertical",
    height: "6px",
    cornerRadius: "3px",
    backgroundColor: COLORS.track,
    margin: "sm",
    contents:
      pct > 0
        ? [{ type: "box", layout: "vertical", contents: [], width: `${pct}%`, height: "6px", backgroundColor: color }]
        : [],
  };
}
