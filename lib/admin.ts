import { env } from "@/lib/env";
import { lineClient } from "@/lib/line/client";
import { localDate } from "@/lib/time";

// 節流只存在記憶體：serverless 多個 instance 可能各通知一次，家庭使用規模可以接受
let lastNotifiedDate: string | undefined;

/** DB 連不上時通知管理者，同一天（同一個 instance）最多一次 */
export async function notifyAdminDbDown(context: string): Promise<void> {
  const adminId = env.adminLineUserId();
  if (!adminId) return;
  const today = localDate(new Date());
  if (lastNotifiedDate === today) return;
  lastNotifiedDate = today;
  try {
    await lineClient().pushMessage({
      to: adminId,
      messages: [
        {
          type: "text",
          text: `⚠️ 資料庫無法連線（${context}）\n如果 Supabase 專案被暫停，請到 Supabase 後台按「Restore」恢復。`,
        },
      ],
    });
  } catch (err) {
    console.error("notifyAdminDbDown failed", err);
  }
}
