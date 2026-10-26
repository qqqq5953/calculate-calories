/** 讀取必要的環境變數；只在實際用到時才檢查，避免 build 階段因為沒設定而失敗 */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export const env = {
  lineChannelSecret: () => requireEnv("LINE_CHANNEL_SECRET"),
  lineChannelAccessToken: () => requireEnv("LINE_CHANNEL_ACCESS_TOKEN"),
  lineLoginChannelId: () => requireEnv("LINE_LOGIN_CHANNEL_ID"),
  liffId: () => process.env.NEXT_PUBLIC_LIFF_ID ?? "",
  sessionSecret: () => requireEnv("SESSION_SECRET"),
  cronSecret: () => process.env.CRON_SECRET,
  adminLineUserId: () => process.env.ADMIN_LINE_USER_ID,
  aiModel: () => process.env.AI_MODEL || "claude-haiku-5-5",
  supabaseUrl: () => process.env.SUPABASE_URL,
  supabaseServiceRoleKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  photoBucket: () => process.env.SUPABASE_PHOTO_BUCKET || "meal-photos",
};

export function liffUrl(path = ""): string {
  const id = env.liffId();
  return id ? `https://liff.line.me/${id}${path}` : path;
}
