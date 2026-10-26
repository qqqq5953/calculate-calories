import type { messagingApi } from "@line/bot-sdk";

export const COLORS = {
  primary: "#2E9E5B",
  warn: "#E8833A",
  text: "#222222",
  sub: "#888888",
  track: "#EEEEEE",
  carb: "#F2B33D",
  protein: "#4A90D9",
  fat: "#D9534F",
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
