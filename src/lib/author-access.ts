import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function getAuthorContext() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(config.url, config.key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAuthor } = await supabase.rpc("is_author");
  return isAuthor ? { user, supabase } : null;
}

export async function getCurrentAuthor() {
  return (await getAuthorContext())?.user ?? null;
}
