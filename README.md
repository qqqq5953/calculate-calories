# 熱量小幫手 🍱

在 LINE 傳一張餐點照片，就能記錄熱量和三大營養素（碳水、蛋白質、脂肪）。辨識錯了點按鈕就能修正，不用打字。長期趨勢（赤字還是盈餘、蛋白質有沒有吃夠）在 LINE 裡打開的儀表板看。

給自己和家人用，所有服務都用免費方案，只有 AI 辨識依用量付費（每張照片不到台幣 2 分錢）。

## 功能

- **拍照記錄**：傳餐點照片 → AI 辨識每道菜 → 自動存檔 → 回一張卡片（熱量、三大營養素比例、今日進度）
- **營養標示**：拍包裝上的營養標示，直接讀出數值
- **文字記錄**：輸入「雞腿便當」也可以
- **只用按鈕修正**：
  - 點某一道菜 → ⅓ ½ ⅔ 1 1½ 2、其他份量、換成別的、刪除
  - AI 不確定的菜會標 ⚠️，點了直接列出候選（例如：滷豆干？滷蛋？油豆腐？）
  - ＋新增食物：AI 猜你可能漏掉的（湯、醬料）→ 分類選單 → 最後才需要輸入名稱
  - 改餐別、改日期時間、刪除整餐（可以復原）
- **儀表板**（LIFF）：今日、7／30 天趨勢、個人目標設定
- **防當機**：資料庫連不上時回覆「系統暫時無法使用」並通知管理者；每 5 天自動打一次資料庫避免 Supabase 免費方案被暫停

## 架構

```
LINE ──webhook──▶ Next.js（Vercel）──▶ Postgres（Supabase）
  ▲                 │   ├─ Claude API（照片／文字辨識）
  └──── LIFF ◀──────┘   └─ Supabase Storage（照片，可省略）
       儀表板
```

| 目錄 | 內容 |
|---|---|
| `app/api/line/webhook` | LINE webhook：驗證簽章，先回 200 再背景處理 |
| `lib/bot/` | 事件處理：照片、文字、按鈕（postback）、對話狀態 |
| `lib/line/` | Flex 卡片、Quick Reply、postback 編解碼 |
| `lib/ai/` | Claude 辨識（structured outputs，只回 JSON） |
| `lib/nutrition/` | 營養計算、目標（Mifflin-St Jeor）、份量解析、食物比對、趨勢 |
| `lib/db/` | Drizzle schema 與查詢；`withDb()` 把連線錯誤轉成 `DbUnavailableError` |
| `app/dashboard`、`app/settings` | LIFF 儀表板 |
| `scripts/` | 種子資料、食藥署匯入、Rich Menu、示範資料、端到端測試 |

## 部署步驟

### 1. LINE

到 [LINE Developers](https://developers.line.biz/) 建立 Provider，然後：

1. **Messaging API channel**（就是你的官方帳號）
   - 記下 **Channel secret**、發行 **Channel access token（long-lived）**
   - LINE Official Account Manager → 回應設定：關閉「自動回應訊息」，開啟「Webhook」
2. **LINE Login channel**（同一個 Provider 底下）
   - 記下 **Channel ID**（給 `LINE_LOGIN_CHANNEL_ID`）
   - 新增 **LIFF app**：Size 選 `Full`，Endpoint URL 填 `https://你的網域/`，Scope 勾 `openid`、`profile`
   - 記下 **LIFF ID**（給 `NEXT_PUBLIC_LIFF_ID`）

### 2. Supabase

1. 建立專案（免費方案）
2. Project Settings → Database：
   - 執行 migration 用 **Session pooler** 或 Direct connection 的連線字串
   - Vercel 上的 `DATABASE_URL` 用 **Transaction pooler**（port 6543）
3. Storage → 建立 **private** bucket `meal-photos`（不需要存照片可以略過）
4. 建立資料表與匯入食物：
   ```bash
   DATABASE_URL="<session pooler 連線字串>" npm run db:migrate
   DATABASE_URL="<session pooler 連線字串>" npm run seed
   ```

### 3. Anthropic

到 [Anthropic Console](https://console.anthropic.com/) 申請 API key 並儲值。預設模型是 `claude-haiku-5-5`，辨識不夠準可以把 `AI_MODEL` 改成 `claude-sonnet-5-5`。

> Claude 的 Pro／Max 訂閱額度不能用在自己的程式，一定要用 API key。

### 4. Vercel

1. Import 這個 GitHub repo
2. 依 `.env.example` 設定環境變數（`SESSION_SECRET`、`CRON_SECRET` 用 `openssl rand -hex 32` 產生）
3. 部署完成後，把 `https://你的網域/api/line/webhook` 填到 Messaging API channel 的 Webhook URL，按 Verify
4. 建立 Rich Menu：
   ```bash
   LINE_CHANNEL_ACCESS_TOKEN=... NEXT_PUBLIC_LIFF_ID=... npm run richmenu
   ```
5. `vercel.json` 裡的 keepalive cron 會自動註冊（Vercel → Settings → Cron Jobs 可以確認）。也可以手動測試：
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://你的網域/api/cron/keepalive
   ```

### 5. 管理者通知（選用）

把自己的 LINE userId 填到 `ADMIN_LINE_USER_ID`，資料庫連不上時會收到通知。userId 可以在 LINE Developers → Messaging API channel → Basic settings 最下方的「Your user ID」找到。

如果 Supabase 專案真的被暫停了，要到 Supabase 後台按 **Restore** 手動恢復（程式沒辦法自動恢復）。

## 食藥署營養資料（選用）

內建約 90 種常見台灣餐點（含「一碗」「一支」這類份量單位）。想要更完整的食材資料：

1. 到[政府資料開放平臺](https://data.gov.tw/)搜尋「食品營養成分資料集」下載 CSV
2. 放到 `data/tfda/foods.csv`
3. `DATABASE_URL=... npx tsx scripts/import-tfda.ts`

可以重複執行（以「整合編號」更新）。比對食物時，內建清單優先（因為有份量單位），食藥署資料用來補營養數值。

## 本機開發（Docker）

需要 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（或 OrbStack）和 [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)。

```bash
npm install
cp .env.example .env.local      # 填入 LINE、Anthropic 等設定
supabase start                  # 用 Docker 起本機 Supabase（Postgres、Storage、Studio）
# .env.local 的 DATABASE_URL 填 supabase start 印出的 DB URL
npm run db:migrate
npm run seed
npm run dev
ngrok http 3000                 # 把 https 網址填到「開發用」LINE channel 的 webhook
```

- 建議開兩個 Messaging API channel：開發用（webhook 指向 ngrok）和正式用（指向 Vercel）。
- 沒有 LIFF 時看儀表板：`.env.local` 加 `ALLOW_DEV_LOGIN=1`、不設 `NEXT_PUBLIC_LIFF_ID`，打開 `http://localhost:3000/dashboard` 會用測試帳號登入。`npm run seed:demo` 可以塞 30 天示範資料。
- 用 Docker 跑 app：`docker compose up --build`（資料庫一樣用 `supabase start`）。
- 模擬資料庫斷線：`docker stop supabase_db_calculate-calories`，傳訊息給 bot 應該收到「系統暫時無法使用」。

## 測試

```bash
npm run typecheck && npm run lint && npm test          # 單元測試

# 資料庫整合測試（需要已 migrate + seed 的 DB）
TEST_DATABASE_URL=postgresql://... npx vitest run tests/db.integration.test.ts

# webhook 端到端測試（假的 LINE API，不呼叫 AI）
#   app 需以 LINE_CHANNEL_SECRET=dummy LINE_CHANNEL_ACCESS_TOKEN=dummy LINE_API_BASE_URL=http://127.0.0.1:3999 啟動
npm run seed:demo && APP_URL=http://localhost:3000 npm run test:e2e
```

## 已知限制

- 內建餐點的營養數值是外食常見做法的概估值（含烹調油），不是實驗室數據。
- 食藥署 CSV 的欄位格式是依公開資料的常見格式撰寫，欄位名稱用關鍵字比對；如果官方改版導致匯入失敗，錯誤訊息會列出實際的欄位名稱。
- 管理者通知的「一天最多一次」節流存在記憶體中，Vercel 同時有多個 instance 時可能各通知一次。
