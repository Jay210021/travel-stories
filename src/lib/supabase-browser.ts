import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export async function isCurrentUserAuthor() {
  try {
    const response = await fetch("/api/author-status", { cache: "no-store" });
    if (!response.ok) return false;
    const data: { isAuthor?: boolean } = await response.json();
    return data.isAuthor === true;
  } catch {
    return false;
  }
}
