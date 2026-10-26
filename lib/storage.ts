import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { newId } from "@/lib/id";

let client: SupabaseClient | undefined | null;

function storage() {
  if (client === undefined) {
    const url = env.supabaseUrl();
    const key = env.supabaseServiceRoleKey();
    client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  }
  return client;
}

/** 上傳餐點照片；沒設定 Supabase 或上傳失敗都不影響記錄，回傳 null */
export async function uploadMealPhoto(userId: string, jpeg: Buffer): Promise<string | null> {
  const s = storage();
  if (!s) return null;
  const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${newId()}.jpg`;
  try {
    const { error } = await s.storage.from(env.photoBucket()).upload(path, jpeg, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return path;
  } catch (err) {
    console.warn("photo upload failed", err);
    return null;
  }
}
