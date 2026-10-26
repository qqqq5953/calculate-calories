/**
 * 建立 2×2 Rich Menu（聊天室下方的固定選單）並設為預設：
 *   📷 記錄一餐 ｜ 📋 今日摘要
 *   📊 儀表板   ｜ ⚙️ 設定
 * 圖片由程式產生（不需要另外設計）。會先刪除舊的同名選單，可以重複執行。
 *
 * 用法：LINE_CHANNEL_ACCESS_TOKEN=... NEXT_PUBLIC_LIFF_ID=... npx tsx scripts/setup-richmenu.ts
 * 加 --preview 只輸出圖片到 richmenu-preview.png，不呼叫 LINE。
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { liffUrl } from "@/lib/env";
import { lineBlobClient, lineClient } from "@/lib/line/client";
import { encodePostback } from "@/lib/line/postback";

const NAME = "calorie-main";
const W = 2500;
const H = 1686;

// 以簡單圖形取代 emoji：伺服器上不一定有彩色 emoji 字型
const ICONS = {
  camera: `<rect x="-90" y="-60" width="180" height="130" rx="24" fill="none" stroke="#fff" stroke-width="16"/><rect x="-40" y="-88" width="80" height="34" rx="10" fill="#fff"/><circle cx="0" cy="5" r="38" fill="none" stroke="#fff" stroke-width="16"/>`,
  list: `<rect x="-80" y="-95" width="160" height="190" rx="20" fill="none" stroke="#fff" stroke-width="16"/><line x1="-45" y1="-40" x2="45" y2="-40" stroke="#fff" stroke-width="16" stroke-linecap="round"/><line x1="-45" y1="5" x2="45" y2="5" stroke="#fff" stroke-width="16" stroke-linecap="round"/><line x1="-45" y1="50" x2="15" y2="50" stroke="#fff" stroke-width="16" stroke-linecap="round"/>`,
  chart: `<rect x="-85" y="10" width="40" height="80" rx="8" fill="#fff"/><rect x="-20" y="-40" width="40" height="130" rx="8" fill="#fff"/><rect x="45" y="-90" width="40" height="180" rx="8" fill="#fff"/>`,
  gear: `${Array.from({ length: 8 }, (_, i) => `<rect x="-14" y="-95" width="28" height="36" rx="6" fill="#fff" transform="rotate(${i * 45})"/>`).join("")}<circle cx="0" cy="0" r="62" fill="none" stroke="#fff" stroke-width="16"/>`,
};

const CELLS = [
  { label: "記錄一餐", icon: ICONS.camera, color: "#2E9E5B" },
  { label: "今日摘要", icon: ICONS.list, color: "#3B8F6A" },
  { label: "儀表板", icon: ICONS.chart, color: "#2A78D6" },
  { label: "設定", icon: ICONS.gear, color: "#5B6670" },
];

function menuSvg(): string {
  const cw = W / 2;
  const ch = H / 2;
  const cells = CELLS.map((c, i) => {
    const x = (i % 2) * cw;
    const y = Math.floor(i / 2) * ch;
    return `
      <rect x="${x + 6}" y="${y + 6}" width="${cw - 12}" height="${ch - 12}" rx="36" fill="${c.color}"/>
      <g transform="translate(${x + cw / 2}, ${y + ch / 2 - 90})">${c.icon}</g>
      <text x="${x + cw / 2}" y="${y + ch / 2 + 150}" font-size="120" font-weight="700" fill="#fff" text-anchor="middle"
        font-family="PingFang TC, Noto Sans TC, Noto Sans CJK TC, Microsoft JhengHei, WenQuanYi Zen Hei, sans-serif">${c.label}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>${cells}</svg>`;
}

async function main() {
  const png = await sharp(Buffer.from(menuSvg())).png().toBuffer();
  if (process.argv.includes("--preview")) {
    writeFileSync("richmenu-preview.png", png);
    console.log("已輸出 richmenu-preview.png");
    return;
  }

  const dashboard = liffUrl("/dashboard");
  const settings = liffUrl("/settings");
  if (!dashboard.startsWith("https://")) throw new Error("請設定 NEXT_PUBLIC_LIFF_ID");

  const client = lineClient();
  const { richmenus } = await client.getRichMenuList();
  for (const m of richmenus.filter((m) => m.name === NAME)) {
    await client.deleteRichMenu(m.richMenuId);
    console.log(`刪除舊選單 ${m.richMenuId}`);
  }

  const half = { w: W / 2, h: H / 2 };
  const { richMenuId } = await client.createRichMenu({
    size: { width: W, height: H },
    selected: true,
    name: NAME,
    chatBarText: "選單",
    areas: [
      { bounds: { x: 0, y: 0, width: half.w, height: half.h }, action: { type: "postback", data: encodePostback({ a: "record" }), displayText: "記錄一餐" } },
      { bounds: { x: half.w, y: 0, width: half.w, height: half.h }, action: { type: "postback", data: encodePostback({ a: "today" }), displayText: "今日摘要" } },
      { bounds: { x: 0, y: half.h, width: half.w, height: half.h }, action: { type: "uri", uri: dashboard } },
      { bounds: { x: half.w, y: half.h, width: half.w, height: half.h }, action: { type: "uri", uri: settings } },
    ],
  });
  await lineBlobClient().setRichMenuImage(richMenuId, new Blob([new Uint8Array(png)], { type: "image/png" }));
  await client.setDefaultRichMenu(richMenuId);
  console.log(`Rich Menu 已建立並設為預設：${richMenuId}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
