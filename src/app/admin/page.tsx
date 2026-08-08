"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isCurrentUserAuthor } from "@/lib/supabase-browser";
import AdminShell from "./AdminShell";
import StoryComposer from "./StoryComposer";

export default function AdminPage() {
  const [mode, setMode] = useState<"login" | "editor">("login");
  const [status, setStatus] = useState(() => process.env.NEXT_PUBLIC_SUPABASE_URL ? "正在確認登入狀態…" : "尚未設定 Supabase，後台目前無法使用");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (data.user && await isCurrentUserAuthor()) {
        setStatus(`已登入：${data.user.email ?? "作者"}`);
        setMode("editor");
      } else if (data.user) {
        setStatus("這個 Google 帳號不在作者名單中。");
        await supabase.auth.signOut();
      } else {
        setStatus(error ? "登入狀態確認失敗，請再試一次" : "尚未登入");
      }
    });
  }, []);

  async function signIn() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setStatus("請先設定 Supabase 環境變數。");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) setStatus(error.message);
  }

  if (mode === "login") return <main className="min-h-screen bg-[#fdfcf8] px-6 py-8"><nav className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><span className="text-sm text-[#7a8b83]">作者後台</span></nav><section className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center"><p className="text-sm tracking-[0.2em] text-[#c1664b]">AUTHOR SPACE</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">把下一段故事寫下來。</h1><p className="mt-5 leading-7 text-[#718078]">只有作者可以進入後台，訪客不需要登入。</p><button onClick={signIn} className="mt-8 rounded-full bg-[#c1664b] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#c1664b]/20 transition hover:bg-[#ad533e]">使用 Google 登入</button><p className="mt-4 text-xs leading-5 text-[#9aa8a0]">{status}</p></section></main>;

  return <AdminShell><StoryComposer accountStatus={status} /></AdminShell>;
}
