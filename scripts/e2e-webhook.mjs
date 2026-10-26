/**
 * Webhook 端到端測試：起一個假的 LINE API 伺服器接收回覆，送出帶簽章的事件，
 * 驗證「點卡片 → 選份量 → 其他份量 → 新增 → 改餐別 → 刪除／復原」整個流程。
 * 不會呼叫 AI（只走按鈕和資料庫路徑）。
 *
 * 前置：
 *   1. 本機 DB 已 migrate + seed，且測試使用者今天至少有一餐（npm run seed:demo）
 *   2. 以下列環境變數啟動 app：
 *        LINE_CHANNEL_SECRET=dummy LINE_CHANNEL_ACCESS_TOKEN=dummy LINE_API_BASE_URL=http://127.0.0.1:3999
 *   3. node scripts/e2e-webhook.mjs
 */
import crypto from "node:crypto";
import http from "node:http";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const SECRET = process.env.LINE_CHANNEL_SECRET ?? "dummy";
const MOCK_PORT = Number(process.env.MOCK_LINE_PORT ?? 3999);
const USER = process.env.E2E_LINE_USER_ID ?? "Udev-local";

const replies = [];
const calls = [];

const server = http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls.push(`${req.method} ${req.url}`);
      res.writeHead(200, { "content-type": "application/json" });
      if (req.url.startsWith("/v2/bot/profile/")) {
        return res.end(JSON.stringify({ userId: USER, displayName: "小明" }));
      }
      if (req.url === "/v2/bot/message/reply") replies.push(JSON.parse(body));
      res.end("{}");
    });
  })
  .listen(MOCK_PORT);

let seq = 0;
async function send(event) {
  const before = replies.length;
  const body = JSON.stringify({
    destination: "x",
    events: [
      {
        mode: "active",
        timestamp: Date.now(),
        webhookEventId: `e${++seq}`,
        deliveryContext: { isRedelivery: false },
        source: { type: "user", userId: USER },
        replyToken: `rt${seq}`,
        ...event,
      },
    ],
  });
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64");
  const r = await fetch(`${APP}/api/line/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-line-signature": sig },
    body,
  });
  if (r.status !== 200) throw new Error(`webhook returned ${r.status}`);
  for (let i = 0; i < 150 && replies.length === before; i++) await new Promise((res) => setTimeout(res, 100));
  const rep = replies[before];
  if (!rep) throw new Error(`no reply for ${JSON.stringify(event).slice(0, 100)}`);
  return rep.messages;
}

const postback = (data, params) => send({ type: "postback", postback: { data, params } });
const textMsg = (text) => send({ type: "message", message: { type: "text", id: `m${seq}`, text, quoteToken: "q" } });
const json = (m) => JSON.stringify(m);
const find = (m, re) => json(m).match(re)?.[0];
const qr = (m) => m.at(-1).quickReply?.items ?? [];
const qrLabels = (m) => qr(m).map((i) => i.action.label);

let failed = 0;
const check = (name, cond) => {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failed++;
};

try {
  const bad = await fetch(`${APP}/api/line/webhook`, { method: "POST", headers: { "x-line-signature": "nope" }, body: "{}" });
  check("拒絕錯誤簽章（401）", bad.status === 401);

  let m = await send({ type: "follow" });
  check("加好友：歡迎訊息含暱稱與設定按鈕", json(m).includes("小明，歡迎") && json(m).includes("設定我的目標"));

  m = await textMsg("今日");
  check("輸入「今日」→ 今日摘要卡片", m[0].type === "flex" && json(m).includes("今日摘要"));
  const showMeal = find(m, /a=show_meal&m=\w+/);
  if (!showMeal) throw new Error("測試使用者今天沒有餐點，請先執行 npm run seed:demo");

  m = await postback(showMeal);
  check("查看一餐 → 餐點卡片", m[0].type === "flex" && json(m).includes("kcal"));
  const itemData = find(m, /a=item&m=\w+&i=\w+&v=\d+/);
  const itemId = itemData.match(/i=(\w+)/)[1];
  const mealId = itemData.match(/m=(\w+)/)[1];

  m = await postback(itemData);
  check("點某一道菜 → Quick Reply 選單", qrLabels(m).includes("其他份量…") || qrLabels(m).includes("都不是"));
  console.log(`   選單：${qrLabels(m).join(" | ")}`);

  m = await postback(`a=qty&i=${itemId}&q=0.5`);
  check("選 ½ → 卡片更新為 ½", m[0].type === "flex" && json(m).includes("½ "));

  m = await postback(itemData);
  check("點舊卡片 → 提示並附最新卡片與選單", json(m).includes("不是最新") && m.at(-1).type === "flex" && Boolean(m.at(-1).quickReply));

  m = await postback(`a=qty_other&i=${itemId}`);
  check("其他份量 → 請輸入數字", json(m).includes("請輸入份量"));
  m = await textMsg("好吃");
  check("輸入看不懂的份量 → 再提示並附選項", json(m).includes("看不懂") && qrLabels(m).length > 0);
  m = await textMsg("2/3");
  check("輸入 2/3 → 卡片顯示 ⅔", m[0].type === "flex" && json(m).includes("⅔ "));

  m = await postback(`a=add&m=${mealId}`);
  check("新增食物 → 分類選單", qrLabels(m).some((l) => l.includes("肉類")));
  m = await postback(`a=add_cat&m=${mealId}&c=meat`);
  const firstMeat = qr(m)[0].action;
  check("點分類 → 常見食物清單", firstMeat.data.startsWith("a=add_food"));
  m = await postback(firstMeat.data);
  check(`選食物 → 卡片出現「${firstMeat.label}」`, json(m).includes(firstMeat.label));

  m = await postback(`a=add_other&m=${mealId}`);
  check("輸入名稱 → 請輸入食物名稱", json(m).includes("請輸入食物名稱"));
  m = await textMsg("豆干");
  check("輸入「豆干」→ 資料庫候選 + AI 估算選項", qrLabels(m).includes("滷豆干") && qrLabels(m).some((l) => l.includes("估算")));

  m = await postback(`a=more&m=${mealId}`);
  check("更多 → 改餐別 + 日期時間選擇器", qrLabels(m).includes("改成晚餐") && json(m).includes("datetimepicker"));
  m = await postback(`a=meal_type&m=${mealId}&t=dinner`);
  check("改成晚餐", json(m).includes("晚餐"));
  m = await postback(`a=meal_time&m=${mealId}`, { datetime: "2026-10-25T19:30" });
  check("選日期時間 → 10/25 19:30", json(m).includes("10/25 19:30"));
  m = await postback(`a=del_meal&m=${mealId}`);
  check("刪除這餐 → 附復原選項", json(m).includes("已刪除") && qrLabels(m).includes("↩ 復原"));
  m = await postback(`a=undo_del_meal&m=${mealId}`);
  check("復原 → 卡片回來", json(m).includes("已復原") && m.at(-1).type === "flex");

  m = await textMsg("今日");
  check("流程結束後仍正常回應", json(m).includes("今日摘要"));
  check("有使用 loading 動畫", calls.some((c) => c.includes("/chat/loading/start")));
} catch (err) {
  console.error("✗", err.message);
  failed++;
} finally {
  server.close();
}

console.log(failed ? `\n${failed} 項失敗` : "\n全部通過");
process.exit(failed ? 1 : 0);
