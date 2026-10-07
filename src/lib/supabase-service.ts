import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 伺服器端環境變數。");
  if (!key) throw new Error("缺少 SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 伺服器端環境變數。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
